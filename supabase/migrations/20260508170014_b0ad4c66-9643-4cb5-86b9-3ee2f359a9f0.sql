
CREATE TYPE tipo_chave_pix AS ENUM ('cpf','email','telefone','aleatoria');
CREATE TYPE status_saque AS ENUM ('pendente','pago','rejeitado','cancelado');

CREATE TABLE public.saques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  valor_centavos bigint NOT NULL CHECK (valor_centavos >= 2000),
  chave_pix text NOT NULL,
  tipo_chave tipo_chave_pix NOT NULL,
  status status_saque NOT NULL DEFAULT 'pendente',
  admin_revisor_id uuid,
  motivo_rejeicao text,
  observacao_admin text,
  solicitado_em timestamptz NOT NULL DEFAULT now(),
  revisado_em timestamptz,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_saques_usuario ON public.saques(usuario_id, status);
CREATE INDEX idx_saques_pendentes ON public.saques(status, solicitado_em);

CREATE TRIGGER trg_saques_touch BEFORE UPDATE ON public.saques
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.saques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê próprios saques" ON public.saques FOR SELECT
  USING (auth.uid() = usuario_id);
CREATE POLICY "Admin lê todos saques" ON public.saques FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ============ Solicitar saque ============
CREATE OR REPLACE FUNCTION public.solicitar_saque(
  p_valor_centavos bigint,
  p_chave_pix text,
  p_tipo_chave tipo_chave_pix
) RETURNS saques
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_saldo bigint;
  v_novo_saldo bigint;
  v_saque saques;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='28000'; END IF;
  IF p_valor_centavos < 2000 THEN RAISE EXCEPTION 'Valor mínimo de saque é R$ 20,00'; END IF;
  IF length(trim(p_chave_pix)) < 4 THEN RAISE EXCEPTION 'Chave PIX inválida'; END IF;

  IF EXISTS (SELECT 1 FROM saques WHERE usuario_id = v_user AND status = 'pendente') THEN
    RAISE EXCEPTION 'Você já tem uma solicitação de acerto pendente';
  END IF;

  SELECT saldo_centavos INTO v_saldo FROM profiles WHERE id = v_user FOR UPDATE;
  IF v_saldo < p_valor_centavos THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  v_novo_saldo := v_saldo - p_valor_centavos;
  UPDATE profiles SET saldo_centavos = v_novo_saldo WHERE id = v_user;

  INSERT INTO saques (usuario_id, valor_centavos, chave_pix, tipo_chave)
  VALUES (v_user, p_valor_centavos, trim(p_chave_pix), p_tipo_chave)
  RETURNING * INTO v_saque;

  INSERT INTO transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
  VALUES (v_user, 'saque', -p_valor_centavos, v_novo_saldo, v_saque.id, 'Solicitação de acerto via PIX');

  INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link)
  VALUES (v_user, 'saque_solicitado', 'Solicitação registrada',
          'Seu pedido de acerto foi enviado. Aguarde a confirmação do admin.', '/carteira');

  RETURN v_saque;
END; $$;

REVOKE EXECUTE ON FUNCTION public.solicitar_saque(bigint, text, tipo_chave_pix) FROM anon;
GRANT EXECUTE ON FUNCTION public.solicitar_saque(bigint, text, tipo_chave_pix) TO authenticated;

-- ============ Processar saque (admin) ============
CREATE OR REPLACE FUNCTION public.processar_saque(
  p_saque_id uuid,
  p_acao text,           -- 'pagar' ou 'rejeitar'
  p_motivo text DEFAULT NULL,
  p_observacao text DEFAULT NULL
) RETURNS saques
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_old saques;
  v_new saques;
  v_novo_saldo bigint;
BEGIN
  PERFORM _assert_admin();
  IF v_admin IS NULL OR NOT is_admin(v_admin) THEN
    RAISE EXCEPTION 'Apenas administradores' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_old FROM saques WHERE id = p_saque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado'; END IF;
  IF v_old.status <> 'pendente' THEN
    RAISE EXCEPTION 'Saque já processado (status: %)', v_old.status;
  END IF;

  IF p_acao = 'pagar' THEN
    UPDATE saques
      SET status='pago', admin_revisor_id=v_admin, revisado_em=now(),
          pago_em=now(), observacao_admin=p_observacao
      WHERE id = p_saque_id RETURNING * INTO v_new;

    INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link)
    VALUES (v_old.usuario_id, 'saque_pago', 'Acerto realizado ✅',
            'O PIX de R$ ' || to_char(v_old.valor_centavos::numeric/100,'FM999G990D00') ||
            ' foi enviado para a chave informada.', '/carteira');

  ELSIF p_acao = 'rejeitar' THEN
    IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
      RAISE EXCEPTION 'Informe o motivo da rejeição';
    END IF;

    UPDATE profiles SET saldo_centavos = saldo_centavos + v_old.valor_centavos
      WHERE id = v_old.usuario_id RETURNING saldo_centavos INTO v_novo_saldo;

    UPDATE saques
      SET status='rejeitado', admin_revisor_id=v_admin, revisado_em=now(),
          motivo_rejeicao=p_motivo, observacao_admin=p_observacao
      WHERE id = p_saque_id RETURNING * INTO v_new;

    INSERT INTO transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
    VALUES (v_old.usuario_id, 'devolucao_saque', v_old.valor_centavos, v_novo_saldo, v_old.id,
            'Saque rejeitado — devolução: ' || p_motivo);

    INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link)
    VALUES (v_old.usuario_id, 'saque_rejeitado', 'Acerto recusado',
            'Motivo: ' || p_motivo || '. Seu saldo foi devolvido.', '/carteira');
  ELSE
    RAISE EXCEPTION 'Ação inválida: use pagar ou rejeitar';
  END IF;

  INSERT INTO audit_log (usuario_id, fonte, acao, dados)
  VALUES (v_admin, 'manual', 'processar_saque',
          jsonb_build_object('saque_id', p_saque_id, 'acao', p_acao,
                             'motivo', p_motivo, 'antes', to_jsonb(v_old), 'depois', to_jsonb(v_new)));
  RETURN v_new;
END; $$;

REVOKE EXECUTE ON FUNCTION public.processar_saque(uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_saque(uuid, text, text, text) TO authenticated;
