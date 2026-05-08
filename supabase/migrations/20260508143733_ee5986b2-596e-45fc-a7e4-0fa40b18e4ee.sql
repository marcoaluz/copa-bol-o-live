
-- ===== Schema =====
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS bolo_acumulado_centavos bigint NOT NULL DEFAULT 0;

CREATE TYPE public.politica_sem_ganhadores AS ENUM ('devolver','acumular');

CREATE TABLE public.config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  taxa_casa_percentual numeric(5,2) NOT NULL DEFAULT 10,
  politica_sem_ganhadores public.politica_sem_ganhadores NOT NULL DEFAULT 'devolver',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.config (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config leitura autenticados" ON public.config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "config update admin" ON public.config
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- transacoes.usuario_id pode ser NULL APENAS para taxa da casa (ajuste_admin)
ALTER TABLE public.transacoes ALTER COLUMN usuario_id DROP NOT NULL;
ALTER TABLE public.transacoes ADD CONSTRAINT transacoes_user_required_unless_casa
  CHECK (usuario_id IS NOT NULL OR tipo = 'ajuste_admin');

-- Notificações
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  link text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notificacoes(usuario_id, lida, created_at DESC);
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif leitura propria" ON public.notificacoes
  FOR SELECT USING (auth.uid() = usuario_id);
CREATE POLICY "notif update propria" ON public.notificacoes
  FOR UPDATE USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

-- ===== Helper: assert admin (mas permite service_role: auth.uid() IS NULL) =====
CREATE OR REPLACE FUNCTION public._assert_admin() RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores' USING ERRCODE = '42501';
  END IF;
END; $$;

-- ===== Lançar resultado =====
CREATE OR REPLACE FUNCTION public.lancar_resultado_partida(
  p_id uuid, p_gols_casa int, p_gols_visitante int
) RETURNS public.partidas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p partidas%ROWTYPE; v_res resultado_partida;
BEGIN
  PERFORM public._assert_admin();
  IF p_gols_casa < 0 OR p_gols_visitante < 0 THEN
    RAISE EXCEPTION 'Gols não podem ser negativos';
  END IF;
  IF p_gols_casa > p_gols_visitante THEN v_res := 'casa';
  ELSIF p_gols_casa < p_gols_visitante THEN v_res := 'visitante';
  ELSE v_res := 'empate';
  END IF;
  UPDATE public.partidas
    SET gols_casa = p_gols_casa, gols_visitante = p_gols_visitante,
        resultado = v_res, status = 'encerrada', updated_at = now()
    WHERE id = p_id RETURNING * INTO v_p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  RETURN v_p;
END; $$;

-- ===== Cancelar partida (sem distribuição, devolve apostas) =====
CREATE OR REPLACE FUNCTION public.cancelar_partida(p_id uuid)
RETURNS public.partidas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_p partidas%ROWTYPE;
BEGIN
  PERFORM public._assert_admin();
  UPDATE public.partidas SET status='cancelada', updated_at=now() WHERE id=p_id RETURNING * INTO v_p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  PERFORM public.apurar_partida(p_id);
  SELECT * INTO v_p FROM public.partidas WHERE id = p_id;
  RETURN v_p;
END; $$;

-- ===== Apurar partida =====
CREATE OR REPLACE FUNCTION public.apurar_partida(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p partidas%ROWTYPE; v_cfg config%ROWTYPE;
  v_bolo_bruto bigint := 0; v_bolo_acum bigint := 0;
  v_taxa bigint := 0; v_bolo_liq bigint := 0;
  v_total_g bigint := 0; v_qtd_g int := 0; v_qtd_a int := 0;
  v_distribuido bigint := 0; v_residuo bigint := 0;
  v_premio bigint; v_a record; v_maior_id uuid; v_proxima_id uuid;
  v_novo_saldo bigint;
BEGIN
  PERFORM public._assert_admin();
  SELECT * INTO v_cfg FROM public.config WHERE id = 1;
  SELECT * INTO v_p FROM public.partidas WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;

  v_bolo_acum := COALESCE(v_p.bolo_acumulado_centavos, 0);

  -- ===== Cancelada: devolve todas as apostas ativas =====
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
    RETURN jsonb_build_object('status','cancelada');
  END IF;

  -- Validações para apuração regular
  IF v_p.status <> 'encerrada' THEN
    RAISE EXCEPTION 'Lance o resultado da partida antes de apurar';
  END IF;
  IF v_p.resultado IS NULL THEN RAISE EXCEPTION 'Resultado não definido'; END IF;
  IF EXISTS (SELECT 1 FROM public.apostas WHERE partida_id=p_id AND status IN ('ganhou','perdeu','devolvida')) THEN
    RAISE EXCEPTION 'Partida já foi apurada';
  END IF;

  SELECT COALESCE(SUM(valor_centavos),0), COUNT(*) INTO v_bolo_bruto, v_qtd_a
    FROM public.apostas WHERE partida_id=p_id AND status='ativa';
  v_bolo_bruto := v_bolo_bruto + v_bolo_acum;

  SELECT COALESCE(SUM(valor_centavos),0), COUNT(*) INTO v_total_g, v_qtd_g
    FROM public.apostas WHERE partida_id=p_id AND status='ativa' AND palpite=v_p.resultado;

  IF v_qtd_a = 0 AND v_bolo_acum = 0 THEN
    RETURN jsonb_build_object('status','sem_apostas');
  END IF;

  -- ===== Há ganhadores =====
  IF v_qtd_g > 0 THEN
    v_taxa := floor(v_bolo_bruto * v_cfg.taxa_casa_percentual / 100);
    v_bolo_liq := v_bolo_bruto - v_taxa;

    -- maior apostador entre ganhadores (desempate por created_at ASC)
    SELECT usuario_id INTO v_maior_id
      FROM public.apostas WHERE partida_id=p_id AND status='ativa' AND palpite=v_p.resultado
      ORDER BY valor_centavos DESC, created_at ASC LIMIT 1;

    FOR v_a IN SELECT * FROM public.apostas WHERE partida_id=p_id AND status='ativa' AND palpite=v_p.resultado FOR UPDATE LOOP
      v_premio := floor(v_a.valor_centavos::numeric * v_bolo_liq / v_total_g);
      v_distribuido := v_distribuido + v_premio;
      UPDATE public.apostas SET status='ganhou', premio_centavos=v_premio WHERE id=v_a.id;
    END LOOP;

    v_residuo := v_bolo_liq - v_distribuido;
    IF v_residuo > 0 THEN
      UPDATE public.apostas
        SET premio_centavos = premio_centavos + v_residuo
        WHERE id = (
          SELECT id FROM public.apostas
            WHERE partida_id=p_id AND status='ganhou' AND usuario_id=v_maior_id
            ORDER BY valor_centavos DESC, created_at ASC LIMIT 1
        );
    END IF;

    -- credita ganhadores e gera transação/notificação
    FOR v_a IN SELECT * FROM public.apostas WHERE partida_id=p_id AND status='ganhou' LOOP
      UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_a.premio_centavos
        WHERE id = v_a.usuario_id RETURNING saldo_centavos INTO v_novo_saldo;
      INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
      VALUES (v_a.usuario_id,'premio',v_a.premio_centavos,v_novo_saldo,v_a.id,'Prêmio de aposta');
      INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
      VALUES (v_a.usuario_id,'premio','Você ganhou! 🏆',
              'Você recebeu R$ ' || to_char(v_a.premio_centavos::numeric/100,'FM999G999G990D00') || ' pela sua aposta.',
              '/perfil');
    END LOOP;

    -- perdedores
    UPDATE public.apostas SET status='perdeu', premio_centavos=0
      WHERE partida_id=p_id AND status='ativa';
    INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
      SELECT usuario_id,'aposta_perdida','Resultado da partida','Sua aposta não foi premiada desta vez.','/perfil'
      FROM public.apostas WHERE partida_id=p_id AND status='perdeu';

    -- taxa da casa
    IF v_taxa > 0 THEN
      INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
      VALUES (NULL,'ajuste_admin',-v_taxa,0,p_id,'Taxa da casa');
    END IF;

    RETURN jsonb_build_object(
      'status','apurada','bolo_bruto',v_bolo_bruto,'taxa',v_taxa,
      'bolo_liquido',v_bolo_liq,'distribuido',v_distribuido + v_residuo,
      'ganhadores',v_qtd_g,'apostas',v_qtd_a
    );
  END IF;

  -- ===== Sem ganhadores =====
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
    RETURN jsonb_build_object('status','sem_ganhadores_devolvido','total',v_bolo_bruto);
  ELSE
    -- acumular
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
    RETURN jsonb_build_object('status','sem_ganhadores_acumulado','acumulado',v_bolo_bruto,'proxima_partida_id',v_proxima_id);
  END IF;
END; $$;

-- ===== Marcar notificações lidas =====
CREATE OR REPLACE FUNCTION public.marcar_notificacoes_lidas(p_ids uuid[] DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.notificacoes SET lida = true
    WHERE usuario_id = auth.uid() AND lida = false
      AND (p_ids IS NULL OR id = ANY(p_ids));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- ===== Permissões =====
REVOKE EXECUTE ON FUNCTION public.lancar_resultado_partida(uuid,int,int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_partida(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apurar_partida(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lancar_resultado_partida(uuid,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_partida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apurar_partida(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_notificacoes_lidas(uuid[]) TO authenticated;

-- ===== Realtime =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.apostas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.partidas;

-- ===== Função de auto-teste de integração (admin only) =====
CREATE OR REPLACE FUNCTION public._self_test_apuracao()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_taxa_orig numeric;
  v_pol_orig politica_sem_ganhadores;
  v_part_id uuid; v_sel_a uuid; v_sel_b uuid;
  u1 uuid; u2 uuid; u3 uuid;
  v_apurar jsonb; v_a apostas%ROWTYPE;
  v_pass bool; v_msg text; v_obtido jsonb;
  v_total_devolvido bigint;
BEGIN
  PERFORM public._assert_admin();
  -- Snapshot config
  SELECT taxa_casa_percentual, politica_sem_ganhadores INTO v_taxa_orig, v_pol_orig FROM config WHERE id=1;

  -- ============== Caso 1: 1 ganhador único, taxa 10% → 90% do bolo ==============
  -- Setup
  UPDATE config SET taxa_casa_percentual=10, politica_sem_ganhadores='devolver' WHERE id=1;
  INSERT INTO selecoes (nome, codigo_iso) VALUES ('TestA','T1A') RETURNING id INTO v_sel_a;
  INSERT INTO selecoes (nome, codigo_iso) VALUES ('TestB','T1B') RETURNING id INTO v_sel_b;
  INSERT INTO partidas (fase, selecao_casa_id, selecao_visitante_id, data_hora, status)
    VALUES ('grupos', v_sel_a, v_sel_b, now() + interval '10 days', 'agendada') RETURNING id INTO v_part_id;
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst1u1',100000) RETURNING id INTO u1;
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst1u2',100000) RETURNING id INTO u2;
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u1,v_part_id,'casa',1000); -- ganhador
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u2,v_part_id,'visitante',9000); -- perdedor
  PERFORM lancar_resultado_partida(v_part_id, 2, 1);
  v_apurar := apurar_partida(v_part_id);
  -- bolo = 10000, taxa 10% = 1000, liq = 9000, único ganhador recebe 9000 (90% do bolo)
  SELECT premio_centavos INTO v_obtido FROM (SELECT to_jsonb(premio_centavos) AS premio_centavos FROM apostas WHERE partida_id=v_part_id AND status='ganhou') x;
  v_pass := (v_apurar->>'distribuido')::bigint = 9000 AND (v_apurar->>'taxa')::bigint = 1000;
  v_results := v_results || jsonb_build_object(
    'caso',1,'descricao','1 ganhador, taxa 10% → 90% do bolo',
    'pass',v_pass,'esperado','distribuido=9000 taxa=1000',
    'obtido',v_apurar);
  -- cleanup
  DELETE FROM transacoes WHERE referencia_id IN (SELECT id FROM apostas WHERE partida_id=v_part_id) OR referencia_id=v_part_id;
  DELETE FROM notificacoes WHERE usuario_id IN (u1,u2);
  DELETE FROM apostas WHERE partida_id=v_part_id;
  DELETE FROM partidas WHERE id=v_part_id;
  DELETE FROM profiles WHERE id IN (u1,u2);
  DELETE FROM selecoes WHERE id IN (v_sel_a,v_sel_b);

  -- ============== Caso 2: 3 ganhadores 5/100/20, bolo 2100, taxa 0% → 84/1680/336 ==============
  UPDATE config SET taxa_casa_percentual=0 WHERE id=1;
  INSERT INTO selecoes (nome, codigo_iso) VALUES ('TestC','T2A') RETURNING id INTO v_sel_a;
  INSERT INTO selecoes (nome, codigo_iso) VALUES ('TestD','T2B') RETURNING id INTO v_sel_b;
  INSERT INTO partidas (fase, selecao_casa_id, selecao_visitante_id, data_hora, status)
    VALUES ('grupos', v_sel_a, v_sel_b, now() + interval '10 days', 'agendada') RETURNING id INTO v_part_id;
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst2u1',100000) RETURNING id INTO u1;
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst2u2',100000) RETURNING id INTO u2;
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst2u3',100000) RETURNING id INTO u3;
  -- 3 ganhadores: 500 / 10000 / 2000
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u1,v_part_id,'casa',500);
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u2,v_part_id,'casa',10000);
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u3,v_part_id,'casa',2000);
  -- perdedores totalizando 197500 → bolo total 210000
  -- usar usuários extras
  DECLARE up uuid;
  BEGIN
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst2u4',1000000) RETURNING id INTO up;
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (up,v_part_id,'visitante',50000);
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (up,v_part_id,'visitante',50000) ON CONFLICT DO NOTHING;
    -- (1 aposta por usuário por partida; usar mais usuários)
    DELETE FROM apostas WHERE usuario_id=up AND partida_id=v_part_id;
    DELETE FROM profiles WHERE id=up;
    -- Criar 4 perdedores totalizando 197500
    FOR i IN 1..4 LOOP
      INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst2p'||i,1000000) RETURNING id INTO up;
      INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES
        (up,v_part_id,'visitante', CASE i WHEN 1 THEN 50000 WHEN 2 THEN 50000 WHEN 3 THEN 50000 ELSE 47500 END);
    END LOOP;
  END;
  PERFORM lancar_resultado_partida(v_part_id, 1, 0);
  v_apurar := apurar_partida(v_part_id);
  -- esperado: u1=8400 u2=168000 u3=33600
  v_pass := (
    (SELECT premio_centavos FROM apostas WHERE usuario_id=u1 AND partida_id=v_part_id) = 8400 AND
    (SELECT premio_centavos FROM apostas WHERE usuario_id=u2 AND partida_id=v_part_id) = 168000 AND
    (SELECT premio_centavos FROM apostas WHERE usuario_id=u3 AND partida_id=v_part_id) = 33600
  );
  v_results := v_results || jsonb_build_object(
    'caso',2,'descricao','3 ganhadores 5/100/20, bolo 2100, taxa 0%','pass',v_pass,
    'esperado','84,00 / 1680,00 / 336,00',
    'obtido', jsonb_build_object(
      'u1',(SELECT premio_centavos FROM apostas WHERE usuario_id=u1 AND partida_id=v_part_id),
      'u2',(SELECT premio_centavos FROM apostas WHERE usuario_id=u2 AND partida_id=v_part_id),
      'u3',(SELECT premio_centavos FROM apostas WHERE usuario_id=u3 AND partida_id=v_part_id),
      'apurar',v_apurar));
  -- cleanup
  DELETE FROM transacoes WHERE referencia_id IN (SELECT id FROM apostas WHERE partida_id=v_part_id) OR referencia_id=v_part_id;
  DELETE FROM notificacoes WHERE usuario_id IN (SELECT usuario_id FROM apostas WHERE partida_id=v_part_id);
  DELETE FROM profiles WHERE id IN (SELECT usuario_id FROM apostas WHERE partida_id=v_part_id);
  DELETE FROM apostas WHERE partida_id=v_part_id;
  DELETE FROM partidas WHERE id=v_part_id;
  DELETE FROM selecoes WHERE id IN (v_sel_a,v_sel_b);

  -- ============== Caso 3: 0 ganhadores, política devolver ==============
  UPDATE config SET taxa_casa_percentual=10, politica_sem_ganhadores='devolver' WHERE id=1;
  INSERT INTO selecoes (nome, codigo_iso) VALUES ('TestE','T3A') RETURNING id INTO v_sel_a;
  INSERT INTO selecoes (nome, codigo_iso) VALUES ('TestF','T3B') RETURNING id INTO v_sel_b;
  INSERT INTO partidas (fase, selecao_casa_id, selecao_visitante_id, data_hora, status)
    VALUES ('grupos', v_sel_a, v_sel_b, now() + interval '10 days', 'agendada') RETURNING id INTO v_part_id;
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst3u1',0) RETURNING id INTO u1;
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst3u2',0) RETURNING id INTO u2;
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u1,v_part_id,'casa',1500);
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (u2,v_part_id,'visitante',2500);
  PERFORM lancar_resultado_partida(v_part_id, 1, 1); -- empate → ninguém em mata-mata, mas é grupo: empate
  v_apurar := apurar_partida(v_part_id);
  v_pass := (v_apurar->>'status') = 'sem_ganhadores_devolvido'
    AND (SELECT saldo_centavos FROM profiles WHERE id=u1) = 1500
    AND (SELECT saldo_centavos FROM profiles WHERE id=u2) = 2500;
  v_results := v_results || jsonb_build_object(
    'caso',3,'descricao','0 ganhadores, política devolver','pass',v_pass,
    'esperado','u1 e u2 recebem valor de volta',
    'obtido',jsonb_build_object('u1_saldo',(SELECT saldo_centavos FROM profiles WHERE id=u1),
                                'u2_saldo',(SELECT saldo_centavos FROM profiles WHERE id=u2),
                                'apurar',v_apurar));
  -- cleanup
  DELETE FROM transacoes WHERE referencia_id IN (SELECT id FROM apostas WHERE partida_id=v_part_id) OR referencia_id=v_part_id;
  DELETE FROM notificacoes WHERE usuario_id IN (u1,u2);
  DELETE FROM apostas WHERE partida_id=v_part_id;
  DELETE FROM partidas WHERE id=v_part_id;
  DELETE FROM profiles WHERE id IN (u1,u2);
  DELETE FROM selecoes WHERE id IN (v_sel_a,v_sel_b);

  -- ============== Caso 4: arredondamento — bolo 100, 3 ganhadores iguais → 33,33+33,33+33,34 ==============
  UPDATE config SET taxa_casa_percentual=0 WHERE id=1;
  INSERT INTO selecoes (nome, codigo_iso) VALUES ('TestG','T4A') RETURNING id INTO v_sel_a;
  INSERT INTO selecoes (nome, codigo_iso) VALUES ('TestH','T4B') RETURNING id INTO v_sel_b;
  INSERT INTO partidas (fase, selecao_casa_id, selecao_visitante_id, data_hora, status)
    VALUES ('grupos', v_sel_a, v_sel_b, now() + interval '10 days', 'agendada') RETURNING id INTO v_part_id;
  -- 3 ganhadores iguais com valor 1000 cada (igual maior valor → tie-break created_at ASC, primeiro inserido)
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst4u1',0) RETURNING id INTO u1;
  PERFORM pg_sleep(0.01);
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst4u2',0) RETURNING id INTO u2;
  PERFORM pg_sleep(0.01);
  INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst4u3',0) RETURNING id INTO u3;
  -- bolo 10000 = 100,00 → todos apostam 10000/3 não é inteiro; ajuste: 3 apostam 1000 e 1 perdedor aposta 7000
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos,created_at) VALUES (u1,v_part_id,'casa',1000, now() - interval '3 minutes');
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos,created_at) VALUES (u2,v_part_id,'casa',1000, now() - interval '2 minutes');
  INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos,created_at) VALUES (u3,v_part_id,'casa',1000, now() - interval '1 minute');
  DECLARE up uuid;
  BEGIN
    INSERT INTO profiles (id, apelido, saldo_centavos) VALUES (gen_random_uuid(),'tst4p',1000000) RETURNING id INTO up;
    INSERT INTO apostas (usuario_id,partida_id,palpite,valor_centavos) VALUES (up,v_part_id,'visitante',7000);
  END;
  PERFORM lancar_resultado_partida(v_part_id, 2, 0);
  v_apurar := apurar_partida(v_part_id);
  -- bolo 10000, liq 10000, cada 1000*10000/3000 = floor(3333.33)=3333; resíduo 1 vai para o de maior valor (todos iguais → primeiro = u1)
  v_pass := (
    (SELECT premio_centavos FROM apostas WHERE usuario_id=u1 AND partida_id=v_part_id) = 3334 AND
    (SELECT premio_centavos FROM apostas WHERE usuario_id=u2 AND partida_id=v_part_id) = 3333 AND
    (SELECT premio_centavos FROM apostas WHERE usuario_id=u3 AND partida_id=v_part_id) = 3333
  );
  v_results := v_results || jsonb_build_object(
    'caso',4,'descricao','Arredondamento: bolo 100, 3 ganhadores iguais',
    'pass',v_pass,'esperado','33,34 / 33,33 / 33,33 (resíduo para o primeiro)',
    'obtido',jsonb_build_object(
      'u1',(SELECT premio_centavos FROM apostas WHERE usuario_id=u1 AND partida_id=v_part_id),
      'u2',(SELECT premio_centavos FROM apostas WHERE usuario_id=u2 AND partida_id=v_part_id),
      'u3',(SELECT premio_centavos FROM apostas WHERE usuario_id=u3 AND partida_id=v_part_id),
      'apurar',v_apurar));
  -- cleanup
  DELETE FROM transacoes WHERE referencia_id IN (SELECT id FROM apostas WHERE partida_id=v_part_id) OR referencia_id=v_part_id;
  DELETE FROM notificacoes WHERE usuario_id IN (SELECT usuario_id FROM apostas WHERE partida_id=v_part_id);
  DELETE FROM profiles WHERE id IN (SELECT usuario_id FROM apostas WHERE partida_id=v_part_id);
  DELETE FROM apostas WHERE partida_id=v_part_id;
  DELETE FROM partidas WHERE id=v_part_id;
  DELETE FROM selecoes WHERE id IN (v_sel_a,v_sel_b);

  -- restaura config
  UPDATE config SET taxa_casa_percentual=v_taxa_orig, politica_sem_ganhadores=v_pol_orig WHERE id=1;

  RETURN jsonb_build_object('passed', (SELECT COUNT(*) FILTER (WHERE (x->>'pass')::bool) FROM jsonb_array_elements(v_results) x),
                            'total', jsonb_array_length(v_results),
                            'results', v_results);
END; $$;

REVOKE EXECUTE ON FUNCTION public._self_test_apuracao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._self_test_apuracao() TO authenticated;
