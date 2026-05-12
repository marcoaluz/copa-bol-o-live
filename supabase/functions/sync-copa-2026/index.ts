import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_FOOTBALL_KEY = Deno.env.get("API_FOOTBALL_KEY")!;
const API_BASE = "https://v3.football.api-sports.io";

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function mapStatus(apiStatus: string): "agendada" | "ao_vivo" | "encerrada" | "cancelada" {
  switch (apiStatus) {
    case "TBD": case "NS": return "agendada";
    case "1H": case "HT": case "2H": case "ET": case "P": case "LIVE": return "ao_vivo";
    case "FT": case "AET": case "PEN": return "encerrada";
    case "PST": case "CANC": case "ABD": case "AWD": case "WO": return "cancelada";
    default: return "agendada";
  }
}

function mapFase(round: string): string {
  const r = round.toLowerCase();
  if (r.includes("group")) return "grupos";
  if (r.includes("round of 32") || r.includes("32")) return "16avos";
  if (r.includes("round of 16") || r.includes("16")) return "oitavas";
  if (r.includes("quarter")) return "quartas";
  if (r.includes("semi")) return "semi";
  if (r.includes("3rd") || r.includes("third")) return "terceiro";
  if (r.includes("final")) return "final";
  return "grupos";
}

function extrairGrupo(round: string): string | null {
  const m = round.match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}

