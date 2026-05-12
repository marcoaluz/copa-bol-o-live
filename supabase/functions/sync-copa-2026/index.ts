import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENFOOTBALL_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CODIGOS_ISO: Record<string, string> = {
  "Mexico": "MEX", "South Africa": "RSA", "South Korea": "KOR",
  "Canada": "CAN", "Qatar": "QAT", "Switzerland": "SUI",
  "Brazil": "BRA", "Morocco": "MAR", "Haiti": "HAI", "Scotland": "SCO",
  "USA": "USA", "Paraguay": "PAR", "Australia": "AUS",
  "Germany": "GER", "Curaçao": "CUW", "Ivory Coast": "CIV", "Ecuador": "ECU",
  "Netherlands": "NED", "Japan": "JPN", "Sweden": "SWE", "Tunisia": "TUN",
  "Belgium": "BEL", "Egypt": "EGY", "Iran": "IRN", "New Zealand": "NZL",
  "Spain": "ESP", "Cape Verde": "CPV", "Saudi Arabia": "KSA", "Uruguay": "URU",
  "France": "FRA", "Senegal": "SEN", "Iraq": "IRQ", "Norway": "NOR",
  "Argentina": "ARG", "Algeria": "ALG", "Austria": "AUT", "Jordan": "JOR",
  "Portugal": "POR", "DR Congo": "COD", "Uzbekistan": "UZB", "Colombia": "COL",
  "England": "ENG", "Croatia": "CRO", "Ghana": "GHA", "Panama": "PAN",
  "Czech Republic": "CZE", "Bosnia & Herzegovina": "BIH",
};

const NOMES_PT: Record<string, string> = {
  "Mexico": "México", "South Africa": "África do Sul", "South Korea": "Coreia do Sul",
  "Canada": "Canadá", "Qatar": "Catar", "Switzerland": "Suíça",
  "Brazil": "Brasil", "Morocco": "Marrocos", "Haiti": "Haiti", "Scotland": "Escócia",
  "USA": "Estados Unidos", "Paraguay": "Paraguai", "Australia": "Austrália",
  "Germany": "Alemanha", "Curaçao": "Curaçao", "Ivory Coast": "Costa do Marfim", "Ecuador": "Equador",
  "Netherlands": "Holanda", "Japan": "Japão", "Sweden": "Suécia", "Tunisia": "Tunísia",
  "Belgium": "Bélgica", "Egypt": "Egito", "Iran": "Irã", "New Zealand": "Nova Zelândia",
  "Spain": "Espanha", "Cape Verde": "Cabo Verde", "Saudi Arabia": "Arábia Saudita", "Uruguay": "Uruguai",
  "France": "França", "Senegal": "Senegal", "Iraq": "Iraque", "Norway": "Noruega",
  "Argentina": "Argentina", "Algeria": "Argélia", "Austria": "Áustria", "Jordan": "Jordânia",
  "Portugal": "Portugal", "DR Congo": "RD Congo", "Uzbekistan": "Uzbequistão", "Colombia": "Colômbia",
  "England": "Inglaterra", "Croatia": "Croácia", "Ghana": "Gana", "Panama": "Panamá",
  "Czech Republic": "República Tcheca", "Bosnia & Herzegovina": "Bósnia e Herzegovina",
};

function bandeiraUrl(codigo: string): string {
  const map: Record<string, string> = {
    "MEX":"mx","RSA":"za","KOR":"kr","CAN":"ca","QAT":"qa","SUI":"ch",
    "BRA":"br","MAR":"ma","HAI":"ht","SCO":"gb-sct","USA":"us","PAR":"py","AUS":"au",
    "GER":"de","CUW":"cw","CIV":"ci","ECU":"ec","NED":"nl","JPN":"jp","SWE":"se","TUN":"tn",
    "BEL":"be","EGY":"eg","IRN":"ir","NZL":"nz","ESP":"es","CPV":"cv","KSA":"sa","URU":"uy",
    "FRA":"fr","SEN":"sn","IRQ":"iq","NOR":"no","ARG":"ar","ALG":"dz","AUT":"at","JOR":"jo",
    "POR":"pt","COD":"cd","UZB":"uz","COL":"co","ENG":"gb-eng","CRO":"hr","GHA":"gh","PAN":"pa",
    "CZE":"cz","BIH":"ba"
  };
  const iso2 = map[codigo] ?? "un";
  return `https://flagcdn.com/w160/${iso2}.png`;
}

function mapFase(round: string): string {
  const r = (round ?? "").toLowerCase();
  if (r.startsWith("matchday")) return "grupos";
  if (r.includes("round of 32")) return "16avos";
  if (r.includes("round of 16")) return "oitavas";
  if (r.includes("quarter")) return "quartas";
  if (r.includes("semi")) return "semi";
  if (r.includes("third")) return "terceiro";
  if (r === "final") return "final";
  return "grupos";
}

function extrairLetraGrupo(group?: string): string | null {
  if (!group) return null;
  const m = group.match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}

function montarDataHora(date: string, time: string): string {
  const match = time?.match(/^(\d{2}):(\d{2})\s+UTC([+-]\d+)$/);
  if (!match) return `${date}T${(time ?? "12:00").split(" ")[0]}:00Z`;
  const [, hh, mm, tz] = match;
  const offset = parseInt(tz);
  const sinal = offset >= 0 ? "+" : "-";
  const offsetAbs = Math.abs(offset).toString().padStart(2, "0");
  return `${date}T${hh}:${mm}:00${sinal}${offsetAbs}:00`;
}

