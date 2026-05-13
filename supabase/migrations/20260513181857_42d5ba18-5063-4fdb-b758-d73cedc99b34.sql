
ALTER TABLE public.selecoes DROP CONSTRAINT IF EXISTS selecoes_codigo_iso_key;
CREATE UNIQUE INDEX IF NOT EXISTS selecoes_torneio_codigo_iso_uniq
  ON public.selecoes (torneio_id, codigo_iso);
