ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS chave_pix_admin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS nome_admin_recebedor text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deposito_minimo_centavos bigint NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS deposito_maximo_centavos bigint NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS deposito_maximo_mensal_centavos bigint NOT NULL DEFAULT 200000;

CREATE TABLE public.depositos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  valor_centavos bigint NOT NULL CHECK (valor_centavos > 0),
  codigo_referencia text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'aguardando_pagamento'
    CHECK (status IN ('aguardando_pagamento','aguardando_confirmacao','confirmado','rejeitado','expirado')),
  confirmado_por_admin_id uuid REFERENCES public.profiles(id),
  confirmado_em timestamp with time zone,
  observacao_admin text,
  motivo_rejeicao text,
  e2e_id_pix text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_depositos_usuario ON public.depositos(usuario_id, created_at DESC);
CREATE INDEX idx_depositos_status ON public.depositos(status, created_at DESC);

ALTER TABLE public.depositos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_read_depositos" ON public.depositos
  FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "admin_all_depositos" ON public.depositos
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE TRIGGER depositos_updated_at
  BEFORE UPDATE ON public.depositos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.criar_deposito(p_valor_centavos bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg public.config%ROWTYPE;
  v_total_mes bigint;
  v_codigo text;
  v_id uuid;
  v_user uuid := auth.uid();
  v_bloq boolean;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000'; END IF;
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
END $$;

CREATE OR REPLACE FUNCTION public.marcar_deposito_pago(p_deposito_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
END $$;

CREATE OR REPLACE FUNCTION public.processar_deposito(
  p_deposito_id uuid,
  p_acao text,
  p_motivo text DEFAULT NULL,
  p_e2e_id text DEFAULT NULL,
  p_observacao text DEFAULT NULL
) RETURNS public.depositos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_dep public.depositos;
  v_novo_saldo bigint;
BEGIN
  PERFORM public._assert_admin();
  IF v_admin IS NULL OR NOT public.is_admin(v_admin) THEN
    RAISE EXCEPTION 'Apenas administradores' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_dep FROM public.depositos WHERE id = p_deposito_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Depósito não encontrado'; END IF;
  IF v_dep.status NOT IN ('aguardando_pagamento','aguardando_confirmacao') THEN
    RAISE EXCEPTION 'Depósito já processado (status: %)', v_dep.status;
  END IF;

  IF p_acao = 'confirmar' THEN
    UPDATE public.profiles
      SET saldo_centavos = saldo_centavos + v_dep.valor_centavos
      WHERE id = v_dep.usuario_id
      RETURNING saldo_centavos INTO v_novo_saldo;

    UPDATE public.depositos SET
      status='confirmado', confirmado_por_admin_id=v_admin, confirmado_em=now(),
      e2e_id_pix=p_e2e_id, observacao_admin=p_observacao, updated_at=now()
      WHERE id = p_deposito_id RETURNING * INTO v_dep;

    INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
    VALUES (v_dep.usuario_id,'deposito',v_dep.valor_centavos,v_novo_saldo,p_deposito_id,
            'Depósito PIX confirmado · ' || v_dep.codigo_referencia);

    INSERT INTO public.notificacoes(usuario_id, tipo, titulo, mensagem, link)
    VALUES (v_dep.usuario_id,'deposito_confirmado','Depósito confirmado ✅',
            'R$ ' || to_char(v_dep.valor_centavos::numeric/100,'FM999G990D00') ||
            ' creditados na sua carteira.','/carteira');

  ELSIF p_acao = 'rejeitar' THEN
    IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
      RAISE EXCEPTION 'Motivo obrigatório (mín. 3 caracteres)';
    END IF;
    UPDATE public.depositos SET
      status='rejeitado', confirmado_por_admin_id=v_admin, confirmado_em=now(),
      motivo_rejeicao=p_motivo, observacao_admin=p_observacao, updated_at=now()
      WHERE id = p_deposito_id RETURNING * INTO v_dep;

    INSERT INTO public.notificacoes(usuario_id, tipo, titulo, mensagem, link)
    VALUES (v_dep.usuario_id,'deposito_rejeitado','Depósito recusado',
            'Motivo: ' || p_motivo,'/carteira');
  ELSE
    RAISE EXCEPTION 'Ação inválida: use confirmar ou rejeitar';
  END IF;

  INSERT INTO public.audit_log(usuario_id, fonte, acao, dados)
  VALUES (v_admin,'manual','processar_deposito',
          jsonb_build_object('deposito_id',p_deposito_id,'acao',p_acao,
                             'motivo',p_motivo,'e2e_id',p_e2e_id,
                             'depois',to_jsonb(v_dep)));
  RETURN v_dep;
END $$;