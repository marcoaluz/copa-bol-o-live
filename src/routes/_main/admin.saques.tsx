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
import { ArrowLeft, Copy, CheckCircle2, XCircle, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/saques")({
  head: () => ({ meta: [{ title: "Admin · Saques" }] }),
  component: AdminSaquesPage,
});

function formatBRL(c: number) {
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Saque = {
  id: string;
  usuario_id: string;
  valor_centavos: number;
  chave_pix: string;
  tipo_chave: "cpf" | "email" | "telefone" | "aleatoria";
  status: "pendente" | "pago" | "rejeitado" | "cancelado";
  motivo_rejeicao: string | null;
  observacao_admin: string | null;
  solicitado_em: string;
  revisado_em: string | null;
  pago_em: string | null;
};

function AdminSaquesPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<string>("pendente");
  const [acaoOpen, setAcaoOpen] = useState(false);
  const [acaoTipo, setAcaoTipo] = useState<"pagar" | "rejeitar">("pagar");
  const [saqueSel, setSaqueSel] = useState<Saque | null>(null);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");

  const { data: saques } = useQuery({
    queryKey: ["admin-saques", filtro],
    queryFn: async () => {
      let q = supabase.from("saques").select("*").order("solicitado_em", { ascending: false });
      if (filtro !== "todos") q = q.eq("status", filtro as Saque["status"]);
      const { data, error } = await q;
      if (error) throw error;
      return data as Saque[];
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
      if (!saqueSel) return;
      const { error } = await supabase.rpc("processar_saque", {
        p_saque_id: saqueSel.id,
        p_acao: acaoTipo,
        p_motivo: acaoTipo === "rejeitar" ? motivo : undefined,
        p_observacao: observacao || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(acaoTipo === "pagar" ? "Marcado como pago!" : "Saque rejeitado e saldo devolvido.");
      setAcaoOpen(false); setMotivo(""); setObservacao(""); setSaqueSel(null);
      qc.invalidateQueries({ queryKey: ["admin-saques"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!profile?.is_admin) {
    return <div className="p-8 text-center text-muted-foreground">Acesso restrito a administradores.</div>;
  }

  const statusBadge: Record<Saque["status"], string> = {
    pendente: "bg-gold/15 text-gold",
    pago: "bg-green-500/15 text-green-500",
    rejeitado: "bg-destructive/15 text-destructive",
    cancelado: "bg-muted text-muted-foreground",
  };

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar ao admin
      </Link>
      <PageHeader title="Saques" subtitle="Solicitações de acerto via PIX" />

      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-muted-foreground">Filtro:</span>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendentes</SelectItem>
            <SelectItem value="pago">Pagos</SelectItem>
            <SelectItem value="rejeitado">Rejeitados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {!saques?.length && (
          <Card className="p-8 text-center text-muted-foreground">Nenhuma solicitação.</Card>
        )}
        {saques?.map((s) => {
          const u = pMap.get(s.usuario_id);
          return (
            <Card key={s.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-[280px]">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-semibold">{u?.nome_completo || u?.apelido || "Usuário"}</p>
                      <p className="text-xs text-muted-foreground">@{u?.apelido} · CPF {u?.cpf || "—"}</p>
                    </div>
                    <Badge className={statusBadge[s.status] + " uppercase ml-auto"}>{s.status}</Badge>
                  </div>
                  <div className="text-3xl font-bold text-gold tabular-nums">R$ {formatBRL(s.valor_centavos)}</div>
                  <div className="flex items-center gap-2 text-sm bg-surface/40 rounded-lg p-2 border border-border/50">
                    <span className="uppercase text-xs text-muted-foreground font-semibold">{s.tipo_chave}</span>
                    <code className="text-foreground flex-1 truncate">{s.chave_pix}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => { navigator.clipboard.writeText(s.chave_pix); toast.success("Chave copiada"); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Solicitado em {new Date(s.solicitado_em).toLocaleString("pt-BR")}
                  </p>
                  {s.motivo_rejeicao && (
                    <p className="text-xs text-destructive">Motivo: {s.motivo_rejeicao}</p>
                  )}
                  {s.observacao_admin && (
                    <p className="text-xs text-muted-foreground">Obs: {s.observacao_admin}</p>
                  )}
                </div>
                {s.status === "pendente" && (
                  <div className="flex flex-col gap-2 min-w-[160px]">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700"
                      onClick={() => { setSaqueSel(s); setAcaoTipo("pagar"); setAcaoOpen(true); }}>
                      <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar como pago
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={() => { setSaqueSel(s); setAcaoTipo("rejeitar"); setAcaoOpen(true); }}>
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
              {acaoTipo === "pagar" ? "Confirmar pagamento PIX" : "Rejeitar solicitação"}
            </DialogTitle>
            <DialogDescription>
              {acaoTipo === "pagar"
                ? "Confirme APÓS ter feito o PIX manualmente. O saldo do usuário já foi debitado."
                : "O saldo será devolvido ao usuário. Informe o motivo."}
            </DialogDescription>
          </DialogHeader>
          {saqueSel && (
            <div className="bg-surface/40 rounded-lg p-3 border border-border/50 text-sm space-y-1">
              <div>Valor: <strong>R$ {formatBRL(saqueSel.valor_centavos)}</strong></div>
              <div>Chave: <code>{saqueSel.chave_pix}</code></div>
            </div>
          )}
          {acaoTipo === "rejeitar" && (
            <div className="space-y-2">
              <label className="text-sm">Motivo (mínimo 3 caracteres) *</label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Chave PIX não pertence ao usuário" />
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
              className={acaoTipo === "pagar" ? "bg-green-600 hover:bg-green-700" : ""}
              variant={acaoTipo === "rejeitar" ? "destructive" : "default"}
            >
              <Send className="w-4 h-4 mr-2" />
              {mut.isPending ? "Processando..." : acaoTipo === "pagar" ? "Confirmar pagamento" : "Rejeitar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
