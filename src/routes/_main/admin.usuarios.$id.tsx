import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_main/admin/usuarios/$id")({
  head: () => ({ meta: [{ title: "Admin · Detalhes do usuário" }] }),
  component: Page,
});

const fmt = (c: number) =>
  "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Page() {
  const { id } = Route.useParams();

  const { data: profile } = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: apostas } = useQuery({
    queryKey: ["admin", "user", id, "apostas"],
    queryFn: async () => (await supabase.from("apostas").select("*").eq("usuario_id", id).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const { data: saques } = useQuery({
    queryKey: ["admin", "user", id, "saques"],
    queryFn: async () => (await supabase.from("saques").select("*").eq("usuario_id", id).order("solicitado_em", { ascending: false })).data ?? [],
  });
  const { data: txs } = useQuery({
    queryKey: ["admin", "user", id, "txs"],
    queryFn: async () => (await supabase.from("transacoes").select("*").eq("usuario_id", id).order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  return (
    <div>
      <Link to="/admin/usuarios" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-3 hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
      <PageHeader title={profile?.nome_completo || profile?.apelido || "Usuário"} subtitle={`@${profile?.apelido ?? ""} · saldo ${fmt(profile?.saldo_centavos ?? 0)}`} />
      {profile?.bloqueado && <Badge variant="destructive" className="mb-3">Bloqueado: {profile?.bloqueado_motivo}</Badge>}

      <Section title={`Apostas (${apostas?.length ?? 0})`}>
        {(apostas ?? []).map((a: any) => (
          <Row key={a.id} l={`${a.palpite} · ${fmt(a.valor_centavos)}`} r={<Badge variant="outline">{a.status}</Badge>} sub={new Date(a.created_at).toLocaleString("pt-BR")} />
        ))}
      </Section>

      <Section title={`Saques (${saques?.length ?? 0})`}>
        {(saques ?? []).map((s: any) => (
          <Row key={s.id} l={`${fmt(s.valor_centavos)} → ${s.chave_pix}`} r={<Badge variant="outline">{s.status}</Badge>} sub={new Date(s.solicitado_em).toLocaleString("pt-BR")} />
        ))}
      </Section>

      <Section title={`Transações (${txs?.length ?? 0})`}>
        {(txs ?? []).map((t: any) => (
          <Row key={t.id} l={`${t.tipo} · ${fmt(t.valor_centavos)}`} r={<span className="text-xs tabular-nums">saldo {fmt(t.saldo_apos_centavos)}</span>} sub={`${new Date(t.created_at).toLocaleString("pt-BR")} ${t.descricao ?? ""}`} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border rounded-xl shadow-card mb-4 p-4">
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="divide-y divide-border max-h-80 overflow-auto">{children}</div>
    </Card>
  );
}
function Row({ l, r, sub }: { l: string; r: React.ReactNode; sub?: string }) {
  return (
    <div className="py-2 flex items-center justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="truncate">{l}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
      <div>{r}</div>
    </div>
  );
}