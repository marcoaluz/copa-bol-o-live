import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ApostaPlacar = {
  id: string;
  usuario_id: string;
  partida_id: string;
  gols_casa_palpite: number;
  gols_visitante_palpite: number;
  valor_centavos: number;
  status: "ativa" | "ganhou" | "perdeu" | "devolvida";
  premio_centavos: number;
  created_at: string;
  updated_at: string;
};

export const STATUS_PLACAR_LABEL: Record<ApostaPlacar["status"], string> = {
  ativa: "Ativa",
  ganhou: "Acertou",
  perdeu: "Errou",
  devolvida: "Devolvida",
};

/** Aposta de placar do usuário corrente para uma partida. */
export function useApostaPlacarDaPartida(userId: string | undefined, partidaId: string | undefined) {
  return useQuery({
    queryKey: ["aposta-placar", userId, partidaId],
    enabled: !!userId && !!partidaId,
    queryFn: async (): Promise<ApostaPlacar | null> => {
      const { data, error } = await (supabase as any)
        .from("apostas_placar")
        .select("*")
        .eq("partida_id", partidaId!)
        .eq("usuario_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ApostaPlacar) ?? null;
    },
  });
}

export function useMinhasApostasPlacar(userId: string | undefined) {
  return useQuery({
    queryKey: ["apostas-placar", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ApostaPlacar[]> => {
      const { data, error } = await (supabase as any)
        .from("apostas_placar")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ApostaPlacar[];
    },
  });
}

export function useCriarOuAlterarApostaPlacar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      partida_id: string;
      gols_casa: number;
      gols_visitante: number;
      valor_centavos: number;
    }) => {
      const { data, error } = await (supabase.rpc as any)("criar_ou_alterar_aposta_placar", {
        p_partida_id: input.partida_id,
        p_gols_casa: input.gols_casa,
        p_gols_visitante: input.gols_visitante,
        p_valor_centavos: input.valor_centavos,
      });
      if (error) throw new Error(error.message);
      return data as ApostaPlacar;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aposta-placar"] });
      qc.invalidateQueries({ queryKey: ["apostas-placar"] });
    },
  });
}

export function useCancelarApostaPlacar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apostaId: string) => {
      const { error } = await (supabase.rpc as any)("cancelar_aposta_placar", {
        p_aposta_id: apostaId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aposta-placar"] });
      qc.invalidateQueries({ queryKey: ["apostas-placar"] });
    },
  });
}