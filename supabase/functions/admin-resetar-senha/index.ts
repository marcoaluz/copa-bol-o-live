import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ erro: "Não autenticado" }, 401);

    const { data: userData, error: userErr } = await supa.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !userData.user) return json({ erro: "Token inválido" }, 401);

    const { data: profile } = await supa
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();
    if (!profile?.is_admin) return json({ erro: "Sem permissão" }, 403);

    const body = await req.json();
    const { acao, usuario_id, nova_senha } = body ?? {};

    if (!usuario_id) return json({ erro: "usuario_id obrigatório" }, 400);

    if (acao === "definir_senha") {
      if (!nova_senha || typeof nova_senha !== "string" || nova_senha.length < 6) {
        return json({ erro: "Senha mínima de 6 caracteres" }, 400);
      }
      const { error } = await supa.auth.admin.updateUserById(usuario_id, {
        password: nova_senha,
      });
      if (error) throw error;

      await supa.from("audit_log").insert({
        usuario_id: userData.user.id,
        fonte: "manual",
        acao: "resetar_senha",
        dados: { alvo: usuario_id },
      });

      return json({ ok: true });
    }

    if (acao === "gerar_link") {
      const { data: targetUser, error: getErr } = await supa.auth.admin.getUserById(usuario_id);
      if (getErr) throw getErr;
      const email = targetUser?.user?.email;
      if (!email) return json({ erro: "Usuário não encontrado" }, 404);

      const { data, error } = await supa.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      if (error) throw error;

      await supa.from("audit_log").insert({
        usuario_id: userData.user.id,
        fonte: "manual",
        acao: "gerar_link_recuperacao",
        dados: { alvo: usuario_id },
      });

      return json({ link: data.properties?.action_link });
    }

    return json({ erro: "Ação inválida" }, 400);
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});