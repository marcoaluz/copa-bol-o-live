
CREATE OR REPLACE FUNCTION public._self_test_apuracao()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_taxa_orig numeric;
  v_pol_orig politica_sem_ganhadores;
  v_part_id uuid; v_sel_a uuid; v_sel_b uuid;
  u1 uuid; u2 uuid; u3 uuid;
  v_apurar jsonb;
  v_pass bool;
  v_torneio_id uuid;
BEGIN
  PERFORM public._assert_admin();

  -- Suprime triggers (incl. on_auth_user_created) durante o teste
  SET LOCAL session_replication_role = 'replica';

  -- Cleanup de execuções anteriores
  DELETE FROM public.partidas WHERE selecao_casa_id IN (SELECT id FROM public.selecoes WHERE codigo_iso ~ '^T[0-9][AB]$');
  DELETE FROM public.selecoes WHERE codigo_iso ~ '^T[0-9][AB]$';
  DELETE FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE apelido LIKE 'tst%');
  DELETE FROM public.profiles WHERE apelido LIKE 'tst%';

  SELECT id INTO v_torneio_id FROM torneios WHERE slug='copa-2026' LIMIT 1;
  SELECT taxa_casa_percentual, politica_sem_ganhadores INTO v_taxa_orig, v_pol_orig FROM config WHERE id=1;

  BEGIN
    -- Caso 1
    UPDATE config SET taxa_casa_percentual=10, politica_sem_ganhadores='devolver' WHERE id=1;
    INSERT INTO selecoes (nome, codigo_iso, torneio_id) VALUES ('TestA','T1A', v_torneio_id) RETURNING id INTO v_sel_a;
    INSERT INTO selecoes (nome, codigo_iso, torneio_id) VALUES ('TestB','T1B', v_torneio_id) RETURNING id INTO v_sel_b;
    INSERT INTO partidas (fase, selecao_casa_id, selecao_visitante_id, data_hora, status, torneio_id)
      VALUES ('grupos', v_sel_a, v_sel_b, now() + interval '10 days', 'agendada', v_torneio_id) RETURNING id INTO v_part_id;
    u1 := gen_random_uuid(); u2 := gen_random_uuid();
    INSERT INTO auth.users (id) VALUES (u1);
    INSERT INTO auth.users (id) VALUES (u2);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u1, 'tst1u1_' || substr(u1::text,1,8), 100000);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u2, 'tst1u2_' || substr(u2::text,1,8), 100000);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u1,v_part_id,'casa',1000);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u2,v_part_id,'visitante',9000);
    PERFORM lancar_resultado_partida(v_part_id, 2, 1);
    v_apurar := apurar_partida(v_part_id);
    v_pass := (v_apurar->>'distribuido')::bigint = 9000 AND (v_apurar->>'taxa')::bigint = 1000;
    v_results := v_results || jsonb_build_object('caso',1,'descricao','1 ganhador, taxa 10% → 90% do bolo','pass',v_pass,'esperado','distribuido=9000 taxa=1000','obtido',v_apurar);
    DELETE FROM transacoes WHERE referencia_id IN (SELECT id FROM apostas WHERE partida_id=v_part_id) OR referencia_id=v_part_id;
    DELETE FROM notificacoes WHERE usuario_id IN (u1,u2);
    DELETE FROM apostas WHERE partida_id=v_part_id;
    DELETE FROM partidas WHERE id=v_part_id;
    DELETE FROM auth.users WHERE id IN (u1,u2);
    DELETE FROM selecoes WHERE id IN (v_sel_a,v_sel_b);

    -- Caso 2
    UPDATE config SET taxa_casa_percentual=0 WHERE id=1;
    INSERT INTO selecoes (nome, codigo_iso, torneio_id) VALUES ('TestC','T2A', v_torneio_id) RETURNING id INTO v_sel_a;
    INSERT INTO selecoes (nome, codigo_iso, torneio_id) VALUES ('TestD','T2B', v_torneio_id) RETURNING id INTO v_sel_b;
    INSERT INTO partidas (fase, selecao_casa_id, selecao_visitante_id, data_hora, status, torneio_id)
      VALUES ('grupos', v_sel_a, v_sel_b, now() + interval '10 days', 'agendada', v_torneio_id) RETURNING id INTO v_part_id;
    u1 := gen_random_uuid(); u2 := gen_random_uuid(); u3 := gen_random_uuid();
    INSERT INTO auth.users (id) VALUES (u1),(u2),(u3);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u1, 'tst2u1_' || substr(u1::text,1,8), 100000);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u2, 'tst2u2_' || substr(u2::text,1,8), 100000);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u3, 'tst2u3_' || substr(u3::text,1,8), 100000);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u1,v_part_id,'casa',500);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u2,v_part_id,'casa',10000);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u3,v_part_id,'casa',2000);
    DECLARE up uuid;
    BEGIN
      FOR i IN 1..4 LOOP
        up := gen_random_uuid();
        INSERT INTO auth.users (id) VALUES (up);
        INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (up, 'tst2p_' || substr(up::text,1,8) || i, 1000000);
        INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES
          (up,v_part_id,'visitante', CASE i WHEN 1 THEN 50000 WHEN 2 THEN 50000 WHEN 3 THEN 50000 ELSE 47500 END);
      END LOOP;
    END;
    PERFORM lancar_resultado_partida(v_part_id, 1, 0);
    v_apurar := apurar_partida(v_part_id);
    v_pass := (
      (SELECT premio_centavos FROM apostas WHERE usuario_id=u1 AND partida_id=v_part_id) = 8400 AND
      (SELECT premio_centavos FROM apostas WHERE usuario_id=u2 AND partida_id=v_part_id) = 168000 AND
      (SELECT premio_centavos FROM apostas WHERE usuario_id=u3 AND partida_id=v_part_id) = 33600
    );
    v_results := v_results || jsonb_build_object('caso',2,'descricao','3 ganhadores 5/100/20, bolo 2100, taxa 0%','pass',v_pass,'esperado','84,00 / 1680,00 / 336,00','obtido', jsonb_build_object('u1',(SELECT premio_centavos FROM apostas WHERE usuario_id=u1 AND partida_id=v_part_id),'u2',(SELECT premio_centavos FROM apostas WHERE usuario_id=u2 AND partida_id=v_part_id),'u3',(SELECT premio_centavos FROM apostas WHERE usuario_id=u3 AND partida_id=v_part_id),'apurar',v_apurar));
    DELETE FROM transacoes WHERE referencia_id IN (SELECT id FROM apostas WHERE partida_id=v_part_id) OR referencia_id=v_part_id;
    DELETE FROM notificacoes WHERE usuario_id IN (SELECT usuario_id FROM apostas WHERE partida_id=v_part_id);
    DELETE FROM auth.users WHERE id IN (SELECT usuario_id FROM apostas WHERE partida_id=v_part_id);
    DELETE FROM apostas WHERE partida_id=v_part_id;
    DELETE FROM partidas WHERE id=v_part_id;
    DELETE FROM selecoes WHERE id IN (v_sel_a,v_sel_b);

    -- Caso 3
    UPDATE config SET taxa_casa_percentual=10, politica_sem_ganhadores='devolver' WHERE id=1;
    INSERT INTO selecoes (nome, codigo_iso, torneio_id) VALUES ('TestE','T3A', v_torneio_id) RETURNING id INTO v_sel_a;
    INSERT INTO selecoes (nome, codigo_iso, torneio_id) VALUES ('TestF','T3B', v_torneio_id) RETURNING id INTO v_sel_b;
    INSERT INTO partidas (fase, selecao_casa_id, selecao_visitante_id, data_hora, status, torneio_id)
      VALUES ('grupos', v_sel_a, v_sel_b, now() + interval '10 days', 'agendada', v_torneio_id) RETURNING id INTO v_part_id;
    u1 := gen_random_uuid(); u2 := gen_random_uuid();
    INSERT INTO auth.users (id) VALUES (u1),(u2);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u1, 'tst3u1_' || substr(u1::text,1,8), 0);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u2, 'tst3u2_' || substr(u2::text,1,8), 0);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u1,v_part_id,'casa',1500);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u2,v_part_id,'visitante',2500);
    PERFORM lancar_resultado_partida(v_part_id, 1, 1);
    v_apurar := apurar_partida(v_part_id);
    v_pass := (v_apurar->>'status') = 'sem_ganhadores_devolvido'
      AND (SELECT saldo_centavos FROM profiles WHERE id=u1) = 1500
      AND (SELECT saldo_centavos FROM profiles WHERE id=u2) = 2500;
    v_results := v_results || jsonb_build_object('caso',3,'descricao','0 ganhadores, política devolver','pass',v_pass,'esperado','u1 e u2 recebem valor de volta','obtido',jsonb_build_object('u1_saldo',(SELECT saldo_centavos FROM profiles WHERE id=u1),'u2_saldo',(SELECT saldo_centavos FROM profiles WHERE id=u2),'apurar',v_apurar));
    DELETE FROM transacoes WHERE referencia_id IN (SELECT id FROM apostas WHERE partida_id=v_part_id) OR referencia_id=v_part_id;
    DELETE FROM notificacoes WHERE usuario_id IN (u1,u2);
    DELETE FROM apostas WHERE partida_id=v_part_id;
    DELETE FROM partidas WHERE id=v_part_id;
    DELETE FROM auth.users WHERE id IN (u1,u2);
    DELETE FROM selecoes WHERE id IN (v_sel_a,v_sel_b);

    -- Caso 4
    UPDATE config SET taxa_casa_percentual=0 WHERE id=1;
    INSERT INTO selecoes (nome, codigo_iso, torneio_id) VALUES ('TestG','T4A', v_torneio_id) RETURNING id INTO v_sel_a;
    INSERT INTO selecoes (nome, codigo_iso, torneio_id) VALUES ('TestH','T4B', v_torneio_id) RETURNING id INTO v_sel_b;
    INSERT INTO partidas (fase, selecao_casa_id, selecao_visitante_id, data_hora, status, torneio_id)
      VALUES ('grupos', v_sel_a, v_sel_b, now() + interval '10 days', 'agendada', v_torneio_id) RETURNING id INTO v_part_id;
    u1 := gen_random_uuid(); u2 := gen_random_uuid(); u3 := gen_random_uuid();
    INSERT INTO auth.users (id) VALUES (u1),(u2),(u3);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u1, 'tst4u1_' || substr(u1::text,1,8), 0);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u2, 'tst4u2_' || substr(u2::text,1,8), 0);
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (u3, 'tst4u3_' || substr(u3::text,1,8), 0);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos,created_at) VALUES (u1,v_part_id,'casa',1000, now() - interval '3 minutes');
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos,created_at) VALUES (u2,v_part_id,'casa',1000, now() - interval '2 minutes');
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos,created_at) VALUES (u3,v_part_id,'casa',1000, now() - interval '1 minute');
    DECLARE up uuid;
    BEGIN
      up := gen_random_uuid();
      INSERT INTO auth.users (id) VALUES (up);
      INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (up, 'tst4p_' || substr(up::text,1,8), 1000000);
      INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (up,v_part_id,'visitante',7000);
    END;
    PERFORM lancar_resultado_partida(v_part_id, 2, 0);
    v_apurar := apurar_partida(v_part_id);
    v_pass := (
      (SELECT premio_centavos FROM apostas WHERE usuario_id=u1 AND partida_id=v_part_id) = 3334 AND
      (SELECT premio_centavos FROM apostas WHERE usuario_id=u2 AND partida_id=v_part_id) = 3333 AND
      (SELECT premio_centavos FROM apostas WHERE usuario_id=u3 AND partida_id=v_part_id) = 3333
    );
    v_results := v_results || jsonb_build_object('caso',4,'descricao','Arredondamento: bolo 100, 3 ganhadores iguais','pass',v_pass,'esperado','33,34 / 33,33 / 33,33 (resíduo para o primeiro)','obtido',jsonb_build_object('u1',(SELECT premio_centavos FROM apostas WHERE usuario_id=u1 AND partida_id=v_part_id),'u2',(SELECT premio_centavos FROM apostas WHERE usuario_id=u2 AND partida_id=v_part_id),'u3',(SELECT premio_centavos FROM apostas WHERE usuario_id=u3 AND partida_id=v_part_id),'apurar',v_apurar));
    DELETE FROM transacoes WHERE referencia_id IN (SELECT id FROM apostas WHERE partida_id=v_part_id) OR referencia_id=v_part_id;
    DELETE FROM notificacoes WHERE usuario_id IN (SELECT usuario_id FROM apostas WHERE partida_id=v_part_id);
    DELETE FROM auth.users WHERE id IN (SELECT usuario_id FROM apostas WHERE partida_id=v_part_id);
    DELETE FROM apostas WHERE partida_id=v_part_id;
    DELETE FROM partidas WHERE id=v_part_id;
    DELETE FROM selecoes WHERE id IN (v_sel_a,v_sel_b);

  EXCEPTION WHEN OTHERS THEN
    -- Cleanup defensivo
    DELETE FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE apelido LIKE 'tst%');
    DELETE FROM public.profiles WHERE apelido LIKE 'tst%';
    DELETE FROM public.partidas WHERE selecao_casa_id IN (SELECT id FROM public.selecoes WHERE codigo_iso ~ '^T[0-9][AB]$');
    DELETE FROM public.selecoes WHERE codigo_iso ~ '^T[0-9][AB]$';
    UPDATE config SET taxa_casa_percentual=v_taxa_orig, politica_sem_ganhadores=v_pol_orig WHERE id=1;
    SET LOCAL session_replication_role = 'origin';
    RAISE;
  END;

  UPDATE config SET taxa_casa_percentual=v_taxa_orig, politica_sem_ganhadores=v_pol_orig WHERE id=1;

  SET LOCAL session_replication_role = 'origin';

  RETURN jsonb_build_object('passed', (SELECT COUNT(*) FILTER (WHERE (x->>'pass')::bool) FROM jsonb_array_elements(v_results) x),
                            'total', jsonb_array_length(v_results),
                            'results', v_results);
END; $function$;

REVOKE EXECUTE ON FUNCTION public._self_test_apuracao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._self_test_apuracao() TO authenticated;
