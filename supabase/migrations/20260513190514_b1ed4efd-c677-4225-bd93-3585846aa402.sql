CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  PERFORM _assert_admin();
  SELECT jsonb_build_object(
    'usuarios_ativos', (SELECT COUNT(*) FROM profiles WHERE bloqueado=false),
    'usuarios_bloqueados', (SELECT COUNT(*) FROM profiles WHERE bloqueado=true),
    'total_custodia_centavos', (SELECT COALESCE(SUM(saldo_centavos),0) FROM profiles),
    'apostado_hoje',
      (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas WHERE created_at::date = current_date)
      + (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas_placar WHERE created_at::date = current_date),
    'apostado_semana',
      (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas WHERE created_at >= now() - interval '7 days')
      + (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas_placar WHERE created_at >= now() - interval '7 days'),
    'apostado_mes',
      (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas WHERE created_at >= now() - interval '30 days')
      + (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas_placar WHERE created_at >= now() - interval '30 days'),
    'taxa_acumulada_centavos', (SELECT COALESCE(SUM(-valor_centavos),0) FROM transacoes WHERE tipo='ajuste_admin' AND descricao='Taxa da casa'),
    'saques_pendentes_qtd', (SELECT COUNT(*) FROM saques WHERE status='pendente'),
    'saques_pendentes_total', (SELECT COALESCE(SUM(valor_centavos),0) FROM saques WHERE status='pendente')
  ) INTO v;
  RETURN v;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_receita_diaria(p_dias integer DEFAULT 30)
RETURNS TABLE(dia date, apostado bigint, premios bigint, taxa bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH dias AS (
    SELECT generate_series(current_date - (p_dias-1), current_date, '1 day')::date AS dia
  )
  SELECT
    d.dia,
    (
      COALESCE((SELECT SUM(a.valor_centavos) FROM apostas a WHERE a.created_at::date = d.dia),0)
      + COALESCE((SELECT SUM(ap.valor_centavos) FROM apostas_placar ap WHERE ap.created_at::date = d.dia),0)
    )::bigint AS apostado,
    (
      COALESCE((SELECT SUM(a.premio_centavos) FROM apostas a WHERE a.status='ganhou' AND a.updated_at::date = d.dia),0)
      + COALESCE((SELECT SUM(ap.premio_centavos) FROM apostas_placar ap WHERE ap.status='ganhou' AND ap.updated_at::date = d.dia),0)
    )::bigint AS premios,
    COALESCE((SELECT SUM(-t.valor_centavos) FROM transacoes t WHERE t.tipo='ajuste_admin' AND t.descricao='Taxa da casa' AND t.created_at::date = d.dia),0)::bigint AS taxa
  FROM dias d ORDER BY d.dia;
$function$;

CREATE OR REPLACE FUNCTION public.admin_top_partidas(p_limite integer DEFAULT 5)
RETURNS TABLE(partida_id uuid, codigo text, fase fase_partida, data_hora timestamp with time zone, bolo_centavos bigint, qtd_apostas bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.codigo, p.fase, p.data_hora,
    (
      COALESCE(p.bolo_acumulado_centavos,0)
      + COALESCE((SELECT SUM(valor_centavos) FROM apostas WHERE partida_id=p.id AND status='ativa'),0)
      + COALESCE((SELECT SUM(valor_centavos) FROM apostas_placar WHERE partida_id=p.id AND status='ativa'),0)
    )::bigint AS bolo,
    (
      (SELECT COUNT(*) FROM apostas WHERE partida_id=p.id)
      + (SELECT COUNT(*) FROM apostas_placar WHERE partida_id=p.id)
    )::bigint AS qtd_apostas
  FROM partidas p
  WHERE p.status IN ('agendada','ao_vivo','encerrada')
  ORDER BY bolo DESC
  LIMIT p_limite;
$function$;