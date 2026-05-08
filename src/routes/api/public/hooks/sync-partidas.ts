import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// TheSportsDB free endpoints. Pode ser substituída por API-Football trocando o fetch.
// Cada partida precisa ter `external_id` preenchido (ID do evento na fonte) para ser sincronizada.
const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";

type LookupEvent = {
  idEvent: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
  strProgress?: string | null;
  strPostponed?: string | null;
};

function mapStatus(api: LookupEvent): "agendada" | "ao_vivo" | "encerrada" | "cancelada" | null {
  const s = (api.strStatus || "").toUpperCase();
  if (api.strPostponed === "yes" || s.includes("CANC") || s.includes("ABAND")) return "cancelada";
  if (s.includes("FT") || s.includes("MATCH FINISHED") || s.includes("AET") || s.includes("PEN")) return "encerrada";
  if (s.includes("LIVE") || s.includes("HT") || s.includes("1H") || s.includes("2H") || s.includes("ET") || /\b\d+'\b/.test(s)) return "ao_vivo";
  if (s === "" || s === "NS" || s.includes("NOT STARTED")) return null;
  return null;
}

async function fetchEvent(id: string): Promise<LookupEvent | null> {
  try {
    const res = await fetch(`${SPORTSDB_BASE}/lookupevent.php?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { events?: LookupEvent[] };
    return json.events?.[0] ?? null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/hooks/sync-partidas")({
  server: {
    handlers: {
      POST: async () => {
        const inicio = Date.now();
        const janelaInicio = new Date(Date.now() - 3 * 60 * 60_000).toISOString(); // 3h atrás
        const janelaFim = new Date(Date.now() + 30 * 60_000).toISOString(); // próximos 30min

        const { data: partidas, error } = await supabaseAdmin
          .from("partidas")
          .select("id, external_id, status, data_hora, gols_casa, gols_visitante")
          .not("external_id", "is", null)
          .neq("status", "encerrada")
          .neq("status", "cancelada")
          .gte("data_hora", janelaInicio)
          .lte("data_hora", janelaFim);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }

        const resultados: any[] = [];
        for (const p of partidas ?? []) {
          const ev = await fetchEvent(p.external_id!);
          if (!ev) {
            resultados.push({ id: p.id, skipped: "fetch_failed" });
            continue;
          }
          const novoStatus = mapStatus(ev);
          if (!novoStatus) { resultados.push({ id: p.id, skipped: "no_status" }); continue; }

          const gc = ev.intHomeScore != null ? parseInt(ev.intHomeScore) : null;
          const gv = ev.intAwayScore != null ? parseInt(ev.intAwayScore) : null;

          const sameStatus = novoStatus === p.status;
          const sameScore = gc === p.gols_casa && gv === p.gols_visitante;
          if (sameStatus && sameScore) { resultados.push({ id: p.id, noop: true }); continue; }

          const { data: upd, error: upErr } = await supabaseAdmin.rpc("atualizar_partida_externa", {
            p_external_id: p.external_id!,
            p_status: novoStatus,
            p_gols_casa: gc ?? undefined,
            p_gols_visitante: gv ?? undefined,
            p_dados: { source: "thesportsdb", strStatus: ev.strStatus } as any,
          });
          if (upErr) resultados.push({ id: p.id, error: upErr.message });
          else resultados.push({ id: p.id, updated: { status: novoStatus, gc, gv }, ok: !!upd });
        }

        return new Response(JSON.stringify({
          ok: true, ms: Date.now() - inicio, total: resultados.length, resultados,
        }), { headers: { "content-type": "application/json" } });
      },
      GET: async () => new Response(JSON.stringify({ ok: true, hint: "POST para executar" }), {
        headers: { "content-type": "application/json" },
      }),
    },
  },
});