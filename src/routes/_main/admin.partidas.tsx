import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LancarResultadoDialog } from "@/components/LancarResultadoDialog";
import { usePartidas, useSelecoes, selecaoMap, FASE_LABEL, type Partida } from "@/lib/tournament";
import { useSelfTest } from "@/lib/admin";
import { formatBRL } from "@/lib/bets";
import { useAuth } from "@/hooks/use-auth";
import { Beaker, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/partidas")({
  head: () => ({ meta: [{ title: "Admin · Partidas" }] }),
  component: AdminPartidasPage,
});

function AdminPartidasPage() {
  const { profile } = useAuth();
  const { data: partidas } = usePartidas();
  const { data: selecoes } = useSelecoes();
  const sMap = useMemo(() => selecaoMap(selecoes), [selecoes]);
  const selfTest = useSelfTest();

  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [partidaSel, setPartidaSel] = useState<Partida | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  if (!profile?.is_admin) {
    return (
      <Card className="bg-card border-border p-6 text-center">
        Acesso restrito a administradores.
      </Card>
    );
  }

  const lista = (partidas ?? []).filter((p) => statusFiltro === "todos" || p.status === statusFiltro);

  const onAbrir = (p: Partida) => { setPartidaSel(p); setOpen(true); };

  const runSelfTest = async () => {
    setTestResult(null);
    try {
      const r = await selfTest.mutateAsync();
      setTestResult(r);
      if (r.passed === r.total) toast.success(`${r.passed}/${r.total} testes passaram ✅`);
      else toast.error(`${r.passed}/${r.total} testes passaram`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <Link to="/admin" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
        <ArrowLeft className="w-3 h-3" /> Voltar ao admin
      </Link>
      <PageHeader title="Gestão de partidas" subtitle="Lance resultados, apure e distribua prêmios" />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="w-44 bg-card border-border"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card border-border z-50">
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="agendada">Agendadas</SelectItem>
            <SelectItem value="ao_vivo">Ao vivo</SelectItem>
            <SelectItem value="encerrada">Encerradas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="border-gold/40 text-gold hover:bg-gold/10" onClick={runSelfTest} disabled={selfTest.isPending}>
          <Beaker className="w-4 h-4 mr-2" />
          {selfTest.isPending ? "Executando…" : "Executar testes de apuração"}
        </Button>
      </div>

      {testResult && (
        <Card className="bg-card border-border p-4 mb-4">
          <div className="text-sm font-semibold mb-2">
            Resultado dos testes — {testResult.passed}/{testResult.total} {testResult.passed === testResult.total ? "✅" : "❌"}
          </div>
          <div className="space-y-2">
            {testResult.results.map((r: any) => (
              <div key={r.caso} className={`text-xs border rounded-lg p-2 ${r.pass ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
                <div className="font-semibold">{r.pass ? "✅" : "❌"} Caso {r.caso} — {r.descricao}</div>
                <div className="text-muted-foreground">esperado: {r.esperado}</div>
                <pre className="text-[10px] mt-1 overflow-auto">{JSON.stringify(r.obtido, null, 2)}</pre>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-2">
        {lista.map((p) => {
          const casa = p.selecao_casa_id ? sMap[p.selecao_casa_id] : null;
          const visit = p.selecao_visitante_id ? sMap[p.selecao_visitante_id] : null;
          return (
            <Card key={p.id} className="bg-card border-border p-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Badge variant="secondary" className="text-[10px]">{FASE_LABEL[p.fase]}</Badge>
                  {p.grupo && <Badge variant="outline" className="text-[10px]">Grupo {p.grupo}</Badge>}
                  <StatusBadge status={p.status} />
                  {p.bolo_acumulado_centavos != null && p.bolo_acumulado_centavos > 0 && (
                    <span className="text-gold">jackpot {formatBRL(p.bolo_acumulado_centavos)}</span>
                  )}
                </div>
                <div className="text-sm font-semibold truncate">
                  {casa?.nome ?? p.placeholder_casa ?? "—"}
                  {p.gols_casa != null && <span className="text-gold mx-2">{p.gols_casa} - {p.gols_visitante}</span>}
                  {p.gols_casa == null && <span className="text-muted-foreground mx-2">vs</span>}
                  {visit?.nome ?? p.placeholder_visitante ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">{new Date(p.data_hora).toLocaleString("pt-BR")}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => onAbrir(p)}>Gerenciar</Button>
            </Card>
          );
        })}
        {lista.length === 0 && (
          <Card className="bg-card border-border p-6 text-center text-muted-foreground">Nenhuma partida.</Card>
        )}
      </div>

      <LancarResultadoDialog partida={partidaSel} sMap={sMap} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function StatusBadge({ status }: { status: Partida["status"] }) {
  const map: Record<Partida["status"], string> = {
    agendada: "bg-muted text-muted-foreground border-border",
    ao_vivo: "bg-destructive/20 text-destructive border-destructive/40",
    encerrada: "bg-primary/15 text-primary border-primary/40",
    cancelada: "bg-surface-elevated text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={`text-[10px] ${map[status]}`}>{status}</Badge>;
}