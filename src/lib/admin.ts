import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLancarResultado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { partida_id: string; gols_casa: number; gols_visitante: number }) => {
      const { data, error } = await supabase.rpc("lancar_resultado_partida", {
        p_id: i.partida_id,
        p_gols_casa: i.gols_casa,
        p_gols_visitante: i.gols_visitante,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partidas"] }),
  });
}

export function useApurarPartida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partida_id: string) => {
      const { data, error } = await supabase.rpc("apurar_partida", { p_id: partida_id });
      if (error) throw new Error(error.message);
      return data as Record<string, unknown>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partidas"] });
      qc.invalidateQueries({ queryKey: ["apostas"] });
    },
  });
}

export function useCancelarPartida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partida_id: string) => {
      const { data, error } = await supabase.rpc("cancelar_partida", { p_id: partida_id });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partidas"] });
      qc.invalidateQueries({ queryKey: ["apostas"] });
    },
  });
}

export function useApostasDaPartida(partida_id: string | null) {
  return useQuery({
    queryKey: ["admin-apostas-partida", partida_id],
    enabled: !!partida_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apostas")
        .select("*, profiles:usuario_id(apelido,nome_completo)")
        .eq("partida_id", partida_id!);
      if (error) throw error;
      return data;
    },
  });
}

export function useSelfTest() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("_self_test_apuracao");
      if (error) throw new Error(error.message);
      return data as { passed: number; total: number; results: any[] };
    },
  });
}