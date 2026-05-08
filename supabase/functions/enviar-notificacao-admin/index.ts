import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_ADMIN_CHAT_IDS = (Deno.env.get("TELEGRAM_ADMIN_CHAT_IDS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const fmtBRL = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatarMensagem(evento: string, p: any) {
  if (evento === "deposito_pendente") {
    return {
      titulo: "💰 Novo depósito aguardando confirmação",
      corpoMd:
        `*Novo depósito pendente*\n\n` +
        `👤 ${p.usuario_nome ?? p.usuario_apelido}\n` +
        `💵 R$ ${fmtBRL(p.valor_centavos)}\n` +
        `🔖 Código: \`${p.codigo_referencia}\`\n\n` +
        `Confira o extrato bancário e confirme em /admin/depositos`,
      corpoHtml:
        `<h2>Novo depósito pendente</h2>` +
        `<p><strong>Usuário:</strong> ${p.usuario_nome ?? p.usuario_apelido}</p>` +
        `<p><strong>Valor:</strong> R$ ${fmtBRL(p.valor_centavos)}</p>` +
        `<p><strong>Código:</strong> ${p.codigo_referencia}</p>` +
        `<p>Confira o extrato bancário e confirme em <code>/admin/depositos</code></p>`,
    };
  }
  if (evento === "saque_pendente") {
    return {
      titulo: "💸 Novo saque solicitado",
      corpoMd:
        `*Saque pendente*\n\n` +
        `👤 ${p.usuario_nome ?? p.usuario_apelido}\n` +
        `💵 R$ ${fmtBRL(p.valor_centavos)}\n` +
        `🔑 ${String(p.tipo_chave).toUpperCase()}: \`${p.chave_pix}\`\n\n` +
        `Faça o PIX e marque como pago em /admin/saques`,
      corpoHtml:
        `<h2>Saque pendente</h2>` +
        `<p><strong>Usuário:</strong> ${p.usuario_nome ?? p.usuario_apelido}</p>` +
        `<p><strong>Valor:</strong> R$ ${fmtBRL(p.valor_centavos)}</p>` +
        `<p><strong>Chave (${p.tipo_chave}):</strong> ${p.chave_pix}</p>` +
        `<p>Faça o PIX e marque como pago em <code>/admin/saques</code></p>`,
    };
  }
  if (evento === "novo_usuario") {
    return {
      titulo: "👋 Novo usuário no bolão",
      corpoMd:
        `*Novo usuário cadastrado*\n\n` +
        `🙋 ${p.nome_completo}\n` +
        `@${p.apelido}`,
      corpoHtml:
        `<h2>Novo usuário cadastrado</h2>` +
        `<p>${p.nome_completo} (@${p.apelido})</p>`,
    };
  }
  return {
    titulo: "Notificação",
    corpoMd: JSON.stringify(p),
    corpoHtml: `<pre>${JSON.stringify(p)}</pre>`,
  };
}

async function enviarEmail(destino: string, titulo: string, html: string): Promise<string | null> {
  if (!RESEND_API_KEY || !destino) return "RESEND_API_KEY ou destino ausente";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Bolão Copa Amigo <onboarding@resend.dev>",
        to: [destino],
        subject: titulo,
        html,
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return `Resend ${r.status}: ${txt}`;
    }
    return null;
  } catch (e) {
    return `Resend exception: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function enviarTelegram(_titulo: string, corpoMd: string): Promise<string | null> {
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_ADMIN_CHAT_IDS.length === 0) {
    return "TELEGRAM_BOT_TOKEN ou chat_ids ausente";
  }
  const erros: string[] = [];
  for (const chatId of TELEGRAM_ADMIN_CHAT_IDS) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: corpoMd,
          parse_mode: "Markdown",
        }),
      });
      if (!r.ok) {
        const txt = await r.text();
        erros.push(`chat ${chatId}: ${r.status} ${txt}`);
      }
    } catch (e) {
      erros.push(`chat ${chatId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return erros.length === 0 ? null : erros.join(" | ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const { data: cfg } = await supa.from("config").select("*").eq("id", 1).single();
    if (!cfg) throw new Error("Config não encontrada");

    const { data: pendentes } = await supa
      .from("notificacoes_admin")
      .select("*")
      .eq("status", "pendente")
      .order("created_at", { ascending: true })
      .limit(20);

    if (!pendentes || pendentes.length === 0) {
      return new Response(JSON.stringify({ processadas: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let processadas = 0;
    for (const n of pendentes) {
      const { titulo, corpoHtml, corpoMd } = formatarMensagem(n.evento, n.payload);
      const enviados: string[] = [];
      const falharam: string[] = [];
      const erros: string[] = [];

      if (cfg.notif_email_ativo && cfg.notif_email_destino) {
        const erro = await enviarEmail(cfg.notif_email_destino, titulo, corpoHtml);
        if (erro) {
          falharam.push("email");
          erros.push(`email: ${erro}`);
        } else {
          enviados.push("email");
        }
      }

      if (cfg.notif_telegram_ativo) {
        const erro = await enviarTelegram(titulo, corpoMd);
        if (erro) {
          falharam.push("telegram");
          erros.push(`telegram: ${erro}`);
        } else {
          enviados.push("telegram");
        }
      }

      const novoStatus = enviados.length > 0 ? "enviada" : "falhou";
      await supa.from("notificacoes_admin").update({
        status: novoStatus,
        canais_enviados: enviados,
        canais_falharam: falharam,
        tentativas: (n.tentativas ?? 0) + 1,
        ultimo_erro: erros.join(" | ") || null,
        enviada_em: new Date().toISOString(),
      }).eq("id", n.id);

      processadas++;
    }

    return new Response(JSON.stringify({ processadas }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ erro: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});