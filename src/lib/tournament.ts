import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTorneioAtivoId } from "@/lib/torneio";

export type Selecao = {
  id: string;
  nome: string;
  codigo_iso: string;
  bandeira_url: string | null;
  grupo: string | null;
  torneio_id?: string;
};

export type Partida = {
  id: string;
  fase: "grupos" | "oitavas" | "quartas" | "semi" | "terceiro" | "final";
  grupo: string | null;
  selecao_casa_id: string | null;
  selecao_visitante_id: string | null;
  placeholder_casa: string | null;
  placeholder_visitante: string | null;
  data_hora: string;
  estadio: string | null;
  status: "agendada" | "ao_vivo" | "encerrada" | "cancelada";
  gols_casa: number | null;
  gols_visitante: number | null;
  resultado: "casa" | "empate" | "visitante" | null;
  bracket_proximo_id: string | null;
  ordem_bracket: number | null;
  codigo: string | null;
  bolo_acumulado_centavos: number;
  rodada?: number | null;
  torneio_id?: string;
};

export type ClassificacaoLinha = {
  selecao_id: string;
  grupo: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gp: number;
  gc: number;
  sg: number;
  pontos: number;
};

export type ClassificacaoPCLinha = {
  id: string;
  torneio_id: string;
  nome: string;
  codigo_iso: string;
  bandeira_url: string | null;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  gp: number;
  gc: number;
  pontos: number;
};

export function useSelecoes() {
  const torneioId = useTorneioAtivoId();
  return useQuery({
    queryKey: ["selecoes", torneioId],
    enabled: !!torneioId,
    queryFn: async (): Promise<Selecao[]> => {
      const { data, error } = await supabase
        .from("selecoes")
        .select("*")
        .eq("torneio_id", torneioId!)
        .order("grupo")
        .order("nome");
      if (error) throw error;
      return data as Selecao[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePartidas() {
  const torneioId = useTorneioAtivoId();
  return useQuery({
    queryKey: ["partidas", torneioId],
    enabled: !!torneioId,
    queryFn: async (): Promise<Partida[]> => {
      const { data, error } = await supabase
        .from("partidas")
        .select("*")
        .eq("torneio_id", torneioId!)
        .order("data_hora", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data as Partida[];
    },
    staleTime: 60 * 1000,
  });
}

export function useClassificacao() {
  const torneioId = useTorneioAtivoId();
  return useQuery({
    queryKey: ["classificacao", torneioId],
    enabled: !!torneioId,
    queryFn: async (): Promise<ClassificacaoLinha[]> => {
      const { data, error } = await supabase
        .from("classificacao_grupos")
        .select("*");
      if (error) throw error;
      return data as ClassificacaoLinha[];
    },
    staleTime: 60 * 1000,
  });
}

export function useClassificacaoPontosCorridos() {
  const torneioId = useTorneioAtivoId();
  return useQuery({
    queryKey: ["classificacao-pc", torneioId],
    enabled: !!torneioId,
    queryFn: async (): Promise<ClassificacaoPCLinha[]> => {
      const { data, error } = await (supabase as any)
        .from("classificacao_pontos_corridos")
        .select("*")
        .eq("torneio_id", torneioId!);
      if (error) throw error;
      return (data ?? []) as ClassificacaoPCLinha[];
    },
    staleTime: 60 * 1000,
  });
}

export function selecaoMap(selecoes: Selecao[] | undefined): Record<string, Selecao> {
  const m: Record<string, Selecao> = {};
  selecoes?.forEach((s) => (m[s.id] = s));
  return m;
}

export const FASE_LABEL: Record<Partida["fase"], string> = {
  grupos: "Fase de grupos",
  oitavas: "Oitavas de final",
  quartas: "Quartas de final",
  semi: "Semifinal",
  terceiro: "Disputa de 3º lugar",
  final: "Final",
};