-- TABLE
CREATE TABLE public.apostas_placar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partida_id uuid NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  gols_casa_palpite int NOT NULL CHECK (gols_casa_palpite >= 0 AND gols_casa_palpite <= 20),
  gols_visitante_palpite int NOT NULL CHECK (gols_visitante_palpite >= 0 AND gols_visitante_palpite <= 20),
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  status text NOT NULL DEFAULT 'ativa'
    CHECK (status IN ('ativa','ganhou','perdeu','devolvida')),
  premio_centavos bigint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, partida_id)
);
CREATE INDEX idx_apostas_placar_partida ON public.apostas_placar(partida_id, status);
CREATE INDEX idx_apostas_placar_usuario ON public.apostas_placar(usuario_id, created_at DESC);

ALTER TABLE public.apostas_placar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_read_apostas_placar" ON public.apostas_placar
  FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "admin_read_apostas_placar" ON public.apostas_placar
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "admin_all_apostas_placar" ON public.apostas_placar
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER apostas_placar_updated_at
  BEFORE UPDATE ON public.apostas_placar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC criar/alterar
CREATE OR REPLACE FUNCTION public.criar_ou_alterar_aposta_placar(
  p_partida_id uuid, p_gols_casa int, p_gols_visitante int, p_valor_centavos bigint
) RETURNS public.apostas_placar
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_part public.partidas%ROWTYPE;
  v_cfg public.config%ROWTYPE;
  v_existente public.apostas_placar%ROWTYPE;
  v_saldo bigint; v_delta bigint;
  v_resultado public.apostas_placar; v_bloq boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000'; END IF;
  PERFORM public._assert_autorizado();
  SELECT bloqueado INTO v_bloq FROM public.profiles WHERE id = v_user;
  IF v_bloq THEN RAISE EXCEPTION 'Sua conta está bloqueada'; END IF;
  SELECT * INTO v_cfg FROM public.config WHERE id = 1;
  IF v_cfg.manutencao_ativa THEN RAISE EXCEPTION 'Sistema em manutenção'; END IF;
  IF p_gols_casa < 0 OR p_gols_visitante < 0 OR p_gols_casa > 20 OR p_gols_visitante > 20 THEN
    RAISE EXCEPTION 'Placar inválido'; END IF;
  IF p_valor_centavos < v_cfg.valor_minimo_aposta_centavos THEN
    RAISE EXCEPTION 'Valor mínimo: R$ %', to_char(v_cfg.valor_minimo_aposta_centavos::numeric/100,'FM999G990D00'); END IF;
  IF p_valor_centavos > v_cfg.valor_maximo_aposta_centavos THEN
    RAISE EXCEPTION 'Valor máximo: R$ %', to_char(v_cfg.valor_maximo_aposta_centavos::numeric/100,'FM999G990D00'); END IF;
  SELECT * INTO v_part FROM public.partidas WHERE id = p_partida_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  IF v_part.status <> 'agendada' THEN RAISE EXCEPTION 'Esta partida não aceita mais apostas'; END IF;
  IF v_part.data_hora - now() <= interval '60 minutes' THEN
    RAISE EXCEPTION 'Apostas encerradas: a partida começa em menos de 60 minutos'; END IF;
  IF v_part.selecao_casa_id IS NULL OR v_part.selecao_visitante_id IS NULL THEN
    RAISE EXCEPTION 'Times ainda não definidos'; END IF;

  SELECT * INTO v_existente FROM public.apostas_placar
    WHERE usuario_id = v_user AND partida_id = p_partida_id FOR UPDATE;
  IF FOUND THEN
    IF v_existente.status <> 'ativa' THEN RAISE EXCEPTION 'Aposta já foi apurada'; END IF;
    v_delta := v_existente.valor_centavos - p_valor_centavos;
    SELECT saldo_centavos INTO v_saldo FROM public.profiles WHERE id = v_user FOR UPDATE;
    IF v_saldo + v_delta < 0 THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
    UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_delta
      WHERE id = v_user RETURNING saldo_centavos INTO v_saldo;
    UPDATE public.apostas_placar SET
      gols_casa_palpite = p_gols_casa, gols_visitante_palpite = p_gols_visitante,
      valor_centavos = p_valor_centavos, updated_at = now()
    WHERE id = v_existente.id RETURNING * INTO v_resultado;
    INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
    VALUES (v_user, 'aposta', v_delta, v_saldo, v_resultado.id,
      'Aposta de placar alterada: ' || p_gols_casa || 'x' || p_gols_visitante);
  ELSE
    SELECT saldo_centavos INTO v_saldo FROM public.profiles WHERE id = v_user FOR UPDATE;
    IF v_saldo < p_valor_centavos THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
    UPDATE public.profiles SET saldo_centavos = saldo_centavos - p_valor_centavos
      WHERE id = v_user RETURNING saldo_centavos INTO v_saldo;
    INSERT INTO public.apostas_placar (usuario_id, partida_id, gols_casa_palpite, gols_visitante_palpite, valor_centavos)
    VALUES (v_user, p_partida_id, p_gols_casa, p_gols_visitante, p_valor_centavos)
    RETURNING * INTO v_resultado;
    INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
    VALUES (v_user, 'aposta', -p_valor_centavos, v_saldo, v_resultado.id,
      'Aposta de placar: ' || p_gols_casa || 'x' || p_gols_visitante);
  END IF;
  RETURN v_resultado;
