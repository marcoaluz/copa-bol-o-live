import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/relatorios")({
  head: () => ({ meta: [{ title: "Admin · Relatórios" }] }),
  component: Page,
});

const fmt = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function csv(rows: (string | number)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}
function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

function Page() {
  const today = new Date().toISOString().slice(0, 10);
  const ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [de, setDe] = useState(ago);
  const [ate, setAte] = useState(today);
  const [resumo, setResumo] = useState<{ apostas: number; premios: number; saques: number; taxa: number; ajustes: number } | null>(null);

  const carregar = async () => {
    const since = new Date(de).toISOString();
    const until = new Date(new Date(ate).getTime() + 86400000).toISOString();
    try {
      const [{ data: txs }, { data: sqs }] = await Promise.all([
        supabase.from("transacoes").select("tipo, valor_centavos, descricao").gte("created_at", since).lt("created_at", until),
        supabase.from("saques").select("valor_centavos, status, solicitado_em").gte("solicitado_em", since).lt("solicitado_em", until),
      ]);
      const apostas = (txs ?? []).filter((t: any) => t.tipo === "aposta").reduce((s: number, t: any) => s + Math.abs(t.valor_centavos), 0);
      const premios = (txs ?? []).filter((t: any) => t.tipo === "premio").reduce((s: number, t: any) => s + t.valor_centavos, 0);
      const taxa = (txs ?? []).filter((t: any) => t.tipo === "ajuste_admin" && t.descricao === "Taxa da casa").reduce((s: number, t: any) => s + Math.abs(t.valor_centavos), 0);
      const ajustes = (txs ?? []).filter((t: any) => t.tipo === "ajuste_admin" && t.descricao !== "Taxa da casa").reduce((s: number, t: any) => s + t.valor_centavos, 0);
      const saques = (sqs ?? []).filter((s: any) => s.status === "pago").reduce((s: number, x: any) => s + x.valor_centavos, 0);
      setResumo({ apostas, premios, saques, taxa, ajustes });
    } catch (e: any) { toast.error(e.message); }
  };

  const exportFinanceiro = async () => {
    const since = new Date(de).toISOString();
    const until = new Date(new Date(ate).getTime() + 86400000).toISOString();
    const { data: txs, error } = await supabase.from("transacoes").select("created_at, usuario_id, tipo, valor_centavos, saldo_apos_centavos, descricao").gte("created_at", since).lt("created_at", until).order("created_at");
    if (error) { toast.error(error.message); return; }
    const rows: (string | number)[][] = [["data", "usuario_id", "tipo", "valor_reais", "saldo_apos_reais", "descricao"]];
    (txs ?? []).forEach((t: any) => rows.push([t.created_at, t.usuario_id ?? "", t.tipo, fmt(t.valor_centavos), fmt(t.saldo_apos_centavos), t.descricao ?? ""]));
    download(`financeiro_${de}_${ate}.csv`, csv(rows));
  };

  const exportDRE = () => {
    if (!resumo) { toast.error("Carregue o resumo primeiro"); return; }
    const liquido = resumo.taxa - Math.abs(resumo.ajustes);
    const rows: (string | number)[][] = [
      ["Período", `${de} a ${ate}`],
      [],
      ["Receita: Taxa da casa", fmt(resumo.taxa)],
      ["Apostas recebidas (movimento)", fmt(resumo.apostas)],
      ["Prêmios pagos (movimento)", fmt(resumo.premios)],
      ["Saques pagos", fmt(resumo.saques)],
      ["Ajustes manuais (líquido)", fmt(resumo.ajustes)],
      [],
      ["Resultado líquido (taxa - ajustes negativos)", fmt(liquido)],
    ];
    download(`dre_${de}_${ate}.csv`, csv(rows));
  };

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-3 hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
      <PageHeader title="Relatórios" subtitle="Exporte dados financeiros para contabilidade" />

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div><Label>De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
          <Button onClick={carregar}>Carregar resumo</Button>
        </div>
      </Card>

      {resumo && (
        <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
          <h3 className="font-semibold mb-3">Resumo do período</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Stat l="Apostas" v={fmt(resumo.apostas)} />
            <Stat l="Prêmios pagos" v={fmt(resumo.premios)} />
            <Stat l="Saques pagos" v={fmt(resumo.saques)} />
            <Stat l="Taxa retida" v={fmt(resumo.taxa)} />
            <Stat l="Ajustes manuais" v={fmt(resumo.ajustes)} />
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={exportFinanceiro}><Download className="w-4 h-4 mr-2" /> Financeiro detalhado (CSV)</Button>
        <Button variant="outline" onClick={exportDRE}><Download className="w-4 h-4 mr-2" /> DRE simplificado (CSV)</Button>
      </div>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div className="bg-surface rounded-lg p-3">
      <p className="text-[11px] text-muted-foreground">{l}</p>
      <p className="font-semibold tabular-nums">R$ {v}</p>
    </div>
  );
}