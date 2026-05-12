ALTER TABLE public.api_sync_log
  ADD COLUMN IF NOT EXISTS partidas_puladas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS times_nao_mapeados text[] NOT NULL DEFAULT ARRAY[]::text[];