
-- 1) external_id em partidas
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS external_id text UNIQUE;

-- 2) audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id uuid REFERENCES public.partidas(id) ON DELETE CASCADE,
  usuario_id uuid,
  fonte text NOT NULL CHECK (fonte IN ('manual','api','sistema')),
  acao text NOT NULL,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_partida ON public.audit_log(partida_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit admin leitura" ON public.audit_log;
CREATE POLICY "audit admin leitura" ON public.audit_log FOR SELECT USING (public.is_admin(auth.uid()));

-- 3) Reescreve lancar_resultado_partida com auditoria
CREATE OR REPLACE FUNCTION public.lancar_resultado_partida(p_id uuid, p_gols_casa int, p_gols_visitante int)
RETURNS public.partidas
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_p public.partidas%ROWTYPE; v_res public.resultado_partida;
BEGIN
  PERFORM public._assert_admin();
  IF p_gols_casa < 0 OR p_gols_visitante < 0 THEN RAISE EXCEPTION 'Gols não podem ser negativos'; END IF;
  v_res := CASE WHEN p_gols_casa > p_gols_visitante THEN 'casa'::public.resultado_partida
                WHEN p_gols_casa < p_gols_visitante THEN 'visitante'::public.resultado_partida
                ELSE 'empate'::public.resultado_partida END;
  UPDATE public.partidas
    SET gols_casa=p_gols_casa, gols_visitante=p_gols_visitante,
        resultado=v_res, status='encerrada', updated_at=now()
    WHERE id=p_id RETURNING * INTO v_p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  INSERT INTO public.audit_log (partida_id, usuario_id, fonte, acao, dados)
  VALUES (p_id, auth.uid(), 'manual', 'lancar_resultado',
    jsonb_build_object('gols_casa',p_gols_casa,'gols_visitante',p_gols_visitante,'resultado',v_res));
  RETURN v_p;
END; $$;

-- 4) Reescreve cancelar_partida com auditoria
CREATE OR REPLACE FUNCTION public.cancelar_partida(p_id uuid)
RETURNS public.partidas
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_p public.partidas%ROWTYPE;
BEGIN
  PERFORM public._assert_admin();
  UPDATE public.partidas SET status='cancelada', updated_at=now() WHERE id=p_id RETURNING * INTO v_p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida não encontrada'; END IF;
  INSERT INTO public.audit_log (partida_id, usuario_id, fonte, acao, dados)
  VALUES (p_id, auth.uid(), 'manual', 'cancelar_partida', '{}'::jsonb);
  PERFORM public.apurar_partida(p_id);
  SELECT * INTO v_p FROM public.partidas WHERE id=p_id;
  RETURN v_p;
END; $$;

-- 5) atualizar_partida_externa (chamada pelo sync)
CREATE OR REPLACE FUNCTION public.atualizar_partida_externa(
  p_external_id text,
  p_status public.status_partida,
  p_gols_casa int DEFAULT NULL,
  p_gols_visitante int DEFAULT NULL,
  p_dados jsonb DEFAULT '{}'::jsonb
)
RETURNS public.partidas
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_p public.partidas%ROWTYPE;
  v_old public.partidas%ROWTYPE;
  v_res public.resultado_partida;
  v_admin record;
BEGIN
  SELECT * INTO v_old FROM public.partidas WHERE external_id = p_external_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_old.status IN ('encerrada','cancelada') THEN
    -- Não sobrescreve partidas já finalizadas
    RETURN v_old;
  END IF;

  -- Se está encerrando: define resultado mas NÃO apura
  IF p_status = 'encerrada' AND p_gols_casa IS NOT NULL AND p_gols_visitante IS NOT NULL THEN
    v_res := CASE WHEN p_gols_casa > p_gols_visitante THEN 'casa'::public.resultado_partida
                  WHEN p_gols_casa < p_gols_visitante THEN 'visitante'::public.resultado_partida
                  ELSE 'empate'::public.resultado_partida END;
    UPDATE public.partidas
      SET gols_casa=p_gols_casa, gols_visitante=p_gols_visitante,
          resultado=v_res, status='encerrada', updated_at=now()
      WHERE id=v_old.id RETURNING * INTO v_p;

    -- Notifica admins
    FOR v_admin IN SELECT id FROM public.profiles WHERE is_admin = true LOOP
      INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
      VALUES (v_admin.id, 'partida_pronta_apuracao',
              'Partida encerrada — pronta para apuração',
              'O placar oficial chegou pela API. Revise e apure quando confirmado.',
              '/admin/partidas');
    END LOOP;
  ELSE
    UPDATE public.partidas
      SET status = COALESCE(p_status, v_old.status),
          gols_casa = COALESCE(p_gols_casa, v_old.gols_casa),
          gols_visitante = COALESCE(p_gols_visitante, v_old.gols_visitante),
          updated_at = now()
      WHERE id = v_old.id RETURNING * INTO v_p;
  END IF;

  INSERT INTO public.audit_log (partida_id, usuario_id, fonte, acao, dados)
  VALUES (v_p.id, NULL, 'api', 'sync_external',
          jsonb_build_object('antes', jsonb_build_object('status',v_old.status,'gc',v_old.gols_casa,'gv',v_old.gols_visitante),
                             'depois', jsonb_build_object('status',v_p.status,'gc',v_p.gols_casa,'gv',v_p.gols_visitante),
                             'payload', p_dados));
  RETURN v_p;
END; $$;

-- 6) Realtime na tabela partidas
ALTER TABLE public.partidas REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='partidas'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.partidas';
  END IF;
END $$;
