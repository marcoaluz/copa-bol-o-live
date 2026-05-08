import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Copy, CheckCircle2, XCircle, Send, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/depositos")({
  head: () => ({ meta: [{ title: "Admin · Depósitos" }] }),
  component: AdminDepositosPage,
});

function fmt(c: number) {
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function tempoDecorrido(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

type Deposito = {
  id: string;
  usuario_id: string;
  valor_centavos: number;
  codigo_referencia: string;
  status: "aguardando_pagamento" | "aguardando_confirmacao" | "confirmado" | "rejeitado" | "expirado";
  motivo_rejeicao: string | null;
  observacao_admin: string | null;
  e2e_id_pix: string | null;
  created_at: string;
  confirmado_em: string | null;
};

function AdminDepositosPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<string>("aguardando_confirmacao");
  const [acaoOpen, setAcaoOpen] = useState(false);
  const [acaoTipo, setAcaoTipo] = useState<"confirmar" | "rejeitar">("confirmar");
  const [sel, setSel] = useState<Deposito | null>(null);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [e2e, setE2e] = useState("");

  const { data: deps } = useQuery({
    queryKey: ["admin-depositos", filtro],
    queryFn: async () => {
      let q = (supabase as any).from("depositos").select("*").order("created_at", { ascending: false });
      if (filtro !== "todos") q = q.eq("status", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return data as Deposito[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles-light"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, apelido, nome_completo, cpf");
      if (error) throw error;
      return data;
    },
  });
  const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const mut = useMutation({
    mutationFn: async () => {
      if (!sel) return;
      const { error } = await (supabase as any).rpc("processar_deposito", {
        p_deposito_id: sel.id,
        p_acao: acaoTipo,
        p_motivo: acaoTipo === "rejeitar" ? motivo : null,
        p_e2e_id: e2e || null,
        p_observacao: observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(acaoTipo === "confirmar" ? "Depósito confirmado e saldo creditado." : "Depósito rejeitado.");
      setAcaoOpen(false); setMotivo(""); setObservacao(""); setE2e(""); setSel(null);
      qc.invalidateQueries({ queryKey: ["admin-depositos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!profile?.is_admin) {
    return <div className="p-8 text-center text-muted-foreground">Acesso restrito.</div>;
  }

  const statusLabel: Record<Deposito["status"], string> = {
    aguardando_pagamento: "aguardando pgto",
    aguardando_confirmacao: "aguardando confirmação",
    confirmado: "confirmado",
    rejeitado: "rejeitado",
    expirado: "expirado",
  };
  const statusBadge: Record<Deposito["status"], string> = {
    aguardando_pagamento: "bg-muted text-muted-foreground",
    aguardando_confirmacao: "bg-gold/15 text-gold",
    confirmado: "bg-green-500/15 text-green-500",
    rejeitado: "bg-destructive/15 text-destructive",
    expirado: "bg-muted text-muted-foreground",
  };

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar ao admin
      </Link>
      <PageHeader title="Depósitos" subtitle="Confirmação manual de PIX recebido" />

      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground">Filtro:</span>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aguardando_confirmacao">Aguardando confirmação</SelectItem>
            <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
            <SelectItem value="confirmado">Confirmados</SelectItem>
            <SelectItem value="rejeitado">Rejeitados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {!deps?.length && (
          <Card className="p-8 text-center text-muted-foreground">Nenhum depósito.</Card>
        )}
        {deps?.map((d) => {
          const u = pMap.get(d.usuario_id);
          const podeAgir = d.status === "aguardando_pagamento" || d.status === "aguardando_confirmacao";
          return (
            <Card key={d.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-[280px]">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <p className="font-semibold">{u?.nome_completo || u?.apelido || "Usuário"}</p>
                      <p className="text-xs text-muted-foreground">@{u?.apelido} · CPF {u?.cpf || "—"}</p>
                    </div>
                    <Badge className={statusBadge[d.status] + " uppercase"}>{statusLabel[d.status]}</Badge>
                  </div>
                  <div className="text-3xl font-bold text-gold tabular-nums">R$ {fmt(d.valor_centavos)}</div>
                  <div className="flex items-center gap-2 text-sm bg-primary/10 border border-primary/30 rounded-lg p-2">
                    <span className="text-xs text-primary font-semibold uppercase tracking-wider">código</span>
                    <code className="text-xl font-bold tabular-nums tracking-wider flex-1">{d.codigo_referencia}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => { navigator.clipboard.writeText(d.codigo_referencia); toast.success("Copiado"); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Solicitado {new Date(d.created_at).toLocaleString("pt-BR")} · há {tempoDecorrido(d.created_at)}
                  </p>
                  {d.e2e_id_pix && <p className="text-xs text-muted-foreground">E2E: <code>{d.e2e_id_pix}</code></p>}
                  {d.motivo_rejeicao && <p className="text-xs text-destructive">Motivo: {d.motivo_rejeicao}</p>}
                  {d.observacao_admin && <p className="text-xs text-muted-foreground">Obs: {d.observacao_admin}</p>}
                </div>
                {podeAgir && (
                  <div className="flex flex-col gap-2 min-w-[160px]">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700"
                      onClick={() => { setSel(d); setAcaoTipo("confirmar"); setAcaoOpen(true); }}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={() => { setSel(d); setAcaoTipo("rejeitar"); setAcaoOpen(true); }}>
                      <XCircle className="w-4 h-4 mr-2" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog open={acaoOpen} onOpenChange={setAcaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acaoTipo === "confirmar" ? "Confirmar depósito recebido" : "Rejeitar depósito"}
            </DialogTitle>
            <DialogDescription>
              {acaoTipo === "confirmar"
                ? "O saldo será creditado imediatamente após confirmar."
                : "Informe o motivo da rejeição."}
            </DialogDescription>
          </DialogHeader>

          {sel && acaoTipo === "confirmar" && (
            <div className="bg-gold/10 border border-gold/40 rounded-lg p-3 text-sm flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-gold" />
              <span>
                Confira no extrato do seu banco se recebeu PIX de{" "}
                <strong>R$ {fmt(sel.valor_centavos)}</strong> com o código{" "}
                <strong>{sel.codigo_referencia}</strong>. Só confirme APÓS verificar.
              </span>
            </div>
          )}

          {acaoTipo === "confirmar" && (
            <div className="space-y-2">
              <label className="text-sm">ID end-to-end do PIX (E2E) — opcional</label>
              <Input value={e2e} onChange={(e) => setE2e(e.target.value)} placeholder="E2E... (auditoria)" />
            </div>
          )}
          {acaoTipo === "rejeitar" && (
            <div className="space-y-2">
              <label className="text-sm">Motivo (mínimo 3 caracteres) *</label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: PIX não localizado no extrato" />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm">Observação interna (opcional)</label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcaoOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => mut.mutate()}
              disabled={mut.isPending || (acaoTipo === "rejeitar" && motivo.trim().length < 3)}
              className={acaoTipo === "confirmar" ? "bg-green-600 hover:bg-green-700" : ""}
              variant={acaoTipo === "rejeitar" ? "destructive" : "default"}
            >
              <Send className="w-4 h-4 mr-2" />
              {mut.isPending ? "Processando..." : acaoTipo === "confirmar" ? "Confirmar" : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}