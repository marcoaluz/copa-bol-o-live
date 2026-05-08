
-- Enums
CREATE TYPE public.palpite_aposta AS ENUM ('casa','empate','visitante');
CREATE TYPE public.status_aposta AS ENUM ('ativa','ganhou','perdeu','devolvida');
CREATE TYPE public.tipo_transacao AS ENUM ('deposito','aposta','devolucao_aposta','premio','saque','ajuste_admin');

-- apostas
CREATE TABLE public.apostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partida_id uuid NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  palpite public.palpite_aposta NOT NULL,
  valor_centavos bigint NOT NULL CHECK (valor_centavos >= 200 AND valor_centavos <= 50000),
  status public.status_aposta NOT NULL DEFAULT 'ativa',
  premio_centavos bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, partida_id)
);

CREATE INDEX idx_apostas_usuario ON public.apostas(usuario_id);
CREATE INDEX idx_apostas_partida ON public.apostas(partida_id);

CREATE TRIGGER apostas_touch_updated
  BEFORE UPDATE ON public.apostas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Validation trigger: empate not allowed in knockout
CREATE OR REPLACE FUNCTION public.valida_palpite_aposta()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_fase fase_partida;
BEGIN
  SELECT fase INTO v_fase FROM public.partidas WHERE id = NEW.partida_id;
  IF v_fase IS NULL THEN
    RAISE EXCEPTION 'Partida não encontrada';
  END IF;
  IF v_fase <> 'grupos' AND NEW.palpite = 'empate' THEN
    RAISE EXCEPTION 'Palpite "empate" não é permitido na fase de mata-mata';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER apostas_valida_palpite
  BEFORE INSERT OR UPDATE ON public.apostas
  FOR EACH ROW EXECUTE FUNCTION public.valida_palpite_aposta();

ALTER TABLE public.apostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê próprias apostas"
  ON public.apostas FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Admin lê todas apostas"
  ON public.apostas FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Sem INSERT/UPDATE/DELETE direto: apenas via RPC SECURITY DEFINER

-- transacoes (livro-razão imutável)
CREATE TABLE public.transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo public.tipo_transacao NOT NULL,
  valor_centavos bigint NOT NULL,
  saldo_apos_centavos bigint NOT NULL,
  referencia_id uuid,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transacoes_usuario ON public.transacoes(usuario_id, created_at DESC);

ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário lê próprias transações"
  ON public.transacoes FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "Admin lê todas transações"
  ON public.transacoes FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Sem INSERT/UPDATE/DELETE: append-only via SECURITY DEFINER

-- Server time RPC
CREATE OR REPLACE FUNCTION public.agora_servidor()
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT now();
$$;
GRANT EXECUTE ON FUNCTION public.agora_servidor() TO anon, authenticated;

-- RPC criar_ou_alterar_aposta
CREATE OR REPLACE FUNCTION public.criar_ou_alterar_aposta(
  p_partida_id uuid,
  p_palpite public.palpite_aposta,
  p_valor_centavos bigint
)
RETURNS public.apostas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_partida public.partidas%ROWTYPE;
  v_aposta_atual public.apostas%ROWTYPE;
  v_saldo bigint;
  v_saldo_efetivo bigint;
  v_resultado public.apostas;
  v_novo_saldo bigint;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_valor_centavos < 200 OR p_valor_centavos > 50000 THEN
    RAISE EXCEPTION 'Valor da aposta deve estar entre R$ 2,00 e R$ 500,00';
  END IF;

  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada';
  END IF;

  IF v_partida.status <> 'agendada' THEN
    RAISE EXCEPTION 'Esta partida não aceita mais apostas';
  END IF;

  IF v_partida.data_hora - now() <= interval '60 minutes' THEN
    RAISE EXCEPTION 'Apostas encerradas: a partida começa em menos de 60 minutos';
  END IF;

  IF v_partida.fase <> 'grupos' AND p_palpite = 'empate' THEN
    RAISE EXCEPTION 'Palpite "empate" não é permitido na fase de mata-mata';
  END IF;

  IF v_partida.selecao_casa_id IS NULL OR v_partida.selecao_visitante_id IS NULL THEN
    RAISE EXCEPTION 'Times ainda não definidos para esta partida';
  END IF;

  -- Lock saldo do usuário
  SELECT saldo_centavos INTO v_saldo FROM public.profiles WHERE id = v_user FOR UPDATE;

  -- Aposta existente?
  SELECT * INTO v_aposta_atual
  FROM public.apostas
  WHERE usuario_id = v_user AND partida_id = p_partida_id
  FOR UPDATE;

  v_saldo_efetivo := v_saldo + COALESCE(v_aposta_atual.valor_centavos, 0);

  IF v_saldo_efetivo < p_valor_centavos THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  IF FOUND THEN
    -- Devolver valor anterior
    v_novo_saldo := v_saldo + v_aposta_atual.valor_centavos;
    UPDATE public.profiles SET saldo_centavos = v_novo_saldo WHERE id = v_user;
    INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
    VALUES (v_user, 'devolucao_aposta', v_aposta_atual.valor_centavos, v_novo_saldo, v_aposta_atual.id, 'Alteração de aposta — devolução do valor anterior');
    v_saldo := v_novo_saldo;

    -- Debitar novo valor
    v_novo_saldo := v_saldo - p_valor_centavos;
    UPDATE public.profiles SET saldo_centavos = v_novo_saldo WHERE id = v_user;
    UPDATE public.apostas
    SET palpite = p_palpite, valor_centavos = p_valor_centavos, status = 'ativa', premio_centavos = NULL, updated_at = now()
    WHERE id = v_aposta_atual.id
    RETURNING * INTO v_resultado;
    INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
    VALUES (v_user, 'aposta', -p_valor_centavos, v_novo_saldo, v_resultado.id, 'Aposta alterada');
  ELSE
    -- Debitar e inserir
    v_novo_saldo := v_saldo - p_valor_centavos;
    UPDATE public.profiles SET saldo_centavos = v_novo_saldo WHERE id = v_user;
    INSERT INTO public.apostas (usuario_id, partida_id, palpite, valor_centavos)
    VALUES (v_user, p_partida_id, p_palpite, p_valor_centavos)
    RETURNING * INTO v_resultado;
    INSERT INTO public.transacoes (usuario_id, tipo, valor_centavos, saldo_apos_centavos, referencia_id, descricao)
    VALUES (v_user, 'aposta', -p_valor_centavos, v_novo_saldo, v_resultado.id, 'Nova aposta');
  END IF;

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_ou_alterar_aposta(uuid, public.palpite_aposta, bigint) TO authenticated;
