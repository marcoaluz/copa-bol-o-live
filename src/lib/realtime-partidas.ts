import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Partida } from "@/lib/tournament";

/**
 * Subscreve mudanças na tabela `partidas` via Supabase Realtime e atualiza
 * o cache do React Query in-place. Mantém um mapa do "placar anterior" para
 * permitir detectar mudança de placar (usado para a animação de flash).
 */
export function useRealtimePartidas() {
  const qc = useQueryClient();
  const placarAnterior = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const channel = supabase
      .channel("partidas-rt")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "partidas" },
        (payload) => {
          const novo = payload.new as Partida;
          const antigo = payload.old as Partida;
          const chaveAntiga = `${antigo.gols_casa}-${antigo.gols_visitante}`;
          const chaveNova = `${novo.gols_casa}-${novo.gols_visitante}`;
          if (chaveAntiga !== chaveNova) {
            placarAnterior.current.set(novo.id, String(Date.now()));
          }
          qc.setQueryData<Partida[] | undefined>(["partidas"], (old) =>
            old ? old.map((p) => (p.id === novo.id ? { ...p, ...novo } : p)) : old,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  return placarAnterior;
}

/** Retorna true por ~600ms após o placar mudar (para piscar dourado). */
export function usePlacarFlash(partidaId: string, placar: string) {
  const ref = useRef<{ placar: string; ts: number }>({ placar, ts: 0 });
  if (ref.current.placar !== placar) {
    ref.current = { placar, ts: Date.now() };
  }
  const elapsed = Date.now() - ref.current.ts;
  return elapsed < 600 && ref.current.ts > 0;
}

/** Calcula minuto aproximado da partida com base em data_hora (kickoff). */
export function minutoPartida(dataHora: string): string {
  const diff = Date.now() - new Date(dataHora).getTime();
  if (diff < 0) return "—";
  const min = Math.floor(diff / 60_000);
  if (min <= 45) return `${min}'`;
  if (min < 60) return "Intervalo";
  if (min <= 105) return `${min - 15}'`; // ajusta o intervalo de 15min
  return "90'+";
}