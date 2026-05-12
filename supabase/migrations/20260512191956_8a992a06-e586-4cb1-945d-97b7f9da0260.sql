DROP POLICY IF EXISTS "self_read_autorizados" ON public.usuarios_autorizados;

CREATE POLICY "self_read_autorizados"
  ON public.usuarios_autorizados
  FOR SELECT
  USING (email = lower(coalesce(auth.jwt() ->> 'email', '')));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.usuarios_autorizados'::regclass
      AND polname = 'self_read_autorizados'
  ) THEN
    RAISE EXCEPTION 'Policy self_read_autorizados não foi criada corretamente';
  END IF;
END $$;