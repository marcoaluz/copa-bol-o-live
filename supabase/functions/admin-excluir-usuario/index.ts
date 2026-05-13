import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ erro: "Não autenticado" }, 401);

    const { data: userData, error: userErr } = await supa.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData.user) return json({ erro: "Token inválido" }, 401);

    const { data: caller } = await supa.from("profiles").select("is_admin").eq("id", userData.user.id).single();
    if (!caller?.is_admin) return json({ erro: "Sem permissão" }, 403);

    const { usuario_id, forcar } = (await req.json()) ?? {};
    if (!usuario_id) return json({ erro: "usuario_id obrigatório" }, 400);
    if (usuario_id === userData.user.id) return json({ erro: "Você não pode excluir a si mesmo" }, 400);

    const { data: alvo } = await supa.from("profiles").select("id, is_admin, saldo_centavos, apelido, nome_completo").eq("id", usuario_id).maybeSingle();
    if (!alvo) return json({ erro: "Usuário não encontrado" }, 404);
    if (alvo.is_admin) return json({ erro: "Não é possível excluir outro admin. Remova o status de admin antes." }, 400);

    if (!forcar) {
      if ((alvo.saldo_centavos ?? 0) !== 0) return json({ erro: `Usuário tem saldo de R$ ${(alvo.saldo_centavos / 100).toFixed(2)}. Zere o saldo antes de excluir ou marque "forçar".` }, 400);
      const { count: pendDep } = await supa.from("depositos").select("id", { head: true, count: "exact" }).eq("usuario_id", usuario_id).in("status", ["aguardando_pagamento", "aguardando_confirmacao"]);
      if ((pendDep ?? 0) > 0) return json({ erro: "Existem depósitos pendentes." }, 400);
      const { count: pendSaq } = await supa.from("saques").select("id", { head: true, count: "exact" }).eq("usuario_id", usuario_id).eq("status", "pendente");
      if ((pendSaq ?? 0) > 0) return json({ erro: "Existem saques pendentes." }, 400);
    }

    const tabelas = ["apostas", "apostas_placar", "transacoes", "depositos", "saques", "notificacoes", "suporte_mensagens"];
    for (const t of tabelas) {
      const { error } = await supa.from(t).delete().eq("usuario_id", usuario_id);
      if (error) return json({ erro: `Falha ao limpar ${t}: ${error.message}` }, 500);
    }
    await supa.from("profiles").delete().eq("id", usuario_id);

    const { error: delErr } = await supa.auth.admin.deleteUser(usuario_id);
    if (delErr) return json({ erro: `Auth: ${delErr.message}` }, 500);

    await supa.from("audit_log").insert({
      usuario_id: userData.user.id,
      fonte: "manual",
      acao: "excluir_usuario",
      dados: { alvo: usuario_id, apelido: alvo.apelido, nome: alvo.nome_completo, forcar: !!forcar },
    });

    return json({ ok: true });
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
