CREATE OR REPLACE FUNCTION public.cancelar_aposta(p_aposta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_aposta public.apostas%ROWTYPE;
  v_part public.partidas%ROWTYPE;
  v_saldo bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO v_aposta FROM public.apostas
    WHERE id = p_aposta_id AND usuario_id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aposta não encontrada'; END IF;
  IF v_aposta.status <> 'ativa' THEN RAISE EXCEPTION 'Aposta já apurada'; END IF;
  SELECT * INTO v_part FROM public.partidas WHERE id = v_aposta.partida_id;
  IF v_part.status <> 'agendada' OR v_part.data_hora - now() <= interval '60 minutes' THEN
    RAISE EXCEPTION 'Apostas já fechadas para esta partida'; END IF;
  UPDATE public.profiles SET saldo_centavos = saldo_centavos + v_aposta.valor_centavos
    WHERE id = v_user RETURNING saldo_centavos INTO v_saldo;
  INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
  VALUES (v_user, 'devolucao_aposta', v_aposta.valor_centavos, v_saldo, p_aposta_id, 'Cancelamento de aposta de vencedor');
  DELETE FROM public.apostas WHERE id = p_aposta_id;
END $$;