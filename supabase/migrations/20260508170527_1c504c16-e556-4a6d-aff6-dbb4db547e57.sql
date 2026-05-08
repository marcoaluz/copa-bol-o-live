
-- 1) Profiles: bloqueio
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bloqueado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueado_em timestamptz,
  ADD COLUMN IF NOT EXISTS bloqueado_motivo text;

-- 2) Config: limites e manutenção
ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS valor_minimo_aposta_centavos bigint NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS valor_maximo_aposta_centavos bigint NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS valor_minimo_saque_centavos bigint NOT NULL DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS valor_maximo_saque_diario_centavos bigint NOT NULL DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS manutencao_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manutencao_mensagem text;

-- Permite ler config publicamente (já era authenticated; mantemos)
-- 3) Bloquear / desbloquear
CREATE OR REPLACE FUNCTION public.bloquear_usuario(p_user_id uuid, p_motivo text)
RETURNS profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_admin uuid := auth.uid(); v_p profiles;
BEGIN
  PERFORM _assert_admin();
  IF v_admin IS NULL OR NOT is_admin(v_admin) THEN RAISE EXCEPTION 'Apenas administradores' USING ERRCODE='42501'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN RAISE EXCEPTION 'Informe motivo do bloqueio'; END IF;
  UPDATE profiles SET bloqueado=true, bloqueado_em=now(), bloqueado_motivo=p_motivo, updated_at=now()
    WHERE id=p_user_id RETURNING * INTO v_p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  INSERT INTO audit_log(usuario_id, fonte, acao, dados)
    VALUES (v_admin,'manual','bloquear_usuario', jsonb_build_object('alvo',p_user_id,'motivo',p_motivo));
  RETURN v_p;
END $$;

CREATE OR REPLACE FUNCTION public.desbloquear_usuario(p_user_id uuid)
RETURNS profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_admin uuid := auth.uid(); v_p profiles;
BEGIN
  PERFORM _assert_admin();
  IF v_admin IS NULL OR NOT is_admin(v_admin) THEN RAISE EXCEPTION 'Apenas administradores' USING ERRCODE='42501'; END IF;
  UPDATE profiles SET bloqueado=false, bloqueado_em=NULL, bloqueado_motivo=NULL, updated_at=now()
    WHERE id=p_user_id RETURNING * INTO v_p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  INSERT INTO audit_log(usuario_id, fonte, acao, dados)
    VALUES (v_admin,'manual','desbloquear_usuario', jsonb_build_object('alvo',p_user_id));
  RETURN v_p;
END $$;

-- 4) Ajuste de saldo manual
CREATE OR REPLACE FUNCTION public.ajustar_saldo_usuario(p_user_id uuid, p_delta_centavos bigint, p_motivo text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_admin uuid := auth.uid(); v_saldo_antes bigint; v_novo bigint;
BEGIN
  PERFORM _assert_admin();
  IF v_admin IS NULL OR NOT is_admin(v_admin) THEN RAISE EXCEPTION 'Apenas administradores' USING ERRCODE='42501'; END IF;
  IF p_delta_centavos = 0 THEN RAISE EXCEPTION 'Informe um valor diferente de zero'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN RAISE EXCEPTION 'Motivo obrigatório (mín. 5 caracteres)'; END IF;

  SELECT saldo_centavos INTO v_saldo_antes FROM profiles WHERE id=p_user_id FOR UPDATE;
  IF v_saldo_antes IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF v_saldo_antes + p_delta_centavos < 0 THEN RAISE EXCEPTION 'Ajuste deixaria saldo negativo'; END IF;

  v_novo := v_saldo_antes + p_delta_centavos;
  UPDATE profiles SET saldo_centavos=v_novo, updated_at=now() WHERE id=p_user_id;

  INSERT INTO transacoes(usuario_id, tipo, valor_centavos, saldo_apos_centavos, descricao)
    VALUES (p_user_id,'ajuste_admin', p_delta_centavos, v_novo, 'Ajuste admin: '||p_motivo);

  INSERT INTO audit_log(usuario_id, fonte, acao, dados)
    VALUES (v_admin,'manual','ajustar_saldo',
      jsonb_build_object('alvo',p_user_id,'delta',p_delta_centavos,'antes',v_saldo_antes,'depois',v_novo,'motivo',p_motivo));

  INSERT INTO notificacoes(usuario_id, tipo, titulo, mensagem, link)
    VALUES (p_user_id,'ajuste_saldo','Ajuste de saldo',
      'Seu saldo foi ajustado em R$ '||to_char(p_delta_centavos::numeric/100,'FM999G990D00')||'. Motivo: '||p_motivo, '/carteira');
  RETURN v_novo;
END $$;

-- 5) Dashboard stats
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v jsonb;
BEGIN
  PERFORM _assert_admin();
  SELECT jsonb_build_object(
    'usuarios_ativos', (SELECT COUNT(*) FROM profiles WHERE bloqueado=false),
    'usuarios_bloqueados', (SELECT COUNT(*) FROM profiles WHERE bloqueado=true),
    'total_custodia_centavos', (SELECT COALESCE(SUM(saldo_centavos),0) FROM profiles),
    'apostado_hoje', (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas WHERE created_at::date = current_date),
    'apostado_semana', (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas WHERE created_at >= now() - interval '7 days'),
    'apostado_mes', (SELECT COALESCE(SUM(valor_centavos),0) FROM apostas WHERE created_at >= now() - interval '30 days'),
    'taxa_acumulada_centavos', (SELECT COALESCE(SUM(-valor_centavos),0) FROM transacoes WHERE tipo='ajuste_admin' AND descricao='Taxa da casa'),
    'saques_pendentes_qtd', (SELECT COUNT(*) FROM saques WHERE status='pendente'),
    'saques_pendentes_total', (SELECT COALESCE(SUM(valor_centavos),0) FROM saques WHERE status='pendente')
  ) INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.admin_receita_diaria(p_dias int DEFAULT 30)
