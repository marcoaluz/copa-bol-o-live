
CREATE OR REPLACE FUNCTION public.resgatar_bonus(p_tipo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.resgatar_bonus(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.resgatar_bonus(text) TO authenticated;
