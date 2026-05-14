import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Aposta = {
  id: string;
  usuario_id: string;
  partida_id: string;
  palpite: "casa" | "empate" | "visitante";
  valor_centavos: number;
  status: "ativa" | "ganhou" | "perdeu" | "devolvida";
  premio_centavos: number | null;
  created_at: string;
  updated_at: string;
};

export type ApostaUnificada =
  | {
      tipo: "vencedor";
      id: string;
      usuario_id: string;
      partida_id: string;
      palpite: "casa" | "empate" | "visitante";
      valor_centavos: number;
      status: "ativa" | "ganhou" | "perdeu" | "devolvida";
      premio_centavos: number | null;
      created_at: string;
      updated_at: string;
    }
  | {
      tipo: "placar";
      id: string;
      usuario_id: string;
      partida_id: string;
      gols_casa: number;
      gols_visitante: number;
      valor_centavos: number;
      status: "ativa" | "ganhou" | "perdeu" | "devolvida";
      premio_centavos: number | null;
      created_at: string;
      updated_at: string;
    };

export const MIN_APOSTA = 200;
export const MAX_APOSTA = 50000;
export const TRAVA_MINUTOS = 60;

export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Hook que mantém a hora do servidor sincronizada (re-checa a cada `resyncMs`). */
export function useServerNow(resyncMs = 30_000) {
  const [now, setNow] = useState<Date>(() => new Date());
  const offsetRef = useRef(0); // ms: serverTime - clientTime

  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      const t0 = Date.now();
      const { data } = await supabase.rpc("agora_servidor");
      const t1 = Date.now();
      if (!mounted || !data) return;
      const serverMs = new Date(data as unknown as string).getTime();
      const rtt = (t1 - t0) / 2;
      offsetRef.current = serverMs - (t1 - rtt);
    };
    sync();
    const resyncId = setInterval(sync, resyncMs);
    const tickId = setInterval(() => {
      setNow(new Date(Date.now() + offsetRef.current));
    }, 1000);
    return () => {
      mounted = false;
      clearInterval(resyncId);
      clearInterval(tickId);
    };
  }, [resyncMs]);

  return now;
}

export function useMinhasApostas(userId: string | undefined) {
  return useQuery({
    queryKey: ["apostas-unificadas", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ApostaUnificada[]> => {
      const [vencedor, placar] = await Promise.all([
        supabase
          .from("apostas")
          .select("*")
          .eq("usuario_id", userId!)
          .order("created_at", { ascending: false })
          .limit(500),
        (supabase as any)
          .from("apostas_placar")
          .select("*")
          .eq("usuario_id", userId!)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (vencedor.error) throw vencedor.error;
      if (placar.error) throw placar.error;
      const v: ApostaUnificada[] = (vencedor.data ?? []).map((a: Aposta) => ({
        tipo: "vencedor" as const,
        id: a.id,
        usuario_id: a.usuario_id,
        partida_id: a.partida_id,
        palpite: a.palpite,
        valor_centavos: Number(a.valor_centavos),
        status: a.status,
        premio_centavos: a.premio_centavos == null ? null : Number(a.premio_centavos),
        created_at: a.created_at,
        updated_at: a.updated_at,
      }));
      const p: ApostaUnificada[] = ((placar.data ?? []) as Array<{
        id: string;
        usuario_id: string;
        partida_id: string;
        gols_casa_palpite: number;
        gols_visitante_palpite: number;
        valor_centavos: number;
        status: "ativa" | "ganhou" | "perdeu" | "devolvida";
        premio_centavos: number | null;
        created_at: string;
        updated_at: string;
      }>).map((a) => ({
        tipo: "placar" as const,
        id: a.id,
        usuario_id: a.usuario_id,
        partida_id: a.partida_id,
        gols_casa: Number(a.gols_casa_palpite),
        gols_visitante: Number(a.gols_visitante_palpite),
        valor_centavos: Number(a.valor_centavos),
        status: a.status,
        premio_centavos: a.premio_centavos == null ? null : Number(a.premio_centavos),
        created_at: a.created_at,
        updated_at: a.updated_at,
      }));
      return [...v, ...p].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });
}

export function useApostaDaPartida(userId: string | undefined, partidaId: string | undefined) {
  return useQuery({
    queryKey: ["aposta", userId, partidaId],
    enabled: !!userId && !!partidaId,
    queryFn: async (): Promise<Aposta | null> => {
      const { data, error } = await supabase
        .from("apostas")
        .select("*")
        .eq("partida_id", partidaId!)
        .eq("usuario_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Aposta) ?? null;
    },
  });
}

export function useCriarOuAlterarAposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      partida_id: string;
      palpite: "casa" | "empate" | "visitante";
      valor_centavos: number;
    }) => {
      const { data, error } = await supabase.rpc("criar_ou_alterar_aposta", {
        p_partida_id: input.partida_id,
        p_palpite: input.palpite,
        p_valor_centavos: input.valor_centavos,
      });
      if (error) throw new Error(error.message);
      return data as unknown as Aposta;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apostas"] });
      qc.invalidateQueries({ queryKey: ["aposta"] });
    },
  });
}

export function useCancelarAposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apostaId: string) => {
      const { error } = await (supabase.rpc as any)("cancelar_aposta", {
        p_aposta_id: apostaId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apostas"] });
      qc.invalidateQueries({ queryKey: ["aposta"] });
    },
  });
}

export const PALPITE_LABEL: Record<Aposta["palpite"], string> = {
  casa: "Casa vence",
  empate: "Empate",
  visitante: "Visitante vence",
};

export const STATUS_LABEL: Record<Aposta["status"], string> = {
  ativa: "Ativa",
  ganhou: "Ganhou",
  perdeu: "Perdeu",
  devolvida: "Devolvida",
};