function ehPlaceholder(team: string): boolean {
  return /^(UEFA Path|IC Path|W\d+|L\d+|\d[A-L]|3[A-Z\/]+)/.test(team);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { data: log } = await supa.from("api_sync_log")
    .insert({ status: "em_andamento", fonte: "openfootball" })
    .select().single();
  const logId = log!.id;

  try {
    const { data: cfg } = await supa.from("config").select("*").eq("id", 1).single();
    if (!cfg) throw new Error("Config não encontrada");
    if (!cfg.api_football_sync_ativo) {
      await supa.from("api_sync_log").update({
        status: "sucesso", finalizado_em: new Date().toISOString(),
        detalhes: { mensagem: "Sync desativado" }
      }).eq("id", logId);
      return new Response(JSON.stringify({ skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const r = await fetch(OPENFOOTBALL_URL);
    if (!r.ok) throw new Error(`OpenFootball ${r.status}: ${await r.text()}`);
    const dados = await r.json();
    const matches: any[] = dados.matches ?? [];

    const selecoesMap = new Map<string, { nome: string; grupo: string | null }>();
    for (const m of matches) {
      const grupo = extrairLetraGrupo(m.group);
      for (const t of [m.team1, m.team2]) {
        if (!t || ehPlaceholder(t)) continue;
        if (!selecoesMap.has(t)) {
          selecoesMap.set(t, { nome: t, grupo });
        } else if (grupo && !selecoesMap.get(t)!.grupo) {
          selecoesMap.get(t)!.grupo = grupo;
        }
      }
    }

    let selecoes_inseridas = 0, selecoes_atualizadas = 0;
    const teamToId = new Map<string, string>();

    for (const [teamEng, info] of selecoesMap) {
      const codigo = CODIGOS_ISO[teamEng] ?? teamEng.substring(0, 3).toUpperCase();
      const nomePt = NOMES_PT[teamEng] ?? teamEng;

      const payload = {
        nome: nomePt,
        codigo_iso: codigo,
        bandeira_url: bandeiraUrl(codigo),
        grupo: info.grupo,
      };

      const { data: existente } = await supa
        .from("selecoes").select("id").eq("codigo_iso", codigo).maybeSingle();

      if (existente) {
        await supa.from("selecoes").update(payload).eq("id", existente.id);
        teamToId.set(teamEng, existente.id);
        selecoes_atualizadas++;
      } else {
        const { data: nova } = await supa.from("selecoes").insert(payload).select("id").single();
        if (nova) teamToId.set(teamEng, nova.id);
        selecoes_inseridas++;
      }
    }

    let partidas_inseridas = 0, partidas_atualizadas = 0, partidas_puladas = 0;

    for (const m of matches) {
      if (!m.team1 || !m.team2 || ehPlaceholder(m.team1) || ehPlaceholder(m.team2)) {
        partidas_puladas++;
        continue;
      }

      const casaId = teamToId.get(m.team1);
      const visitId = teamToId.get(m.team2);
      if (!casaId || !visitId) {
        partidas_puladas++;
        continue;
      }

      const fase = mapFase(m.round);
      const grupo = extrairLetraGrupo(m.group);
      const dataHora = montarDataHora(m.date, m.time);

      const codigoPartida = `WC2026-${fase}-${m.team1.replace(/\s/g, "")}` +
        `-${m.team2.replace(/\s/g, "")}-${m.date}`;

      const score = m.score?.ft;
      const gols_casa = score?.[0] ?? null;
      const gols_visit = score?.[1] ?? null;
      const status = score ? "encerrada" : "agendada";
      const resultado = score
        ? (gols_casa > gols_visit ? "casa" : gols_casa < gols_visit ? "visitante" : "empate")
        : null;

      const payload = {
        fase,
        grupo,
        selecao_casa_id: casaId,
        selecao_visitante_id: visitId,
        data_hora: dataHora,
        estadio: m.ground,
        status,
        gols_casa,
        gols_visitante: gols_visit,
        resultado,
        api_fixture_id: null,
        sincronizada_em: new Date().toISOString(),
        codigo_partida: codigoPartida,
      };

      const { data: existente } = await supa
        .from("partidas")
        .select("id, status")
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
      api_football_ultimo_sync: new Date().toISOString(),
      api_football_ultimo_erro: null,
    }).eq("id", 1);

    await supa.from("api_sync_log").update({
      status: "sucesso",
      finalizado_em: new Date().toISOString(),
      partidas_inseridas,
      partidas_atualizadas,
      partidas_puladas,
      selecoes_inseridas,
      selecoes_atualizadas,
      requests_consumidos: 1,
      detalhes: { partidas_puladas, fonte: "openfootball" }
    }).eq("id", logId);

    return new Response(JSON.stringify({
      ok: true,
      selecoes: { inseridas: selecoes_inseridas, atualizadas: selecoes_atualizadas },
      partidas: { inseridas: partidas_inseridas, atualizadas: partidas_atualizadas, puladas: partidas_puladas },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await supa.from("config").update({ api_football_ultimo_erro: erro }).eq("id", 1);
    await supa.from("api_sync_log").update({
      status: "falha",
      finalizado_em: new Date().toISOString(),
      erro,
    }).eq("id", logId);
    return new Response(JSON.stringify({ erro }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});