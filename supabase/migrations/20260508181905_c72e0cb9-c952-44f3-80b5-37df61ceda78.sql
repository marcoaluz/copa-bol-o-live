
ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS notif_email_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_email_destino text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notif_telegram_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notif_eventos jsonb NOT NULL DEFAULT
    '{"deposito_pendente": true, "saque_pendente": true, "novo_usuario": true}'::jsonb;

CREATE TABLE IF NOT EXISTS public.notificacoes_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento text NOT NULL CHECK (evento IN ('deposito_pendente','saque_pendente','novo_usuario')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','enviada','falhou','ignorada')),
  canais_enviados text[] NOT NULL DEFAULT ARRAY[]::text[],
  canais_falharam text[] NOT NULL DEFAULT ARRAY[]::text[],
  tentativas int NOT NULL DEFAULT 0,
  ultimo_erro text,
  enviada_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_admin_pendente ON public.notificacoes_admin(status, created_at)
  WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_notif_admin_evento ON public.notificacoes_admin(evento, created_at DESC);

ALTER TABLE public.notificacoes_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_notif_admin" ON public.notificacoes_admin;
CREATE POLICY "admin_read_notif_admin" ON public.notificacoes_admin
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_update_notif_admin" ON public.notificacoes_admin;
CREATE POLICY "admin_update_notif_admin" ON public.notificacoes_admin
  FOR UPDATE USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.trg_notif_deposito_pendente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_eventos jsonb; v_apelido text; v_nome text;
BEGIN
  IF NEW.status = 'aguardando_confirmacao' AND
     (OLD.status IS DISTINCT FROM 'aguardando_confirmacao') THEN
    SELECT notif_eventos INTO v_eventos FROM public.config WHERE id = 1;
    IF (v_eventos->>'deposito_pendente')::boolean THEN
      SELECT apelido, nome_completo INTO v_apelido, v_nome
        FROM public.profiles WHERE id = NEW.usuario_id;
      INSERT INTO public.notificacoes_admin (evento, payload)
      VALUES ('deposito_pendente', jsonb_build_object(
        'deposito_id', NEW.id,
        'codigo_referencia', NEW.codigo_referencia,
        'valor_centavos', NEW.valor_centavos,
        'usuario_apelido', v_apelido,
        'usuario_nome', v_nome
      ));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notif_deposito_pendente ON public.depositos;
CREATE TRIGGER notif_deposito_pendente
  AFTER UPDATE ON public.depositos
  FOR EACH ROW EXECUTE FUNCTION public.trg_notif_deposito_pendente();

CREATE OR REPLACE FUNCTION public.trg_notif_saque_pendente()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_eventos jsonb; v_apelido text; v_nome text;
BEGIN
  IF NEW.status = 'pendente' THEN
    SELECT notif_eventos INTO v_eventos FROM public.config WHERE id = 1;
    IF (v_eventos->>'saque_pendente')::boolean THEN
      SELECT apelido, nome_completo INTO v_apelido, v_nome
        FROM public.profiles WHERE id = NEW.usuario_id;
      INSERT INTO public.notificacoes_admin (evento, payload)
      VALUES ('saque_pendente', jsonb_build_object(
        'saque_id', NEW.id,
        'valor_centavos', NEW.valor_centavos,
        'chave_pix', NEW.chave_pix,
        'tipo_chave', NEW.tipo_chave,
        'usuario_apelido', v_apelido,
        'usuario_nome', v_nome
      ));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notif_saque_pendente ON public.saques;
CREATE TRIGGER notif_saque_pendente
  AFTER INSERT ON public.saques
  FOR EACH ROW EXECUTE FUNCTION public.trg_notif_saque_pendente();

CREATE OR REPLACE FUNCTION public.trg_notif_novo_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_eventos jsonb;
BEGIN
  IF NEW.aceitou_termos_em IS NOT NULL AND OLD.aceitou_termos_em IS NULL THEN
    SELECT notif_eventos INTO v_eventos FROM public.config WHERE id = 1;
    IF (v_eventos->>'novo_usuario')::boolean THEN
      INSERT INTO public.notificacoes_admin (evento, payload)
      VALUES ('novo_usuario', jsonb_build_object(
        'usuario_id', NEW.id,
        'apelido', NEW.apelido,
        'nome_completo', NEW.nome_completo
      ));
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notif_novo_usuario ON public.profiles;
CREATE TRIGGER notif_novo_usuario
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_notif_novo_usuario();

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE v_jobid int;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'enviar-notif-admin';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'enviar-notif-admin',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zhaoowunnogglyvpikcb.supabase.co/functions/v1/enviar-notificacao-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYW9vd3Vubm9nZ2x5dnBpa2NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzYwMjQsImV4cCI6MjA5MzgxMjAyNH0.lxu-6uQX1G5giqyIQiAAzWGH6I2gPYGkUSeyebSlf7Q'
    ),
    body := '{}'::jsonb
  );
  $$
);
