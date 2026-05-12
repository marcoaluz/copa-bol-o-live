ALTER TABLE public.partidas
  ADD COLUMN IF NOT EXISTS codigo_partida text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_partidas_codigo
  ON public.partidas(codigo_partida) WHERE codigo_partida IS NOT NULL;

UPDATE public.partidas
SET codigo_partida = 'WC2026-' || fase::text
  || '-' || COALESCE(selecao_casa_id::text, 'TBD')
  || '-' || COALESCE(selecao_visitante_id::text, 'TBD')
  || '-' || to_char(data_hora AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE codigo_partida IS NULL;