RETURNS TABLE(dia date, apostado bigint, premios bigint, taxa bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  WITH dias AS (
    SELECT generate_series(current_date - (p_dias-1), current_date, '1 day')::date AS dia
  )
  SELECT
    d.dia,
    COALESCE((SELECT SUM(a.valor_centavos) FROM apostas a WHERE a.created_at::date = d.dia),0)::bigint AS apostado,
    COALESCE((SELECT SUM(a.premio_centavos) FROM apostas a WHERE a.status='ganhou' AND a.updated_at::date = d.dia),0)::bigint AS premios,
    COALESCE((SELECT SUM(-t.valor_centavos) FROM transacoes t WHERE t.tipo='ajuste_admin' AND t.descricao='Taxa da casa' AND t.created_at::date = d.dia),0)::bigint AS taxa
  FROM dias d ORDER BY d.dia;
$$;

CREATE OR REPLACE FUNCTION public.admin_top_partidas(p_limite int DEFAULT 5)
RETURNS TABLE(partida_id uuid, codigo text, fase fase_partida, data_hora timestamptz, bolo_centavos bigint, qtd_apostas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT p.id, p.codigo, p.fase, p.data_hora,
    (COALESCE(p.bolo_acumulado_centavos,0) + COALESCE((SELECT SUM(valor_centavos) FROM apostas WHERE partida_id=p.id AND status='ativa'),0))::bigint AS bolo,
    (SELECT COUNT(*) FROM apostas WHERE partida_id=p.id)::bigint
  FROM partidas p
  WHERE p.status IN ('agendada','ao_vivo','encerrada')
  ORDER BY bolo DESC
  LIMIT p_limite;
$$;

-- 6) Aposta respeita config + manutencao + bloqueio
CREATE OR REPLACE FUNCTION public.criar_ou_alterar_aposta(p_partida_id uuid, p_palpite palpite_aposta, p_valor_centavos bigint)
 RETURNS apostas LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_partida public.partidas%ROWTYPE;
  v_aposta_atual public.apostas%ROWTYPE;
  v_saldo bigint; v_saldo_efetivo bigint; v_resultado public.apostas; v_novo_saldo bigint;
  v_cfg public.config%ROWTYPE; v_bloq boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_cfg FROM public.config WHERE id=1;
  IF v_cfg.manutencao_ativa THEN RAISE EXCEPTION 'Sistema em manutenção. Apostas temporariamente indisponíveis.'; END IF;

  SELECT bloqueado INTO v_bloq FROM profiles WHERE id=v_user;
  IF v_bloq THEN RAISE EXCEPTION 'Sua conta está bloqueada. Entre em contato com o admin.'; END IF;

  IF p_valor_centavos < v_cfg.valor_minimo_aposta_centavos OR p_valor_centavos > v_cfg.valor_maximo_aposta_centavos THEN
    RAISE EXCEPTION 'Valor da aposta deve estar entre R$ % e R$ %',
      to_char(v_cfg.valor_minimo_aposta_centavos::numeric/100,'FM999G990D00'),
      to_char(v_cfg.valor_maximo_aposta_centavos::numeric/100,'FM999G990D00');
  END IF;

  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  IF v_partida.status <> 'agendada' THEN RAISE EXCEPTION 'Esta partida não aceita mais apostas'; END IF;
  IF v_partida.data_hora - now() <= interval '60 minutes' THEN RAISE EXCEPTION 'Apostas encerradas: a partida começa em menos de 60 minutos'; END IF;
  IF v_partida.fase <> 'grupos' AND p_palpite = 'empate' THEN RAISE EXCEPTION 'Palpite "empate" não é permitido na fase de mata-mata'; END IF;
  IF v_partida.selecao_casa_id IS NULL OR v_partida.selecao_visitante_id IS NULL THEN RAISE EXCEPTION 'Times ainda não definidos'; END IF;

  SELECT saldo_centavos INTO v_saldo FROM public.profiles WHERE id = v_user FOR UPDATE;
  SELECT * INTO v_aposta_atual FROM public.apostas WHERE usuario_id=v_user AND partida_id=p_partida_id FOR UPDATE;
  v_saldo_efetivo := v_saldo + COALESCE(v_aposta_atual.valor_centavos,0);
  IF v_saldo_efetivo < p_valor_centavos THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  IF FOUND THEN
    v_novo_saldo := v_saldo + v_aposta_atual.valor_centavos;
    UPDATE public.profiles SET saldo_centavos=v_novo_saldo WHERE id=v_user;
    INSERT INTO public.transacoes(usuario_id,tipo,valor_centavos,saldo_apos_centavos,referencia_id,descricao)
      VALUES (v_user,'devolucao_aposta',v_aposta_atual.valor_centavos,v_novo_saldo,v_aposta_atual.id,'Alteração de aposta — devolução do valor anterior');
    v_saldo := v_novo_saldo;
    v_novo_saldo := v_saldo - p_valor_centavos;
    UPDATE public.profiles SET saldo_centavos=v_novo_saldo WHERE id=v_user;
    UPDATE public.apostas SET palpite=p_palpite, valor_centavos=p_valor_centavos, status='ativa', premio_centavos=NULL, updated_at=now()
      WHERE id=v_aposta_atual.id RETURNING * INTO v_resultado;
    INSERT INTO public.transacoes(usuario_id,tipo,valor_centavos,saldo_apos_centavos,referencia_id,descricao)
      VALUES (v_user,'aposta',-p_valor_centavos,v_novo_saldo,v_resultado.id,'Aposta alterada');
  ELSE
    v_novo_saldo := v_saldo - p_valor_centavos;
    UPDATE public.profiles SET saldo_centavos=v_novo_saldo WHERE id=v_user;
    INSERT INTO public.apostas(usuario_id,partida_id,palpite,valor_centavos)
      VALUES (v_user,p_partida_id,p_palpite,p_valor_centavos) RETURNING * INTO v_resultado;
    INSERT INTO public.transacoes(usuario_id,tipo,valor_centavos,saldo_apos_centavos,referencia_id,descricao)
      VALUES (v_user,'aposta',-p_valor_centavos,v_novo_saldo,v_resultado.id,'Nova aposta');
  END IF;
  RETURN v_resultado;
END $function$;

-- 7) Saque respeita config + bloqueio + limite diário
CREATE OR REPLACE FUNCTION public.solicitar_saque(p_valor_centavos bigint, p_chave_pix text, p_tipo_chave tipo_chave_pix)
 RETURNS saques LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_user uuid := auth.uid(); v_saldo bigint; v_novo_saldo bigint; v_saque saques;
  v_cfg public.config%ROWTYPE; v_bloq boolean; v_total_dia bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000'; END IF;
  SELECT * INTO v_cfg FROM public.config WHERE id=1;
  SELECT bloqueado INTO v_bloq FROM profiles WHERE id=v_user;
  IF v_bloq THEN RAISE EXCEPTION 'Conta bloqueada — saque indisponível'; END IF;

  IF p_valor_centavos < v_cfg.valor_minimo_saque_centavos THEN
    RAISE EXCEPTION 'Valor mínimo de saque é R$ %', to_char(v_cfg.valor_minimo_saque_centavos::numeric/100,'FM999G990D00');
  END IF;
  IF length(trim(p_chave_pix)) < 4 THEN RAISE EXCEPTION 'Chave PIX inválida'; END IF;

  IF EXISTS (SELECT 1 FROM saques WHERE usuario_id=v_user AND status='pendente') THEN
    RAISE EXCEPTION 'Você já tem uma solicitação de acerto pendente';
  END IF;

  SELECT COALESCE(SUM(valor_centavos),0) INTO v_total_dia FROM saques
    WHERE usuario_id=v_user AND status IN ('pendente','pago') AND solicitado_em::date = current_date;
  IF v_total_dia + p_valor_centavos > v_cfg.valor_maximo_saque_diario_centavos THEN
    RAISE EXCEPTION 'Limite diário de saque excedido (R$ %)', to_char(v_cfg.valor_maximo_saque_diario_centavos::numeric/100,'FM999G990D00');
  END IF;

  SELECT saldo_centavos INTO v_saldo FROM profiles WHERE id=v_user FOR UPDATE;
  IF v_saldo < p_valor_centavos THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  v_novo_saldo := v_saldo - p_valor_centavos;
  UPDATE profiles SET saldo_centavos=v_novo_saldo WHERE id=v_user;
  INSERT INTO saques(usuario_id, valor_centavos, chave_pix, tipo_chave)
    VALUES (v_user, p_valor_centavos, trim(p_chave_pix), p_tipo_chave) RETURNING * INTO v_saque;
  INSERT INTO transacoes(usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
    VALUES (v_user,'saque',-p_valor_centavos,v_novo_saldo,v_saque.id,'Solicitação de acerto via PIX');
  INSERT INTO notificacoes(usuario_id, tipo, titulo, mensagem, link)
    VALUES (v_user,'saque_solicitado','Solicitação registrada','Seu pedido de acerto foi enviado.','/carteira');
  RETURN v_saque;
END $function$;
