
ALTER TABLE public.partidas 
  ADD COLUMN IF NOT EXISTS api_fixture_id bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS sincronizada_em timestamp with time zone;

ALTER TABLE public.selecoes
  ADD COLUMN IF NOT EXISTS api_team_id bigint UNIQUE;

ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS api_football_league_id int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS api_football_season int NOT NULL DEFAULT 2026,
  ADD COLUMN IF NOT EXISTS api_football_sync_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS api_football_ultimo_sync timestamp with time zone,
  ADD COLUMN IF NOT EXISTS api_football_ultimo_erro text;

CREATE TABLE IF NOT EXISTS public.api_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte text NOT NULL DEFAULT 'api-football',
  iniciado_em timestamp with time zone NOT NULL DEFAULT now(),
  finalizado_em timestamp with time zone,
  status text NOT NULL DEFAULT 'em_andamento' 
    CHECK (status IN ('em_andamento','sucesso','falha','parcial')),
  partidas_inseridas int NOT NULL DEFAULT 0,
  partidas_atualizadas int NOT NULL DEFAULT 0,
  selecoes_inseridas int NOT NULL DEFAULT 0,
  selecoes_atualizadas int NOT NULL DEFAULT 0,
  requests_consumidos int NOT NULL DEFAULT 0,
  erro text,
  detalhes jsonb
);

CREATE INDEX IF NOT EXISTS idx_api_sync_log_data ON public.api_sync_log(iniciado_em DESC);

ALTER TABLE public.api_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_sync_log" ON public.api_sync_log;
CREATE POLICY "admin_read_sync_log" ON public.api_sync_log
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.preparar_para_sync_real()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public AS $$
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

  DELETE FROM public.partidas;
  GET DIAGNOSTICS v_partidas_apagadas = ROW_COUNT;
  
  DELETE FROM public.selecoes;
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
END $$;

GRANT EXECUTE ON FUNCTION public.preparar_para_sync_real() TO authenticated;
