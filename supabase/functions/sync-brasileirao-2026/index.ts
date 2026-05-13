import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FOOTBALL_DATA_API_KEY = Deno.env.get("FOOTBALL_DATA_API_KEY")!;

// Football-Data.org v4 — Brasileirão Série A code = BSA
const API_URL = "https://api.football-data.org/v4/competitions/BSA/matches";

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function baseCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .substring(0, 3)
    .toUpperCase() || "TBD";
}

function uniqueCode(name: string, apiId: number, used: Set<string>): string {
  const base = baseCode(name);
  if (!used.has(base)) { used.add(base); return base; }
  // append last digit(s) of api id
  const idStr = String(apiId);
  for (let n = 1; n <= 3; n++) {
    const candidate = (base.substring(0, 3 - n) + idStr.slice(-n)).toUpperCase();
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
  }
  // fallback: 4-char with full last 2 of id
  const fallback = (base + idStr.slice(-2)).substring(0, 6).toUpperCase();
  used.add(fallback);
  return fallback;
}

function bandeira(team: any): string | null {
  return team?.crest ?? null;
}

function mapStatus(s: string): string {
  switch (s) {
    case "FINISHED":
    case "AWARDED":
      return "encerrada";
    case "IN_PLAY":
    case "PAUSED":
    case "LIVE":
      return "ao_vivo";
    case "CANCELLED":
    case "POSTPONED":
    case "SUSPENDED":
      return "cancelada";
    default:
      return "agendada";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!FOOTBALL_DATA_API_KEY) {
    return new Response(
      JSON.stringify({ erro: "FOOTBALL_DATA_API_KEY não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Resolver torneio_id do Brasileirão
  const { data: torneio, error: tErr } = await supa
    .from("torneios")
    .select("id, slug")
    .eq("slug", "brasileirao-2026")
    .maybeSingle();
  if (tErr || !torneio) {
    return new Response(
      JSON.stringify({ erro: "Torneio brasileirao-2026 não cadastrado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const torneioId = torneio.id as string;

  const { data: log } = await supa.from("api_sync_log")
    .insert({ status: "em_andamento", fonte: "football-data.org" })
    .select().single();
  const logId = log!.id;

  try {
    const { data: cfg } = await supa.from("config").select("*").eq("id", 1).single();
    if (cfg && (cfg as any).brasileirao_sync_ativo === false) {
      await supa.from("api_sync_log").update({
        status: "sucesso", finalizado_em: new Date().toISOString(),
        detalhes: { mensagem: "Sync Brasileirão desativado" }
      }).eq("id", logId);
      return new Response(JSON.stringify({ skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await fetch(API_URL, {
      headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Football-Data ${r.status}: ${txt.substring(0, 300)}`);
    }
    const dados = await r.json();
    const matches: any[] = dados.matches ?? [];

    // 1) Coletar times únicos
    const teamsMap = new Map<number, { nome: string; crest: string | null }>();
    for (const m of matches) {
      for (const t of [m.homeTeam, m.awayTeam]) {
        if (t?.id && !teamsMap.has(t.id)) {
          teamsMap.set(t.id, { nome: t.shortName ?? t.name ?? `Time #${t.id}`, crest: bandeira(t) });
        }
      }
    }

    // 2) Upsert de seleções (times)
    let selecoes_inseridas = 0, selecoes_atualizadas = 0;
    const apiToId = new Map<number, string>();

    // Pré-carregar códigos já usados nesse torneio para evitar colisão
    const { data: existingTeams } = await supa
      .from("selecoes")
      .select("codigo_iso, api_team_id")
      .eq("torneio_id", torneioId);
    const usedCodes = new Set<string>((existingTeams ?? []).map((t: any) => t.codigo_iso));
    const apiIdToCode = new Map<number, string>();
    (existingTeams ?? []).forEach((t: any) => {
      if (t.api_team_id) apiIdToCode.set(Number(t.api_team_id), t.codigo_iso);
    });

    for (const [apiId, info] of teamsMap) {
      // reusar código existente se time já existe; senão gerar único
      const codigo = apiIdToCode.get(apiId) ?? uniqueCode(info.nome, apiId, usedCodes);
      const payload = {
        torneio_id: torneioId,
        nome: info.nome,
        codigo_iso: codigo,
        bandeira_url: info.crest,
        api_team_id: apiId,
        grupo: null,
      };

      const { data: existente } = await supa
        .from("selecoes")
        .select("id")
        .eq("torneio_id", torneioId)
        .eq("api_team_id", apiId)
        .maybeSingle();

      if (existente) {
        await supa.from("selecoes").update({
          nome: info.nome,
          codigo_iso: codigo,
          bandeira_url: info.crest,
        }).eq("id", existente.id);
        apiToId.set(apiId, existente.id);
        selecoes_atualizadas++;
      } else {
        const { data: nova, error: insErr } = await supa
          .from("selecoes")
          .insert(payload)
          .select("id")
          .single();
        if (insErr) throw new Error(`Falha ao inserir time ${info.nome}: ${insErr.message}`);
        if (nova) apiToId.set(apiId, nova.id);
        selecoes_inseridas++;
      }
    }

    // 3) Upsert de partidas
    let partidas_inseridas = 0, partidas_atualizadas = 0, partidas_puladas = 0;

    for (const m of matches) {
      const casaApiId = m.homeTeam?.id;
      const visitApiId = m.awayTeam?.id;
      if (!casaApiId || !visitApiId) { partidas_puladas++; continue; }
      const casaId = apiToId.get(casaApiId);
      const visitId = apiToId.get(visitApiId);
      if (!casaId || !visitId) { partidas_puladas++; continue; }

      const status = mapStatus(m.status);
      const fullTime = m.score?.fullTime ?? {};
      const gols_casa = fullTime.home ?? null;
      const gols_visit = fullTime.away ?? null;
      const resultado = (status === "encerrada" && gols_casa != null && gols_visit != null)
        ? (gols_casa > gols_visit ? "casa" : gols_casa < gols_visit ? "visitante" : "empate")
        : null;

      const codigoPartida = `BSA2026-${m.id}`;
      const rodada: number | null = typeof m.matchday === "number" ? m.matchday : null;

      const payload: any = {
        torneio_id: torneioId,
        fase: "grupos",
        grupo: null,
        rodada,
        selecao_casa_id: casaId,
        selecao_visitante_id: visitId,
        data_hora: m.utcDate,
        estadio: m.venue ?? null,
        status,
        gols_casa,
        gols_visitante: gols_visit,
        resultado,
        api_fixture_id: m.id,
        sincronizada_em: new Date().toISOString(),
        codigo_partida: codigoPartida,
      };

      const { data: existente } = await supa
        .from("partidas")
        .select("id")
        .eq("codigo_partida", codigoPartida)
        .maybeSingle();

      if (existente) {
        const { count } = await supa
          .from("apostas")
          .select("*", { count: "exact", head: true })
          .eq("partida_id", existente.id)
          .neq("status", "ativa");
        const jaApurada = (count ?? 0) > 0;
        if (!jaApurada) {
          await supa.from("partidas").update(payload).eq("id", existente.id);
          partidas_atualizadas++;
        }
      } else {
        await supa.from("partidas").insert(payload);
        partidas_inseridas++;
      }
    }

    await supa.from("config").update({
      brasileirao_ultimo_sync: new Date().toISOString(),
      brasileirao_ultimo_erro: null,
    } as any).eq("id", 1);

    await supa.from("api_sync_log").update({
      status: "sucesso",
      finalizado_em: new Date().toISOString(),
      partidas_inseridas,
      partidas_atualizadas,
      partidas_puladas,
      selecoes_inseridas,
      selecoes_atualizadas,
      requests_consumidos: 1,
      detalhes: { fonte: "football-data.org", torneio: "brasileirao-2026" },
    }).eq("id", logId);

    return new Response(JSON.stringify({
      ok: true,
      selecoes: { inseridas: selecoes_inseridas, atualizadas: selecoes_atualizadas },
      partidas: { inseridas: partidas_inseridas, atualizadas: partidas_atualizadas, puladas: partidas_puladas },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await supa.from("config").update({ brasileirao_ultimo_erro: erro } as any).eq("id", 1);
    await supa.from("api_sync_log").update({
      status: "falha",
      finalizado_em: new Date().toISOString(),
      erro,
    }).eq("id", logId);
    return new Response(JSON.stringify({ erro }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});