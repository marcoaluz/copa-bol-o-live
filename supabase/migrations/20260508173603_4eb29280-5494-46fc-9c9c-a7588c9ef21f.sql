CREATE TABLE public.usuarios_autorizados (
  email text PRIMARY KEY,
  convidado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  convite_aceito boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.usuarios_autorizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_autorizados" ON public.usuarios_autorizados
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "self_read_autorizados" ON public.usuarios_autorizados
  FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.adicionar_emails_autorizados(p_emails text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin boolean;
  v_count integer := 0;
  v_email text;
  v_clean text;
BEGIN
  SELECT is_admin INTO v_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem autorizar e-mails' USING ERRCODE='42501';
  END IF;

  FOREACH v_email IN ARRAY p_emails LOOP
    v_clean := lower(trim(v_email));
    IF v_clean = '' OR v_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      CONTINUE;
    END IF;
    INSERT INTO public.usuarios_autorizados (email, convidado_por)
    VALUES (v_clean, auth.uid())
    ON CONFLICT (email) DO NOTHING;
    IF FOUND THEN v_count := v_count + 1; END IF;
  END LOOP;

  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.remover_email_autorizado(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_admin boolean;
BEGIN
  SELECT is_admin INTO v_admin FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores' USING ERRCODE='42501';
  END IF;
  DELETE FROM public.usuarios_autorizados WHERE email = lower(trim(p_email));
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.email_esta_autorizado()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE v_email text; v_ok boolean;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN false; END IF;
  SELECT EXISTS (SELECT 1 FROM public.usuarios_autorizados WHERE email = lower(v_email)) INTO v_ok;
  RETURN v_ok;
END $$;

CREATE OR REPLACE FUNCTION public.marcar_convite_aceito()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN; END IF;
  UPDATE public.usuarios_autorizados
    SET convite_aceito = true
    WHERE email = lower(v_email) AND convite_aceito = false;
END $$;

-- Auto-autoriza administradores existentes para evitar lockout
INSERT INTO public.usuarios_autorizados (email, convite_aceito)
SELECT lower(u.email), true
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE p.is_admin = true AND u.email IS NOT NULL
ON CONFLICT (email) DO UPDATE SET convite_aceito = true;