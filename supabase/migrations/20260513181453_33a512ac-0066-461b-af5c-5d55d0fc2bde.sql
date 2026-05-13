
DROP FUNCTION IF EXISTS public.ranking_filtrado(text);
DROP FUNCTION IF EXISTS public.ranking_filtrado(text, uuid);

CREATE OR REPLACE FUNCTION public.ranking_filtrado(
  p_filtro text DEFAULT 'geral'::text,
  p_torneio_id uuid DEFAULT NULL
)
 RETURNS TABLE(usuario_id uuid, apelido text, foto_url text, anonimo boolean,
   total_apostas bigint, total_acertos bigint, taxa_acerto numeric,
   total_apostado_centavos bigint, total_ganho_centavos bigint, lucro_centavos bigint,
   total_apostas_placar bigint, total_acertos_placar bigint,
   pontos_ranking bigint, posicao bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH agg_v AS (
    SELECT p.id AS uid, p.apelido, p.foto_url, p.anonimo,
      COUNT(a.id) FILTER (WHERE a.status IN ('ganhou','perdeu')) AS tap,
      COUNT(a.id) FILTER (WHERE a.status='ganhou') AS tac,
      COALESCE(SUM(a.valor_centavos) FILTER (WHERE a.status IN ('ganhou','perdeu')),0)::bigint AS apostado,
      COALESCE(SUM(a.premio_centavos) FILTER (WHERE a.status='ganhou'),0)::bigint AS ganho
    FROM public.profiles p
    LEFT JOIN public.apostas a ON a.usuario_id = p.id AND a.status IN ('ganhou','perdeu')
      AND CASE p_filtro WHEN 'semana' THEN a.updated_at >= now() - interval '7 days' ELSE true END
      AND (p_torneio_id IS NULL OR a.torneio_id = p_torneio_id)
    LEFT JOIN public.partidas pa ON pa.id = a.partida_id
      AND CASE p_filtro WHEN 'grupos' THEN pa.fase = 'grupos'
        WHEN 'mata' THEN pa.fase IN ('oitavas','quartas','semi','terceiro','final') ELSE true END
    WHERE a.id IS NULL OR pa.id IS NOT NULL
    GROUP BY p.id, p.apelido, p.foto_url, p.anonimo
  ),
  agg_p AS (
    SELECT p.id AS uid,
      COUNT(ap.id) FILTER (WHERE ap.status IN ('ganhou','perdeu')) AS tap_p,
      COUNT(ap.id) FILTER (WHERE ap.status='ganhou') AS tac_p,
      COALESCE(SUM(ap.valor_centavos) FILTER (WHERE ap.status IN ('ganhou','perdeu')),0)::bigint AS apostado_p,
      COALESCE(SUM(ap.premio_centavos) FILTER (WHERE ap.status='ganhou'),0)::bigint AS ganho_p
    FROM public.profiles p
    LEFT JOIN public.apostas_placar ap ON ap.usuario_id = p.id AND ap.status IN ('ganhou','perdeu')
      AND CASE p_filtro WHEN 'semana' THEN ap.updated_at >= now() - interval '7 days' ELSE true END
      AND (p_torneio_id IS NULL OR ap.torneio_id = p_torneio_id)
    LEFT JOIN public.partidas pa ON pa.id = ap.partida_id
      AND CASE p_filtro WHEN 'grupos' THEN pa.fase = 'grupos'
        WHEN 'mata' THEN pa.fase IN ('oitavas','quartas','semi','terceiro','final') ELSE true END
    WHERE ap.id IS NULL OR pa.id IS NOT NULL
    GROUP BY p.id
  ),
  combo AS (
    SELECT v.uid, v.apelido, v.foto_url, v.anonimo, v.tap, v.tac, v.apostado, v.ganho,
      COALESCE(p.tap_p,0) AS tap_p, COALESCE(p.tac_p,0) AS tac_p,
      COALESCE(p.apostado_p,0) AS apostado_p, COALESCE(p.ganho_p,0) AS ganho_p
    FROM agg_v v LEFT JOIN agg_p p ON p.uid = v.uid
  )
  SELECT uid, apelido, foto_url, anonimo, tap, tac,
    CASE WHEN tap > 0 THEN ROUND(100.0 * tac::numeric / tap, 2) ELSE 0 END,
    (apostado + apostado_p)::bigint, (ganho + ganho_p)::bigint,
    ((ganho + ganho_p) - (apostado + apostado_p))::bigint,
    tap_p, tac_p, (tac + tac_p * 5)::bigint,
    RANK() OVER (ORDER BY (tac + tac_p * 5) DESC, ((ganho + ganho_p) - (apostado + apostado_p)) DESC, apelido ASC)::bigint
  FROM combo;
$function$;

REVOKE ALL ON FUNCTION public.ranking_filtrado(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_filtrado(text, uuid) TO anon, authenticated;

-- Garantir que config tem campos de sync para Brasileirão
ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS brasileirao_sync_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS brasileirao_ultimo_sync timestamptz,
  ADD COLUMN IF NOT EXISTS brasileirao_ultimo_erro text;
