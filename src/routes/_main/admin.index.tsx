import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Users, Trophy, Settings, Banknote, Wallet, FileText, ClipboardList,
  TrendingUp, AlertCircle, MailPlus, ArrowDownCircle, Scale,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_main/admin/")({
  head: () => ({ meta: [{ title: "Admin — Copa Bolão 2026" }] }),
  component: AdminPage,
});

const fmt = (c: number) =>
  "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const tiles = [
  { icon: Trophy, label: "Partidas", desc: "Lançar resultados e apurar", to: "/admin/partidas" as const },
  { icon: ArrowDownCircle, label: "Depósitos", desc: "Confirmar PIX recebido", to: "/admin/depositos" as const },
  { icon: Banknote, label: "Saques", desc: "Aprovar acertos via PIX", to: "/admin/saques" as const },
  { icon: Scale, label: "Custódia", desc: "Conciliação com extrato", to: "/admin/custodia" as const },
  { icon: Users, label: "Usuários", desc: "Bloquear, ajustar saldo", to: "/admin/usuarios" as const },
  { icon: MailPlus, label: "Convites", desc: "Allowlist do bolão privado", to: "/admin/convites" as const },
  { icon: Settings, label: "Configurações", desc: "Limites e manutenção", to: "/admin/configuracoes" as const },
  { icon: ClipboardList, label: "Auditoria", desc: "Log imutável de ações", to: "/admin/auditoria" as const },
  { icon: FileText, label: "Relatórios", desc: "Exportar CSV financeiro", to: "/admin/relatorios" as const },
  { icon: ClipboardList, label: "Checklist", desc: "Pré-lançamento", to: "/admin/checklist" as const },
];

function AdminPage() {
  const { data: stats } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_dashboard_stats");
      if (error) throw error;
      return data as Record<string, number>;
    },
  });
  const { data: receita } = useQuery({
    queryKey: ["admin", "receita30"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_receita_diaria", { p_dias: 30 });
      if (error) throw error;
      return (data ?? []) as Array<{ dia: string; apostado: number; premios: number; taxa: number }>;
    },
  });
  const { data: top } = useQuery({
    queryKey: ["admin", "topPartidas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_top_partidas", { p_limite: 5 });
      if (error) throw error;
      return (data ?? []) as Array<{ partida_id: string; codigo: string; fase: string; data_hora: string; bolo_centavos: number; qtd_apostas: number }>;
    },
  });
  const { data: convitesPendentes } = useQuery({
    queryKey: ["admin", "convitesPendentes"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("usuarios_autorizados")
        .select("email", { count: "exact", head: true })
        .eq("convite_aceito", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const { data: depositosPendentes } = useQuery({
    queryKey: ["admin", "depositosPendentes"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("depositos")
        .select("id", { count: "exact", head: true })
        .eq("status", "aguardando_confirmacao");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const chartData = (receita ?? []).map((r) => ({
    dia: new Date(r.dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    Apostado: r.apostado / 100,
    Prêmios: r.premios / 100,
    Taxa: r.taxa / 100,
  }));

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-gold" />
        <span className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Acesso restrito</span>
      </div>
      <PageHeader title="Painel Admin" subtitle="Visão geral do Copa Bolão 2026" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi icon={Users} label="Usuários ativos" value={String(stats?.usuarios_ativos ?? "—")} sub={`${stats?.usuarios_bloqueados ?? 0} bloqueados`} />
        <Kpi icon={Wallet} label="Em custódia" value={fmt(stats?.total_custodia_centavos ?? 0)} />
        <Kpi icon={TrendingUp} label="Apostado hoje" value={fmt(stats?.apostado_hoje ?? 0)} sub={`Mês: ${fmt(stats?.apostado_mes ?? 0)}`} />
        <Kpi icon={Banknote} label="Taxa acumulada" value={fmt(stats?.taxa_acumulada_centavos ?? 0)} />
      </div>

      {(stats?.saques_pendentes_qtd ?? 0) > 0 && (
        <Link to="/admin/saques">
          <Card className="bg-gold/10 border-gold/40 rounded-xl p-4 mb-6 flex items-center gap-3 hover:bg-gold/15 transition">
            <AlertCircle className="w-5 h-5 text-gold" />
            <div className="flex-1">
              <p className="font-semibold text-gold">
                {stats?.saques_pendentes_qtd} saque(s) pendente(s) — {fmt(stats?.saques_pendentes_total ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Toque para revisar</p>
            </div>
            <Badge className="bg-gold text-gold-foreground">URGENTE</Badge>
          </Card>
        </Link>
      )}

      <Card className="bg-card border-border rounded-xl p-5 shadow-card mb-6">
        <h3 className="font-semibold mb-4">Receita diária (últimos 30 dias)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="Apostado" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Prêmios" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Taxa" stroke="hsl(var(--gold))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl p-5 shadow-card mb-6">
        <h3 className="font-semibold mb-3">Top 5 partidas com maior bolo</h3>
        <div className="divide-y divide-border">
          {(top ?? []).map((p) => (
            <div key={p.partida_id} className="py-2 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{p.codigo ?? "—"} <span className="text-xs text-muted-foreground">({p.fase})</span></p>
                <p className="text-xs text-muted-foreground">{new Date(p.data_hora).toLocaleString("pt-BR")} · {p.qtd_apostas} apostas</p>
              </div>
              <span className="font-semibold text-gold tabular-nums">{fmt(p.bolo_centavos)}</span>
            </div>
          ))}
          {(!top || top.length === 0) && <p className="text-sm text-muted-foreground py-2">Sem partidas com apostas ainda.</p>}
        </div>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link key={t.label} to={t.to}>
            <Card className="bg-card border-border rounded-xl p-5 shadow-card hover:border-gold/50 transition-colors cursor-pointer h-full">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center mb-3"><t.icon className="w-5 h-5 text-gold" /></div>
              <h3 className="font-semibold mb-1 flex items-center gap-2">
                {t.label}
                {t.label === "Convites" && (convitesPendentes ?? 0) > 0 && (
                  <Badge className="bg-gold text-gold-foreground">{convitesPendentes} pend.</Badge>
                )}
                {t.label === "Depósitos" && (depositosPendentes ?? 0) > 0 && (
                  <Badge className="bg-gold text-gold-foreground">{depositosPendentes} pend.</Badge>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card className="bg-card border-border rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="w-4 h-4" /> {label}
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}
