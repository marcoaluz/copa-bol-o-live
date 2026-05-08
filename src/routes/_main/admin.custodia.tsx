import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowDownCircle, Banknote, Download, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/custodia")({
  head: () => ({ meta: [{ title: "Custódia & Conciliação — Admin" }] }),
  component: CustodiaPage,
});

const fmt = (c: number) =>
  "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function CustodiaPage() {
  const { data: cfg } = useQuery({
    queryKey: ["config", "custodia"],
    queryFn: async () => (await supabase.from("config").select("*").eq("id", 1).single()).data as any,
  });

  const { data: custodia } = useQuery({
    queryKey: ["admin", "custodiaTotal"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("saldo_centavos");
      return (data ?? []).reduce((s: number, p: any) => s + Number(p.saldo_centavos ?? 0), 0);
    },
  });

  const inicioMes = startOfMonthISO();

  const { data: depMes } = useQuery({
    queryKey: ["admin", "depMes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("depositos")
        .select("valor_centavos, confirmado_em")
        .eq("status", "confirmado")
        .gte("confirmado_em", inicioMes);
      const total = (data ?? []).reduce((s: number, d: any) => s + Number(d.valor_centavos), 0);
      return { total, qtd: data?.length ?? 0 };
    },
  });

  const { data: saqMes } = useQuery({
    queryKey: ["admin", "saqMes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("saques")
        .select("valor_centavos, pago_em")
        .eq("status", "pago")
        .gte("pago_em", inicioMes);
      const total = (data ?? []).reduce((s: number, d: any) => s + Number(d.valor_centavos), 0);
      return { total, qtd: data?.length ?? 0 };
    },
  });

  const { data: pendDep } = useQuery({
    queryKey: ["admin", "pendDep"],
    queryFn: async () => {
      const { data } = await supabase
        .from("depositos")
        .select("created_at")
        .eq("status", "aguardando_confirmacao");
      const arr = data ?? [];
      const agora = Date.now();
      const espera = arr.length === 0 ? 0 : arr.reduce((s, d: any) => s + (agora - new Date(d.created_at).getTime()), 0) / arr.length;
      return { qtd: arr.length, esperaMs: espera };
    },
  });

  const { data: pendSaq } = useQuery({
    queryKey: ["admin", "pendSaq"],
    queryFn: async () => {
      const { data } = await supabase
        .from("saques")
        .select("solicitado_em")
        .eq("status", "pendente");
      const arr = data ?? [];
      const agora = Date.now();
      const espera = arr.length === 0 ? 0 : arr.reduce((s, d: any) => s + (agora - new Date(d.solicitado_em).getTime()), 0) / arr.length;
      return { qtd: arr.length, esperaMs: espera };
    },
  });

  const totalCustodia = custodia ?? 0;
  const declarado = Number(cfg?.saldo_bancario_declarado_centavos ?? 0);
  const liquido = (depMes?.total ?? 0) - (saqMes?.total ?? 0);
  const alerta = declarado > 0 && totalCustodia > declarado;

  const fmtTempo = (ms: number) => {
    if (!ms) return "—";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const exportarCSV = async () => {
    try {
      const { data, error } = await supabase
        .from("transacoes")
        .select("created_at, tipo, usuario_id, valor_centavos, referencia_id, descricao")
        .gte("created_at", inicioMes)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const linhas = [
        ["data", "tipo", "usuario_id", "valor_brl", "referencia_id", "descricao"].join(","),
        ...(data ?? []).map((t: any) =>
          [
            new Date(t.created_at).toISOString(),
            t.tipo,
            t.usuario_id ?? "",
            (Number(t.valor_centavos) / 100).toFixed(2).replace(".", ","),
            t.referencia_id ?? "",
            `"${(t.descricao ?? "").replace(/"/g, '""')}"`,
          ].join(",")
        ),
      ];
      const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conciliacao-${new Date().toISOString().slice(0, 7)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado");
    } catch (e: any) {
      toast.error("Erro ao exportar: " + e.message);
    }
  };

  return (
    <div>
      <PageHeader title="Custódia & Conciliação" subtitle="Bate o app com seu extrato bancário do mês." />

      {alerta && (
        <Card className="bg-destructive/15 border-destructive/60 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-destructive">Custódia maior que saldo bancário declarado</div>
            <div className="text-sm text-muted-foreground">
              Em custódia: <b>{fmt(totalCustodia)}</b> · Declarado: <b>{fmt(declarado)}</b> · Diferença: <b>{fmt(totalCustodia - declarado)}</b>.
              Atualize o saldo bancário em Configurações ou regularize a conta.
            </div>
          </div>
        </Card>
      )}

      <Card className="bg-card border-border rounded-xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-gold" />
          <h2 className="font-display text-xl tracking-wider">Saldo em custódia</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tile label="Saldo dos usuários" value={fmt(totalCustodia)} />
          <Tile label={`Depósitos confirmados (mês)`} value={fmt(depMes?.total ?? 0)} sub={`${depMes?.qtd ?? 0} operações`} />
          <Tile label="Saques pagos (mês)" value={fmt(saqMes?.total ?? 0)} sub={`${saqMes?.qtd ?? 0} operações`} />
          <Tile label="Resultado líquido (mês)" value={fmt(liquido)} className={liquido >= 0 ? "text-primary" : "text-destructive"} />
        </div>
        <div className="text-xs text-muted-foreground mt-4">
          Saldo bancário declarado: <b>{fmt(declarado)}</b>{" "}
          <Link to="/admin/configuracoes" className="underline">editar em Configurações</Link>
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl p-6 mb-6">
        <h2 className="font-display text-xl tracking-wider mb-4">Pendências</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface rounded-xl p-4 border border-border flex items-center gap-3">
            <ArrowDownCircle className="w-8 h-8 text-gold" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Depósitos aguardando</div>
              <div className="font-display text-2xl">{pendDep?.qtd ?? 0}</div>
              <div className="text-xs text-muted-foreground">Tempo médio: {fmtTempo(pendDep?.esperaMs ?? 0)}</div>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/admin/depositos">Abrir</Link></Button>
          </div>
          <div className="bg-surface rounded-xl p-4 border border-border flex items-center gap-3">
            <Banknote className="w-8 h-8 text-gold" />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Saques pendentes</div>
              <div className="font-display text-2xl">{pendSaq?.qtd ?? 0}</div>
              <div className="text-xs text-muted-foreground">Tempo médio: {fmtTempo(pendSaq?.esperaMs ?? 0)}</div>
            </div>
            <Button asChild size="sm" variant="outline"><Link to="/admin/saques">Abrir</Link></Button>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl tracking-wider">Exportar conciliação</h2>
            <p className="text-sm text-muted-foreground">CSV com todas as movimentações do mês: data, tipo, usuário, valor, referência.</p>
          </div>
          <Button onClick={exportarCSV} className="bg-gradient-primary">
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Tile({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className="bg-surface rounded-xl p-4 border border-border">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl mt-1 ${className ?? ""}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}