
-- Tabela de torneios
CREATE TABLE IF NOT EXISTS public.torneios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  nome_curto text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('copa','pontos_corridos')),
  emoji text NOT NULL DEFAULT '⚽',
  cor_primaria text DEFAULT '#0F7B3F',
  data_inicio date,
  data_fim date,
  fonte_dados text NOT NULL DEFAULT 'manual'
    CHECK (fonte_dados IN ('openfootball','football-data-org','manual')),
  config_sync jsonb NOT NULL DEFAULT '{}'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.torneios (slug, nome, nome_curto, tipo, emoji, ordem,
                             fonte_dados, config_sync, data_inicio, data_fim)
VALUES
  ('copa-2026', 'Copa do Mundo 2026', 'Copa 2026', 'copa', '🏆', 1,
   'openfootball',
   jsonb_build_object('url', 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'),
   '2026-06-11', '2026-07-19'),
  ('brasileirao-2026', 'Brasileirão Série A 2026', 'Brasileirão', 'pontos_corridos', '⚽', 2,
   'football-data-org',
   jsonb_build_object('competition_code', 'BSA', 'season', 2026),
   '2026-03-29', '2026-12-13')
ON CONFLICT (slug) DO NOTHING;

-- Adicionar torneio_id (nullable inicial p/ backfill)
ALTER TABLE public.partidas       ADD COLUMN IF NOT EXISTS torneio_id uuid REFERENCES public.torneios(id);
ALTER TABLE public.selecoes       ADD COLUMN IF NOT EXISTS torneio_id uuid REFERENCES public.torneios(id);
ALTER TABLE public.apostas        ADD COLUMN IF NOT EXISTS torneio_id uuid REFERENCES public.torneios(id);
ALTER TABLE public.apostas_placar ADD COLUMN IF NOT EXISTS torneio_id uuid REFERENCES public.torneios(id);

-- Backfill p/ Copa 2026
UPDATE public.partidas       SET torneio_id = (SELECT id FROM public.torneios WHERE slug='copa-2026') WHERE torneio_id IS NULL;
UPDATE public.selecoes       SET torneio_id = (SELECT id FROM public.torneios WHERE slug='copa-2026') WHERE torneio_id IS NULL;
UPDATE public.apostas        SET torneio_id = (SELECT id FROM public.torneios WHERE slug='copa-2026') WHERE torneio_id IS NULL;
UPDATE public.apostas_placar SET torneio_id = (SELECT id FROM public.torneios WHERE slug='copa-2026') WHERE torneio_id IS NULL;

ALTER TABLE public.partidas       ALTER COLUMN torneio_id SET NOT NULL;
ALTER TABLE public.selecoes       ALTER COLUMN torneio_id SET NOT NULL;
ALTER TABLE public.apostas        ALTER COLUMN torneio_id SET NOT NULL;
ALTER TABLE public.apostas_placar ALTER COLUMN torneio_id SET NOT NULL;

-- Rodada (Brasileirão)
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS rodada int;

-- Índices
CREATE INDEX IF NOT EXISTS idx_partidas_torneio        ON public.partidas(torneio_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_partidas_torneio_rodada ON public.partidas(torneio_id, rodada);
CREATE INDEX IF NOT EXISTS idx_selecoes_torneio        ON public.selecoes(torneio_id);
CREATE INDEX IF NOT EXISTS idx_apostas_torneio         ON public.apostas(torneio_id, usuario_id);
CREATE INDEX IF NOT EXISTS idx_apostas_placar_torneio  ON public.apostas_placar(torneio_id, usuario_id);

-- Código único agora por torneio
ALTER TABLE public.partidas DROP CONSTRAINT IF EXISTS uq_partidas_codigo;
DROP INDEX IF EXISTS uq_partidas_codigo;
CREATE UNIQUE INDEX IF NOT EXISTS uq_partidas_torneio_codigo
  ON public.partidas(torneio_id, codigo_partida) WHERE codigo_partida IS NOT NULL;

-- RLS
ALTER TABLE public.torneios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_torneios" ON public.torneios;
DROP POLICY IF EXISTS "admin_all_torneios" ON public.torneios;
CREATE POLICY "read_torneios" ON public.torneios FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_all_torneios" ON public.torneios FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS torneios_updated_at ON public.torneios;
CREATE TRIGGER torneios_updated_at BEFORE UPDATE ON public.torneios
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- View classificação pontos corridos
CREATE OR REPLACE VIEW public.classificacao_pontos_corridos AS
SELECT
  s.id, s.torneio_id, s.nome, s.codigo_iso, s.bandeira_url,
  COUNT(p.id) FILTER (WHERE p.status='encerrada') AS jogos,
  COUNT(p.id) FILTER (WHERE p.status='encerrada' AND
    ((p.selecao_casa_id = s.id AND p.gols_casa > p.gols_visitante) OR
     (p.selecao_visitante_id = s.id AND p.gols_visitante > p.gols_casa))) AS vitorias,
  COUNT(p.id) FILTER (WHERE p.status='encerrada' AND p.gols_casa = p.gols_visitante
    AND (p.selecao_casa_id = s.id OR p.selecao_visitante_id = s.id)) AS empates,
  COUNT(p.id) FILTER (WHERE p.status='encerrada' AND
    ((p.selecao_casa_id = s.id AND p.gols_casa < p.gols_visitante) OR
     (p.selecao_visitante_id = s.id AND p.gols_visitante < p.gols_casa))) AS derrotas,
  COALESCE(SUM(CASE WHEN p.status='encerrada' AND p.selecao_casa_id = s.id THEN p.gols_casa
                    WHEN p.status='encerrada' AND p.selecao_visitante_id = s.id THEN p.gols_visitante END), 0)::int AS gp,
  COALESCE(SUM(CASE WHEN p.status='encerrada' AND p.selecao_casa_id = s.id THEN p.gols_visitante
                    WHEN p.status='encerrada' AND p.selecao_visitante_id = s.id THEN p.gols_casa END), 0)::int AS gc,
  (COUNT(p.id) FILTER (WHERE p.status='encerrada' AND
     ((p.selecao_casa_id = s.id AND p.gols_casa > p.gols_visitante) OR
      (p.selecao_visitante_id = s.id AND p.gols_visitante > p.gols_casa))) * 3
   + COUNT(p.id) FILTER (WHERE p.status='encerrada' AND p.gols_casa = p.gols_visitante
       AND (p.selecao_casa_id = s.id OR p.selecao_visitante_id = s.id)))::int AS pontos
FROM public.selecoes s
LEFT JOIN public.partidas p ON p.torneio_id = s.torneio_id
  AND (p.selecao_casa_id = s.id OR p.selecao_visitante_id = s.id)
GROUP BY s.id, s.torneio_id, s.nome, s.codigo_iso, s.bandeira_url;
