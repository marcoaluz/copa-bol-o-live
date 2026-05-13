import { useQuery } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";

export type Torneio = {
  id: string;
  slug: string;
  nome: string;
  nome_curto: string;
  tipo: "copa" | "pontos_corridos";
  emoji: string;
  cor_primaria: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  ativo: boolean;
  ordem: number;
};

type TorneioState = {
  torneioAtivoSlug: string;
  setTorneioAtivo: (slug: string) => void;
};

export const useTorneioStore = create<TorneioState>()(
  persist(
    (set) => ({
      torneioAtivoSlug: "copa-2026",
      setTorneioAtivo: (slug) => set({ torneioAtivoSlug: slug }),
    }),
    { name: "torneio-ativo" },
  ),
);

export function useTorneios() {
  return useQuery({
    queryKey: ["torneios"],
    queryFn: async (): Promise<Torneio[]> => {
      const { data, error } = await supabase
        .from("torneios")
        .select("*")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Torneio[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTorneioAtivo(): Torneio | null {
  const slug = useTorneioStore((s) => s.torneioAtivoSlug);
  const { data: torneios } = useTorneios();
  return torneios?.find((t) => t.slug === slug) ?? torneios?.[0] ?? null;
}

export function useTorneioAtivoId(): string | null {
  return useTorneioAtivo()?.id ?? null;
}