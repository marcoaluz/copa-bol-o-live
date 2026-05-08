
-- 1) Profiles: campos privacidade/avatar
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS anonimo boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_url text;

-- 2) Materialized view base (geral, all-time)
DROP MATERIALIZED VIEW IF EXISTS public.ranking_usuarios CASCADE;
CREATE MATERIALIZED VIEW public.ranking_usuarios AS
SELECT
  p.id AS usuario_id,
  p.apelido,
  p.foto_url,
  p.anonimo,
  COUNT(a.id) FILTER (WHERE a.status IN ('ganhou','perdeu')) AS total_apostas,
  COUNT(a.id) FILTER (WHERE a.status='ganhou') AS total_acertos,
  CASE WHEN COUNT(a.id) FILTER (WHERE a.status IN ('ganhou','perdeu')) > 0
       THEN ROUND(100.0 * COUNT(a.id) FILTER (WHERE a.status='ganhou')::numeric
                  / COUNT(a.id) FILTER (WHERE a.status IN ('ganhou','perdeu')), 2)
       ELSE 0 END AS taxa_acerto,
  COALESCE(SUM(a.valor_centavos) FILTER (WHERE a.status IN ('ganhou','perdeu')),0)::bigint AS total_apostado_centavos,
  COALESCE(SUM(a.premio_centavos) FILTER (WHERE a.status='ganhou'),0)::bigint AS total_ganho_centavos,
  (COALESCE(SUM(a.premio_centavos) FILTER (WHERE a.status='ganhou'),0)
   - COALESCE(SUM(a.valor_centavos) FILTER (WHERE a.status IN ('ganhou','perdeu')),0))::bigint AS lucro_centavos
FROM public.profiles p
LEFT JOIN public.apostas a ON a.usuario_id = p.id
GROUP BY p.id, p.apelido, p.foto_url, p.anonimo;

CREATE UNIQUE INDEX ranking_usuarios_uid_idx ON public.ranking_usuarios (usuario_id);
CREATE INDEX ranking_usuarios_ord_idx ON public.ranking_usuarios (total_acertos DESC, lucro_centavos DESC);

-- 3) Função: ranking com posição calculada e filtros
CREATE OR REPLACE FUNCTION public.ranking_filtrado(p_filtro text DEFAULT 'geral')
RETURNS TABLE (
  usuario_id uuid, apelido text, foto_url text, anonimo boolean,
  total_apostas bigint, total_acertos bigint, taxa_acerto numeric,
  total_apostado_centavos bigint, total_ganho_centavos bigint,
  lucro_centavos bigint, posicao bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH agg AS (
    SELECT
      p.id AS uid, p.apelido, p.foto_url, p.anonimo,
      COUNT(a.id) FILTER (WHERE a.status IN ('ganhou','perdeu')) AS tap,
      COUNT(a.id) FILTER (WHERE a.status='ganhou') AS tac,
      COALESCE(SUM(a.valor_centavos) FILTER (WHERE a.status IN ('ganhou','perdeu')),0)::bigint AS apostado,
      COALESCE(SUM(a.premio_centavos) FILTER (WHERE a.status='ganhou'),0)::bigint AS ganho
    FROM public.profiles p
    LEFT JOIN public.apostas a
      ON a.usuario_id = p.id
     AND a.status IN ('ganhou','perdeu')
     AND CASE p_filtro
           WHEN 'semana' THEN a.updated_at >= now() - interval '7 days'
           ELSE true
         END
    LEFT JOIN public.partidas pa
      ON pa.id = a.partida_id
     AND CASE p_filtro
           WHEN 'grupos' THEN pa.fase = 'grupos'
           WHEN 'mata'   THEN pa.fase IN ('oitavas','quartas','semi','terceiro','final')
           ELSE true
         END
    WHERE a.id IS NULL OR pa.id IS NOT NULL
    GROUP BY p.id, p.apelido, p.foto_url, p.anonimo
  )
  SELECT
    uid, apelido, foto_url, anonimo,
    tap, tac,
    CASE WHEN tap > 0 THEN ROUND(100.0 * tac::numeric / tap, 2) ELSE 0 END AS taxa_acerto,
    apostado, ganho, (ganho - apostado)::bigint AS lucro,
    RANK() OVER (ORDER BY tac DESC, (ganho - apostado) DESC, apelido ASC)::bigint AS posicao
  FROM agg;
$$;

-- 4) Estatísticas individuais (inclui melhor sequência de acertos consecutivos)
CREATE OR REPLACE FUNCTION public.estatisticas_usuario(p_uid uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := COALESCE(p_uid, auth.uid());
  v_max int := 0; v_cur int := 0; r record;
  v_row record;
BEGIN
  IF v_uid IS NULL THEN RETURN '{}'::jsonb; END IF;

  FOR r IN
    SELECT a.status FROM public.apostas a
    JOIN public.partidas pa ON pa.id = a.partida_id
    WHERE a.usuario_id = v_uid AND a.status IN ('ganhou','perdeu')
    ORDER BY pa.data_hora ASC
  LOOP
    IF r.status = 'ganhou' THEN v_cur := v_cur + 1; IF v_cur > v_max THEN v_max := v_cur; END IF;
    ELSE v_cur := 0;
    END IF;
  END LOOP;

  SELECT * INTO v_row FROM public.ranking_filtrado('geral') WHERE usuario_id = v_uid;

  RETURN jsonb_build_object(
    'usuario_id', v_uid,
    'posicao', COALESCE(v_row.posicao, NULL),
    'total_apostas', COALESCE(v_row.total_apostas, 0),
    'total_acertos', COALESCE(v_row.total_acertos, 0),
    'taxa_acerto', COALESCE(v_row.taxa_acerto, 0),
    'lucro_centavos', COALESCE(v_row.lucro_centavos, 0),
    'melhor_sequencia', v_max
  );
END; $$;

-- 5) Refresh automático após apuração
CREATE OR REPLACE FUNCTION public.refresh_ranking_usuarios()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.ranking_usuarios;
  EXCEPTION WHEN OTHERS THEN
    -- Em caso de bloqueio concorrente, ignora; será atualizado no próximo evento
    NULL;
  END;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_refresh_ranking_apostas ON public.apostas;
CREATE TRIGGER trg_refresh_ranking_apostas
AFTER UPDATE ON public.apostas
FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_ranking_usuarios();

-- Refresh inicial
REFRESH MATERIALIZED VIEW public.ranking_usuarios;

-- 6) Permissões
REVOKE ALL ON FUNCTION public.ranking_filtrado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_filtrado(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.estatisticas_usuario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.estatisticas_usuario(uuid) TO authenticated;

GRANT SELECT ON public.ranking_usuarios TO anon, authenticated;