END $$;
GRANT EXECUTE ON FUNCTION public.criar_ou_alterar_aposta_placar(uuid,int,int,bigint) TO authenticated;

-- RPC cancelar
CREATE OR REPLACE FUNCTION public.cancelar_aposta_placar(p_aposta_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_aposta public.apostas_placar%ROWTYPE;
  v_part public.partidas%ROWTYPE;
  v_saldo bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_aposta FROM public.apostas_placar
    WHERE id = p_aposta_id AND usuario_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aposta não encontrada'; END IF;
  IF v_aposta.status <> 'ativa' THEN RAISE EXCEPTION 'Aposta já apurada'; END IF;
  SELECT * INTO v_part FROM public.partidas WHERE id = v_aposta.partida_id;
  IF v_part.status <> 'agendada' OR v_part.data_hora - now() <= interval '60 minutes' THEN
    RAISE EXCEPTION 'Apostas já fechadas para esta partida'; END IF;
  UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_aposta.valor_centavos
    WHERE id = v_user RETURNING saldo_centavos INTO v_saldo;
  INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
  VALUES (v_user, 'devolucao_aposta', v_aposta.valor_centavos, v_saldo, p_aposta_id, 'Cancelamento de aposta de placar');
  DELETE FROM public.apostas_placar WHERE id = p_aposta_id;
END $$;
GRANT EXECUTE ON FUNCTION public.cancelar_aposta_placar(uuid) TO authenticated;

-- apurar_partida estendido
CREATE OR REPLACE FUNCTION public.apurar_partida(p_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_p partidas%ROWTYPE; v_cfg config%ROWTYPE;
  v_bolo_bruto bigint := 0; v_bolo_acum bigint := 0;
  v_taxa bigint := 0; v_bolo_liq bigint := 0;
  v_total_g bigint := 0; v_qtd_g int := 0; v_qtd_a int := 0;
  v_distribuido bigint := 0; v_residuo bigint := 0;
  v_premio bigint; v_a record; v_maior_id uuid; v_proxima_id uuid;
  v_novo_saldo bigint;
  v_bolo_placar bigint := 0; v_total_g_placar bigint := 0; v_qtd_g_placar int := 0;
  v_dist_placar bigint := 0; v_residuo_placar bigint := 0;
  v_maior_placar_id uuid; v_premio_placar bigint;
  v_resultado_placar jsonb := '{}'::jsonb;
  v_ap record;
BEGIN
  PERFORM public._assert_admin();
  SELECT * INTO v_cfg FROM public.config WHERE id = 1;
  SELECT * INTO v_p FROM public.partidas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  v_bolo_acum := COALESCE(v_p.bolo_acumulado_centavos, 0);

  IF v_p.status = 'cancelada' THEN
    FOR v_a IN SELECT * FROM public.apostas WHERE partida_id = p_id AND status = 'ativa' FOR UPDATE LOOP
      UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_a.valor_centavos
        WHERE id = v_a.usuario_id RETURNING saldo_centavos INTO v_novo_saldo;
      UPDATE public.apostas SET status='devolvida', premio_centavos=v_a.valor_centavos WHERE id=v_a.id;
      INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
      VALUES (v_a.usuario_id,'devolucao_aposta',v_a.valor_centavos,v_novo_saldo,v_a.id,'Partida cancelada — devolução');
      INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
      VALUES (v_a.usuario_id,'partida_cancelada','Partida cancelada','Sua aposta foi devolvida integralmente.','/perfil');
    END LOOP;
    FOR v_ap IN SELECT * FROM public.apostas_placar WHERE partida_id = p_id AND status = 'ativa' FOR UPDATE LOOP
      UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_ap.valor_centavos
        WHERE id = v_ap.usuario_id RETURNING saldo_centavos INTO v_novo_saldo;
      UPDATE public.apostas_placar SET status='devolvida', premio_centavos=v_ap.valor_centavos WHERE id=v_ap.id;
      INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
      VALUES (v_ap.usuario_id,'devolucao_aposta',v_ap.valor_centavos,v_novo_saldo,v_ap.id,'Partida cancelada — devolução de placar');
    END LOOP;
    RETURN jsonb_build_object('status','cancelada');
  END IF;

  IF v_p.status <> 'encerrada' THEN RAISE EXCEPTION 'Lance o resultado da partida antes de apurar'; END IF;
  IF v_p.resultado IS NULL THEN RAISE EXCEPTION 'Resultado não definido'; END IF;
  IF EXISTS (SELECT 1 FROM public.apostas WHERE partida_id=p_id AND status IN ('ganhou','perdeu','devolvida')) THEN
    RAISE EXCEPTION 'Partida já foi apurada'; END IF;

  SELECT COALESCE(SUM(valor_centavos),0), COUNT(*) INTO v_bolo_bruto, v_qtd_a
    FROM public.apostas WHERE partida_id=p_id AND status='ativa';
  v_bolo_bruto := v_bolo_bruto + v_bolo_acum;
  SELECT COALESCE(SUM(valor_centavos),0), COUNT(*) INTO v_total_g, v_qtd_g
    FROM public.apostas WHERE partida_id=p_id AND status='ativa' AND palpite=v_p.resultado;

  IF v_qtd_g > 0 THEN
    v_taxa := floor(v_bolo_bruto * v_cfg.taxa_casa_percentual / 100);
    v_bolo_liq := v_bolo_bruto - v_taxa;
    SELECT usuario_id INTO v_maior_id FROM public.apostas
      WHERE partida_id=p_id AND status='ativa' AND palpite=v_p.resultado
      ORDER BY valor_centavos DESC, created_at ASC LIMIT 1;
    FOR v_a IN SELECT * FROM public.apostas WHERE partida_id=p_id AND status='ativa' AND palpite=v_p.resultado FOR UPDATE LOOP
      v_premio := floor(v_a.valor_centavos::numeric * v_bolo_liq / v_total_g);
      v_distribuido := v_distribuido + v_premio;
      UPDATE public.apostas SET status='ganhou', premio_centavos=v_premio WHERE id=v_a.id;
    END LOOP;
    v_residuo := v_bolo_liq - v_distribuido;
    IF v_residuo > 0 THEN
      UPDATE public.apostas SET premio_centavos = premio_centavos + v_residuo
        WHERE id = (SELECT id FROM public.apostas
          WHERE partida_id=p_id AND status='ganhou' AND usuario_id=v_maior_id
          ORDER BY valor_centavos DESC, created_at ASC LIMIT 1);
    END IF;
    FOR v_a IN SELECT * FROM public.apostas WHERE partida_id=p_id AND status='ganhou' LOOP
      UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_a.premio_centavos
        WHERE id = v_a.usuario_id RETURNING saldo_centavos INTO v_novo_saldo;
      INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
      VALUES (v_a.usuario_id,'premio',v_a.premio_centavos,v_novo_saldo,v_a.id,'Prêmio de aposta');
      INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
      VALUES (v_a.usuario_id,'premio','Você ganhou! 🏆',
              'Você recebeu R$ ' || to_char(v_a.premio_centavos::numeric/100,'FM999G999G990D00') || ' pela sua aposta.','/perfil');
    END LOOP;
    UPDATE public.apostas SET status='perdeu', premio_centavos=0 WHERE partida_id=p_id AND status='ativa';
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
      SELECT usuario_id,'aposta_perdida','Resultado da partida','Sua aposta não foi premiada desta vez.','/perfil'
      FROM public.apostas WHERE partida_id=p_id AND status='perdeu';
    IF v_taxa > 0 THEN
      INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
      VALUES (NULL,'ajuste_admin',-v_taxa,0,p_id,'Taxa da casa');
    END IF;
  ELSIF v_qtd_a > 0 OR v_bolo_acum > 0 THEN
    IF v_cfg.politica_sem_ganhadores = 'devolver' THEN
      FOR v_a IN SELECT * FROM public.apostas WHERE partida_id=p_id AND status='ativa' FOR UPDATE LOOP
        UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_a.valor_centavos
          WHERE id = v_a.usuario_id RETURNING saldo_centavos INTO v_novo_saldo;
        UPDATE public.apostas SET status='devolvida', premio_centavos=v_a.valor_centavos WHERE id=v_a.id;
        INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
        VALUES (v_a.usuario_id,'devolucao_aposta',v_a.valor_centavos,v_novo_saldo,v_a.id,'Sem ganhadores — devolução');
        INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
        VALUES (v_a.usuario_id,'devolucao','Aposta devolvida','Não houve ganhadores. Seu valor foi devolvido.','/perfil');
      END LOOP;
    ELSE
      UPDATE public.apostas SET status='perdeu', premio_centavos=0 WHERE partida_id=p_id AND status='ativa';
      SELECT id INTO v_proxima_id FROM public.partidas
        WHERE fase = v_p.fase AND status='agendada' AND data_hora > v_p.data_hora
        ORDER BY data_hora ASC LIMIT 1;
      IF v_proxima_id IS NOT NULL THEN
        UPDATE public.partidas SET bolo_acumulado_centavos = bolo_acumulado_centavos + v_bolo_bruto WHERE id = v_proxima_id;
      END IF;
      INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
        SELECT DISTINCT usuario_id,'acumulou','Sem ganhadores','O prêmio acumulou para a próxima partida da fase.','/perfil'
        FROM public.apostas WHERE partida_id=p_id;
    END IF;
  END IF;

  -- Apuração de placar exato
  SELECT COALESCE(SUM(valor_centavos),0) INTO v_bolo_placar
    FROM public.apostas_placar WHERE partida_id=p_id AND status='ativa';
  IF v_bolo_placar > 0 AND v_p.gols_casa IS NOT NULL AND v_p.gols_visitante IS NOT NULL THEN
    SELECT COALESCE(SUM(valor_centavos),0), COUNT(*) INTO v_total_g_placar, v_qtd_g_placar
      FROM public.apostas_placar WHERE partida_id=p_id AND status='ativa'
        AND gols_casa_palpite = v_p.gols_casa AND gols_visitante_palpite = v_p.gols_visitante;
    IF v_qtd_g_placar > 0 THEN
      SELECT usuario_id INTO v_maior_placar_id FROM public.apostas_placar
        WHERE partida_id=p_id AND status='ativa'
          AND gols_casa_palpite = v_p.gols_casa AND gols_visitante_palpite = v_p.gols_visitante
        ORDER BY valor_centavos DESC, created_at ASC LIMIT 1;
      FOR v_ap IN SELECT * FROM public.apostas_placar WHERE partida_id=p_id AND status='ativa'
          AND gols_casa_palpite = v_p.gols_casa AND gols_visitante_palpite = v_p.gols_visitante FOR UPDATE
      LOOP
        v_premio_placar := floor(v_ap.valor_centavos::numeric * v_bolo_placar / v_total_g_placar);
        v_dist_placar := v_dist_placar + v_premio_placar;
        UPDATE public.apostas_placar SET status='ganhou', premio_centavos=v_premio_placar WHERE id=v_ap.id;
      END LOOP;
      v_residuo_placar := v_bolo_placar - v_dist_placar;
      IF v_residuo_placar > 0 THEN
        UPDATE public.apostas_placar SET premio_centavos = premio_centavos + v_residuo_placar
          WHERE id = (SELECT id FROM public.apostas_placar
            WHERE partida_id=p_id AND status='ganhou' AND usuario_id=v_maior_placar_id
            ORDER BY valor_centavos DESC, created_at ASC LIMIT 1);
      END IF;
      FOR v_ap IN SELECT * FROM public.apostas_placar WHERE partida_id=p_id AND status='ganhou' LOOP
        UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_ap.premio_centavos
          WHERE id = v_ap.usuario_id RETURNING saldo_centavos INTO v_novo_saldo;
        INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
        VALUES (v_ap.usuario_id,'premio',v_ap.premio_centavos,v_novo_saldo,v_ap.id,'Prêmio de placar exato');
        INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
        VALUES (v_ap.usuario_id,'premio','Você acertou o placar! 🎯',
                'Você recebeu R$ ' || to_char(v_ap.premio_centavos::numeric/100,'FM999G999G990D00') || ' pelo placar exato.','/perfil');
      END LOOP;
      UPDATE public.apostas_placar SET status='perdeu', premio_centavos=0 WHERE partida_id=p_id AND status='ativa';
      v_resultado_placar := jsonb_build_object('status','apurado','bolo',v_bolo_placar,'distribuido',v_dist_placar+v_residuo_placar,'ganhadores',v_qtd_g_placar);
    ELSE
      FOR v_ap IN SELECT * FROM public.apostas_placar WHERE partida_id=p_id AND status='ativa' FOR UPDATE LOOP
        UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_ap.valor_centavos
          WHERE id = v_ap.usuario_id RETURNING saldo_centavos INTO v_novo_saldo;
        UPDATE public.apostas_placar SET status='devolvida', premio_centavos=v_ap.valor_centavos WHERE id=v_ap.id;
        INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
        VALUES (v_ap.usuario_id,'devolucao_aposta',v_ap.valor_centavos,v_novo_saldo,v_ap.id,'Placar exato sem ganhadores — devolução');
        INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
        VALUES (v_ap.usuario_id,'devolucao','Placar exato devolvido','Ninguém acertou o placar. Sua aposta foi devolvida.','/perfil');
      END LOOP;
      v_resultado_placar := jsonb_build_object('status','sem_ganhadores_devolvido','total',v_bolo_placar);
    END IF;
  END IF;

  IF v_qtd_g > 0 THEN
    RETURN jsonb_build_object('status','apurada','bolo_bruto',v_bolo_bruto,'taxa',v_taxa,
      'bolo_liquido',v_bolo_liq,'distribuido',v_distribuido + v_residuo,
      'ganhadores',v_qtd_g,'apostas',v_qtd_a,'placar',v_resultado_placar);
  ELSIF v_qtd_a = 0 AND v_bolo_acum = 0 THEN
    RETURN jsonb_build_object('status','sem_apostas','placar',v_resultado_placar);
  ELSIF v_cfg.politica_sem_ganhadores = 'devolver' THEN
    RETURN jsonb_build_object('status','sem_ganhadores_devolvido','total',v_bolo_bruto,'placar',v_resultado_placar);
  ELSE
    RETURN jsonb_build_object('status','sem_ganhadores_acumulado','acumulado',v_bolo_bruto,'proxima_partida_id',v_proxima_id,'placar',v_resultado_placar);
  END IF;
END; $function$;

-- ranking_filtrado: drop e recria com novo retorno
DROP FUNCTION IF EXISTS public.ranking_filtrado(text);
CREATE OR REPLACE FUNCTION public.ranking_filtrado(p_filtro text DEFAULT 'geral'::text)
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.apostas_placar;
