
-- Helper: verifica se o usuário autenticado está autorizado
CREATE OR REPLACE FUNCTION public._assert_autorizado()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_email text; v_ok boolean;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.usuarios_autorizados
    WHERE email = lower(v_email)) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Acesso não autorizado para este bolão' USING ERRCODE='42501';
  END IF;
END $$;

-- criar_deposito
CREATE OR REPLACE FUNCTION public.criar_deposito(p_valor_centavos bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg public.config%ROWTYPE;
  v_total_mes bigint;
  v_codigo text;
  v_id uuid;
  v_user uuid := auth.uid();
  v_bloq boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000'; END IF;
  PERFORM public._assert_autorizado();
  SELECT * INTO v_cfg FROM public.config WHERE id = 1;
  SELECT bloqueado INTO v_bloq FROM public.profiles WHERE id = v_user;
  IF v_bloq THEN RAISE EXCEPTION 'Conta bloqueada — depósito indisponível'; END IF;
  IF v_cfg.manutencao_ativa THEN RAISE EXCEPTION 'Sistema em manutenção'; END IF;

  IF coalesce(v_cfg.chave_pix_admin,'') = '' THEN
    RAISE EXCEPTION 'Recebimento PIX ainda não configurado pelo organizador';
  END IF;

  IF p_valor_centavos < v_cfg.deposito_minimo_centavos THEN
    RAISE EXCEPTION 'Valor mínimo: R$ %', to_char(v_cfg.deposito_minimo_centavos::numeric/100,'FM999G990D00');
  END IF;
  IF p_valor_centavos > v_cfg.deposito_maximo_centavos THEN
    RAISE EXCEPTION 'Valor máximo: R$ %', to_char(v_cfg.deposito_maximo_centavos::numeric/100,'FM999G990D00');
  END IF;

  SELECT COALESCE(SUM(valor_centavos),0) INTO v_total_mes
    FROM public.depositos
    WHERE usuario_id = v_user
      AND status = 'confirmado'
      AND created_at >= date_trunc('month', now());

  IF v_total_mes + p_valor_centavos > v_cfg.deposito_maximo_mensal_centavos THEN
    RAISE EXCEPTION 'Limite mensal de depósito excedido (R$ %)',
      to_char(v_cfg.deposito_maximo_mensal_centavos::numeric/100,'FM999G990D00');
  END IF;

  LOOP
    v_codigo := 'BOLAO-' || upper(substring(md5(random()::text || clock_timestamp()::text),1,6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.depositos WHERE codigo_referencia = v_codigo);
  END LOOP;

  INSERT INTO public.depositos (usuario_id, valor_centavos, codigo_referencia)
  VALUES (v_user, p_valor_centavos, v_codigo)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'codigo_referencia', v_codigo,
    'valor_centavos', p_valor_centavos,
    'chave_pix', v_cfg.chave_pix_admin,
    'nome_recebedor', v_cfg.nome_admin_recebedor
  );
END $function$;

-- marcar_deposito_pago
CREATE OR REPLACE FUNCTION public.marcar_deposito_pago(p_deposito_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._assert_autorizado();
  UPDATE public.depositos
    SET status = 'aguardando_confirmacao', updated_at = now()
    WHERE id = p_deposito_id
      AND usuario_id = auth.uid()
      AND status = 'aguardando_pagamento';
  IF NOT FOUND THEN RAISE EXCEPTION 'Depósito não encontrado ou já processado'; END IF;

  INSERT INTO public.notificacoes(usuario_id, tipo, titulo, mensagem, link)
  SELECT usuario_id, 'deposito_aguardando', 'Depósito enviado',
         'Aguardando confirmação do organizador. Você será avisado quando o saldo for liberado.',
         '/carteira'
  FROM public.depositos WHERE id = p_deposito_id;
END $function$;

-- criar_ou_alterar_aposta
CREATE OR REPLACE FUNCTION public.criar_ou_alterar_aposta(p_partida_id uuid, p_palpite palpite_aposta, p_valor_centavos bigint)
 RETURNS apostas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_partida public.partidas%ROWTYPE;
  v_aposta_atual public.apostas%ROWTYPE;
  v_saldo bigint; v_saldo_efetivo bigint; v_resultado public.apostas; v_novo_saldo bigint;
  v_cfg public.config%ROWTYPE; v_bloq boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000'; END IF;
  PERFORM public._assert_autorizado();
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

-- resgatar_bonus
CREATE OR REPLACE FUNCTION public.resgatar_bonus(p_tipo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_valor bigint;
  v_intervalo interval;
  v_descricao text;
  v_ultimo timestamptz;
  v_proximo timestamptz;
  v_novo_saldo bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  PERFORM public._assert_autorizado();

  IF p_tipo = 'diario' THEN
    v_valor := 5000; v_intervalo := interval '24 hours'; v_descricao := 'Bônus diário';
  ELSIF p_tipo = 'semanal' THEN
    v_valor := 20000; v_intervalo := interval '7 days'; v_descricao := 'Bônus semanal';
  ELSE
    RAISE EXCEPTION 'Tipo de bônus inválido';
  END IF;

  SELECT MAX(created_at) INTO v_ultimo
    FROM public.transacoes
    WHERE usuario_id = v_user AND tipo = 'bonus' AND descricao = v_descricao;

  IF v_ultimo IS NOT NULL AND v_ultimo + v_intervalo > now() THEN
    v_proximo := v_ultimo + v_intervalo;
    RETURN jsonb_build_object('ok', false, 'proximo_em', v_proximo);
  END IF;

  UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_valor
    WHERE id = v_user RETURNING saldo_centavos INTO v_novo_saldo;

  INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, descricao)
  VALUES (v_user, 'bonus', v_valor, v_novo_saldo, v_descricao);

  RETURN jsonb_build_object('ok', true, 'valor', v_valor, 'novo_saldo', v_novo_saldo);
END;
$function$;

-- solicitar_saque (procura função existente e adiciona check no início se existir)
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'solicitar_saque' AND pronamespace = 'public'::regnamespace LIMIT 1;
  IF v_src IS NOT NULL AND v_src NOT LIKE '%_assert_autorizado%' THEN
    EXECUTE replace(v_src, 'BEGIN', 'BEGIN' || E'\n  PERFORM public._assert_autorizado();');
  END IF;
END $$;
