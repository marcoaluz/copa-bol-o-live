CREATE OR REPLACE FUNCTION public.preparar_para_sync_real()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_partidas_com_apostas int;
  v_partidas_apagadas int;
  v_selecoes_apagadas int;
BEGIN
  PERFORM public._assert_admin();

  SELECT COUNT(DISTINCT p.id) INTO v_partidas_com_apostas
  FROM public.partidas p
  WHERE EXISTS (SELECT 1 FROM public.apostas WHERE partida_id = p.id)
     OR EXISTS (SELECT 1 FROM public.apostas_placar WHERE partida_id = p.id);

  IF v_partidas_com_apostas > 0 THEN
    RAISE EXCEPTION 'Existem % partidas com apostas vinculadas. Não é possível resetar. Apure as apostas ou cancele primeiro.', v_partidas_com_apostas;
  END IF;

  DELETE FROM public.partidas WHERE id IS NOT NULL;
  GET DIAGNOSTICS v_partidas_apagadas = ROW_COUNT;

  DELETE FROM public.selecoes WHERE id IS NOT NULL;
  GET DIAGNOSTICS v_selecoes_apagadas = ROW_COUNT;

  INSERT INTO public.audit_log(usuario_id, fonte, acao, dados)
  VALUES (auth.uid(), 'manual', 'preparar_para_sync_real',
    jsonb_build_object(
      'partidas_apagadas', v_partidas_apagadas,
      'selecoes_apagadas', v_selecoes_apagadas
    ));

  RETURN jsonb_build_object(
    'partidas_apagadas', v_partidas_apagadas,
    'selecoes_apagadas', v_selecoes_apagadas
  );
END $function$;