-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove jobs antigos (se já existirem) para idempotência
DO $$
BEGIN
  PERFORM cron.unschedule('sync-copa-2026-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('enviar-notificacao-admin-1min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Sync da Copa a cada 30 minutos
SELECT cron.schedule(
  'sync-copa-2026-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zhaoowunnogglyvpikcb.supabase.co/functions/v1/sync-copa-2026',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYW9vd3Vubm9nZ2x5dnBpa2NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzYwMjQsImV4cCI6MjA5MzgxMjAyNH0.lxu-6uQX1G5giqyIQiAAzWGH6I2gPYGkUSeyebSlf7Q'
    ),
    body := jsonb_build_object('trigger', 'cron')
  ) AS request_id;
  $$
);

-- Notificações admin (e-mail/Telegram) a cada 1 minuto
SELECT cron.schedule(
  'enviar-notificacao-admin-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zhaoowunnogglyvpikcb.supabase.co/functions/v1/enviar-notificacao-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYW9vd3Vubm9nZ2x5dnBpa2NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzYwMjQsImV4cCI6MjA5MzgxMjAyNH0.lxu-6uQX1G5giqyIQiAAzWGH6I2gPYGkUSeyebSlf7Q'
    ),
    body := jsonb_build_object('trigger', 'cron')
  ) AS request_id;
  $$
);