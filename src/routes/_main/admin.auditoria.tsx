import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download } from "lucide-react";

export const Route = createFileRoute("/_main/admin/auditoria")({
  head: () => ({ meta: [{ title: "Admin · Auditoria" }] }),
  component: Page,
});

function Page() {
  const [acao, setAcao] = useState<string>("todas");
  const [usuario, setUsuario] = useState("");
  const [desde, setDesde] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["admin", "auditoria", acao, usuario, desde],
    queryFn: async () => {
      let q = supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500);
      if (acao !== "todas") q = q.eq("acao", acao);
      if (usuario) q = q.eq("usuario_id", usuario);
      if (desde) q = q.gte("created_at", desde);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const exportCSV = () => {
    const header = ["created_at", "fonte", "acao", "usuario_id", "partida_id", "dados"];
    const lines = [header.join(",")].concat(
      (rows ?? []).map((r: any) => [
        r.created_at, r.fonte, r.acao, r.usuario_id ?? "", r.partida_id ?? "",
        JSON.stringify(r.dados ?? {}).replace(/"/g, '""'),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-3 hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
      <PageHeader title="Auditoria" subtitle="Log imutável de ações administrativas" />

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Select value={acao} onValueChange={setAcao}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as ações</SelectItem>
            <SelectItem value="lancar_resultado">Lançar resultado</SelectItem>
            <SelectItem value="cancelar_partida">Cancelar partida</SelectItem>
            <SelectItem value="processar_saque">Processar saque</SelectItem>
            <SelectItem value="bloquear_usuario">Bloquear usuário</SelectItem>
            <SelectItem value="desbloquear_usuario">Desbloquear usuário</SelectItem>
            <SelectItem value="ajustar_saldo">Ajustar saldo</SelectItem>
            <SelectItem value="sync_external">Sync externo</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="UUID do usuário" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <Button variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-2" /> Exportar CSV</Button>
      </div>

      <Card className="bg-card border-border rounded-xl shadow-card divide-y divide-border">
        {(rows ?? []).map((r: any) => (
          <div key={r.id} className="p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{r.acao} <span className="text-xs text-muted-foreground">[{r.fonte}]</span></span>
              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <p className="text-xs text-muted-foreground">user: {r.usuario_id ?? "—"} {r.partida_id && `· partida: ${r.partida_id}`}</p>
            <pre className="text-[11px] bg-surface mt-1 p-2 rounded max-h-40 overflow-auto">{JSON.stringify(r.dados, null, 2)}</pre>
          </div>
        ))}
        {(!rows || rows.length === 0) && <p className="p-4 text-sm text-muted-foreground">Nenhum registro.</p>}
      </Card>
    </div>
  );
}