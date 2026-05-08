
-- Enums
CREATE TYPE public.fase_partida AS ENUM ('grupos','oitavas','quartas','semi','terceiro','final');
CREATE TYPE public.status_partida AS ENUM ('agendada','ao_vivo','encerrada','cancelada');
CREATE TYPE public.resultado_partida AS ENUM ('casa','empate','visitante');

-- selecoes
CREATE TABLE public.selecoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo_iso TEXT NOT NULL UNIQUE,
  bandeira_url TEXT,
  grupo CHAR(1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.selecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "selecoes leitura publica" ON public.selecoes FOR SELECT USING (true);

-- partidas
CREATE TABLE public.partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fase public.fase_partida NOT NULL,
  grupo CHAR(1),
  selecao_casa_id UUID REFERENCES public.selecoes(id),
  selecao_visitante_id UUID REFERENCES public.selecoes(id),
  placeholder_casa TEXT,
  placeholder_visitante TEXT,
  data_hora TIMESTAMPTZ NOT NULL,
  estadio TEXT,
  status public.status_partida NOT NULL DEFAULT 'agendada',
  gols_casa INT,
  gols_visitante INT,
  resultado public.resultado_partida,
  bracket_proximo_id UUID REFERENCES public.partidas(id),
  ordem_bracket INT,
  codigo TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partidas leitura publica" ON public.partidas FOR SELECT USING (true);

CREATE TRIGGER partidas_touch_updated_at
BEFORE UPDATE ON public.partidas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_partidas_fase ON public.partidas(fase);
CREATE INDEX idx_partidas_grupo ON public.partidas(grupo);
CREATE INDEX idx_partidas_data ON public.partidas(data_hora);

-- View de classificação dos grupos (security_invoker=true para respeitar RLS)
CREATE VIEW public.classificacao_grupos
WITH (security_invoker=true) AS
WITH partidas_grupo AS (
  SELECT p.* FROM public.partidas p
  WHERE p.fase='grupos' AND p.status='encerrada'
    AND p.selecao_casa_id IS NOT NULL AND p.selecao_visitante_id IS NOT NULL
),
linhas AS (
  SELECT selecao_casa_id AS selecao_id, grupo,
    gols_casa AS gp, gols_visitante AS gc,
    CASE resultado WHEN 'casa' THEN 'V' WHEN 'empate' THEN 'E' WHEN 'visitante' THEN 'D' END AS r
  FROM partidas_grupo
  UNION ALL
  SELECT selecao_visitante_id, grupo,
    gols_visitante, gols_casa,
    CASE resultado WHEN 'visitante' THEN 'V' WHEN 'empate' THEN 'E' WHEN 'casa' THEN 'D' END
  FROM partidas_grupo
)
SELECT
  s.id AS selecao_id,
  s.grupo,
  COALESCE(COUNT(l.selecao_id), 0)::INT AS jogos,
  COALESCE(SUM((l.r='V')::INT), 0)::INT AS vitorias,
  COALESCE(SUM((l.r='E')::INT), 0)::INT AS empates,
  COALESCE(SUM((l.r='D')::INT), 0)::INT AS derrotas,
  COALESCE(SUM(l.gp), 0)::INT AS gp,
  COALESCE(SUM(l.gc), 0)::INT AS gc,
  COALESCE(SUM(l.gp - l.gc), 0)::INT AS sg,
  COALESCE(SUM((l.r='V')::INT * 3 + (l.r='E')::INT * 1), 0)::INT AS pontos
FROM public.selecoes s
LEFT JOIN linhas l ON l.selecao_id = s.id
WHERE s.grupo IS NOT NULL
GROUP BY s.id, s.grupo;
