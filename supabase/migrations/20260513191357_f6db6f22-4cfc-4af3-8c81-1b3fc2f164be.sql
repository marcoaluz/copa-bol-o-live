CREATE OR REPLACE FUNCTION public.apurar_partida(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    FROM public.apostas WHERE partida_id=p_id AND status='ativa' AND palpite::text=v_p.resultado::text;

  IF v_qtd_g > 0 THEN
    v_taxa := floor(v_bolo_bruto * v_cfg.taxa_casa_percentual / 100);
    v_bolo_liq := v_bolo_bruto - v_taxa;
    SELECT usuario_id INTO v_maior_id FROM public.apostas
      WHERE partida_id=p_id AND status='ativa' AND palpite::text=v_p.resultado::text
      ORDER BY valor_centavos DESC, created_at ASC LIMIT 1;
    FOR v_a IN SELECT * FROM public.apostas WHERE partida_id=p_id AND status='ativa' AND palpite::text=v_p.resultado::text FOR UPDATE LOOP
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