async function apiFetch(endpoint: string, params: Record<string, string>) {
  const url = new URL(API_BASE + endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  const r = await fetch(url.toString(), {
    headers: { "x-apisports-key": API_FOOTBALL_KEY },
  });
  if (!r.ok) throw new Error(`API ${endpoint} retornou ${r.status}: ${await r.text()}`);
  const data = await r.json();
  if (data.errors && Array.isArray(data.errors) ? data.errors.length > 0 : (data.errors && Object.keys(data.errors).length > 0)) {
    throw new Error(`API erro: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

async function sincronizarTimes(leagueId: number, season: number) {
  let inseridas = 0;
  let atualizadas = 0;
  const data = await apiFetch("/teams", {
    league: leagueId.toString(),
    season: season.toString(),
  });
  for (const item of data.response ?? []) {
    const t = item.team;
    const { data: existente } = await supa
      .from("selecoes")
      .select("id")
      .eq("api_team_id", t.id)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      nome: t.name,
      codigo_iso: t.code ?? t.name.substring(0, 3).toUpperCase(),
      bandeira_url: t.logo,
      api_team_id: t.id,
    };

    if (existente) {
      await supa.from("selecoes").update(payload).eq("id", existente.id);
      atualizadas++;
    } else {
      await supa.from("selecoes").insert({ ...payload, grupo: null });
      inseridas++;
    }
  }
  return { inseridas, atualizadas };
}

async function sincronizarPartidas(leagueId: number, season: number) {
  let inseridas = 0;
  let atualizadas = 0;
  let puladas = 0;
  const naoMapeados = new Set<string>();

  // Carrega Map<api_team_id, selecao_id> uma única vez
  const { data: todasSelecoes } = await supa
    .from("selecoes")
    .select("id, api_team_id")
    .limit(10000);
  const mapaTimes = new Map<number, string>();
  for (const s of todasSelecoes ?? []) {
    if (s.api_team_id != null) mapaTimes.set(Number(s.api_team_id), s.id);
  }

  const data = await apiFetch("/fixtures", {
    league: leagueId.toString(),
    season: season.toString(),
  });

  for (const item of data.response ?? []) {
    const fixture = item.fixture;
    const league = item.league;
    const teams = item.teams;
    const goals = item.goals;

    const casaId = mapaTimes.get(Number(teams.home?.id));
    const visitId = mapaTimes.get(Number(teams.away?.id));
    if (!casaId || !visitId) {
      puladas++;
      if (!casaId && teams.home?.name) naoMapeados.add(`casa: ${teams.home.name}`);
      if (!visitId && teams.away?.name) naoMapeados.add(`visitante: ${teams.away.name}`);
      console.warn(`[sync] partida ${fixture.id} pulada — time não mapeado`,
        { casa: teams.home?.name, visitante: teams.away?.name });
      continue;
    }

    const fase = mapFase(league.round ?? "");
    const grupo = extrairGrupo(league.round ?? "");

    if (fase === "grupos" && grupo) {
      await supa.from("selecoes").update({ grupo }).eq("id", casaId).is("grupo", null);
      await supa.from("selecoes").update({ grupo }).eq("id", visitId).is("grupo", null);
    }

    const status = mapStatus(fixture.status.short);
    const resultado = (status === "encerrada" && goals.home != null && goals.away != null)
      ? (goals.home > goals.away ? "casa" : goals.home < goals.away ? "visitante" : "empate")
      : null;

    const payload: Record<string, unknown> = {
      fase,
      grupo,
      selecao_casa_id: casaId,
      selecao_visitante_id: visitId,
      data_hora: fixture.date,
      estadio: fixture.venue?.name ?? null,
      status,
      gols_casa: goals.home,
      gols_visitante: goals.away,
      resultado,
      api_fixture_id: fixture.id,
      sincronizada_em: new Date().toISOString(),
    };

    const { data: existente } = await supa
      .from("partidas")
      .select("id, status")
      .eq("api_fixture_id", fixture.id)
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
        atualizadas++;
      }
    } else {
      await supa.from("partidas").insert(payload);
      inseridas++;
    }
  }
  return { inseridas, atualizadas, puladas, naoMapeados: Array.from(naoMapeados) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { data: log } = await supa.from("api_sync_log")
    .insert({ status: "em_andamento" }).select().single();
  const logId = log!.id;

  let requestsConsumidos = 0;

  try {
    const { data: cfg } = await supa.from("config").select("*").eq("id", 1).single();
    if (!cfg) throw new Error("Config não encontrada");

    if (!cfg.api_football_sync_ativo) {
      await supa.from("api_sync_log").update({
        status: "sucesso",
        finalizado_em: new Date().toISOString(),
        detalhes: { mensagem: "Sync desativado em config" },
      }).eq("id", logId);
      return new Response(JSON.stringify({ skipped: true, motivo: "sync desativado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!API_FOOTBALL_KEY) throw new Error("API_FOOTBALL_KEY não configurada");

    const leagueId = cfg.api_football_league_id;
    const season = cfg.api_football_season;

    const sTimes = await sincronizarTimes(leagueId, season);
    requestsConsumidos++;

    const sPartidas = await sincronizarPartidas(leagueId, season);
    requestsConsumidos++;

    await supa.from("config").update({
      api_football_ultimo_sync: new Date().toISOString(),
      api_football_ultimo_erro: null,
    }).eq("id", 1);

    await supa.from("api_sync_log").update({
      status: "sucesso",
      finalizado_em: new Date().toISOString(),
      partidas_inseridas: sPartidas.inseridas,
      partidas_atualizadas: sPartidas.atualizadas,
      partidas_puladas: sPartidas.puladas,
      times_nao_mapeados: sPartidas.naoMapeados,
      selecoes_inseridas: sTimes.inseridas,
      selecoes_atualizadas: sTimes.atualizadas,
      requests_consumidos: requestsConsumidos,
    }).eq("id", logId);

    return new Response(JSON.stringify({
      ok: true,
      times: sTimes,
      partidas: sPartidas,
      requests: requestsConsumidos,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await supa.from("config").update({ api_football_ultimo_erro: erro }).eq("id", 1);
    await supa.from("api_sync_log").update({
      status: "falha",
      finalizado_em: new Date().toISOString(),
      erro,
      requests_consumidos: requestsConsumidos,
    }).eq("id", logId);
    return new Response(JSON.stringify({ erro }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});