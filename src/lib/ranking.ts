import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RankingFiltro = "geral" | "grupos" | "mata" | "semana";

export type RankingLinha = {
  usuario_id: string;
  apelido: string | null;
  foto_url: string | null;
  anonimo: boolean;
  total_apostas: number;
  total_acertos: number;
  taxa_acerto: number;
  total_apostado_centavos: number;
  total_ganho_centavos: number;
  lucro_centavos: number;
  posicao: number;
};

export function useRanking(filtro: RankingFiltro) {
  return useQuery({
    queryKey: ["ranking", filtro],
    queryFn: async (): Promise<RankingLinha[]> => {
      const { data, error } = await supabase.rpc("ranking_filtrado", { p_filtro: filtro });
      if (error) throw error;
      return (data ?? []) as unknown as RankingLinha[];
    },
    staleTime: 30_000,
  });
}

export type EstatisticasUsuario = {
  usuario_id: string;
  posicao: number | null;
  total_apostas: number;
  total_acertos: number;
  taxa_acerto: number;
  lucro_centavos: number;
  melhor_sequencia: number;
};

export function useEstatisticasUsuario(uid: string | undefined) {
  return useQuery({
    queryKey: ["estatisticas-usuario", uid],
    enabled: !!uid,
    queryFn: async (): Promise<EstatisticasUsuario | null> => {
      const { data, error } = await supabase.rpc("estatisticas_usuario", { p_uid: uid! });
      if (error) throw error;
      return (data ?? null) as unknown as EstatisticasUsuario | null;
    },
    staleTime: 30_000,
  });
}

/** Últimas N transações para gráfico de evolução do saldo. */
export function useEvolucaoSaldo(uid: string | undefined, n = 30) {
  return useQuery({
    queryKey: ["evolucao-saldo", uid, n],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacoes")
        .select("created_at, saldo_apos_centavos, tipo")
        .eq("usuario_id", uid!)
        .order("created_at", { ascending: false })
        .limit(n);
      if (error) throw error;
      return (data ?? []).slice().reverse();
    },
    staleTime: 30_000,
  });
}

export function useToggleAnonimo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { uid: string; anonimo: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ anonimo: params.anonimo })
        .eq("id", params.uid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ranking"] });
    },
  });
}

export function nomeExibicao(linha: Pick<RankingLinha, "apelido" | "anonimo" | "posicao">) {
  if (linha.anonimo) return `Apostador #${linha.posicao}`;
  return linha.apelido ?? "—";
}

export function iniciais(nome: string) {
  return nome
    .split(/[\s@#]+/)
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}