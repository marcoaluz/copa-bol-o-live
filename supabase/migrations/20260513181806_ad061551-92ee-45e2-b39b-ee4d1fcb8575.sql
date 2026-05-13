
DO $$
BEGIN
  PERFORM cron.unschedule('sync-brasileirao-2026-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sync-brasileirao-2026-30min',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zhaoowunnogglyvpikcb.supabase.co/functions/v1/sync-brasileirao-2026',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoYW9vd3Vubm9nZ2x5dnBpa2NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzYwMjQsImV4cCI6MjA5MzgxMjAyNH0.lxu-6uQX1G5giqyIQiAAzWGH6I2gPYGkUSeyebSlf7Q'
    ),
    body := jsonb_build_object('trigger', 'cron')
  ) AS request_id;
  $$
);
