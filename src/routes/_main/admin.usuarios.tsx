import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Lock, Unlock, Wallet, Search, KeyRound, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/usuarios")({
  head: () => ({ meta: [{ title: "Admin · Usuários" }] }),
  component: Page,
});

const fmt = (c: number) =>
  "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Page() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativos" | "bloqueados" | "comSaldo">("todos");
  const [ajuste, setAjuste] = useState<{ id: string; nome: string } | null>(null);
  const [bloqueio, setBloqueio] = useState<{ id: string; nome: string } | null>(null);
  const [reset, setReset] = useState<{ id: string; nome: string } | null>(null);
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["admin", "usuarios", filtro, busca],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, nome_completo, apelido, saldo_centavos, bloqueado, bloqueado_motivo, created_at, is_admin").order("created_at", { ascending: false }).limit(500);
      if (filtro === "ativos") q = q.eq("bloqueado", false);
      if (filtro === "bloqueados") q = q.eq("bloqueado", true);
      if (filtro === "comSaldo") q = q.gt("saldo_centavos", 0);
      if (busca.trim()) q = q.or(`apelido.ilike.%${busca}%,nome_completo.ilike.%${busca}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const mBlock = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await (supabase as any).rpc("bloquear_usuario", { p_user_id: id, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Usuário bloqueado"); qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }); setBloqueio(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const mUnblock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("desbloquear_usuario", { p_user_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Usuário desbloqueado"); qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const mAjuste = useMutation({
    mutationFn: async ({ id, valor, motivo }: { id: string; valor: number; motivo: string }) => {
      const { error } = await (supabase as any).rpc("ajustar_saldo_usuario", { p_user_id: id, p_delta_centavos: valor, p_motivo: motivo });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saldo ajustado"); qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }); setAjuste(null); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-3 hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
      <PageHeader title="Usuários" subtitle="Gestão de jogadores" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou apelido…" className="pl-9" />
        </div>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="bloqueados">Bloqueados</SelectItem>
            <SelectItem value="comSaldo">Com saldo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border rounded-xl shadow-card divide-y divide-border">
        {(users ?? []).map((u) => (
          <div key={u.id} className="p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{u.nome_completo || "—"}</p>
                {u.is_admin && <Badge variant="outline" className="text-[10px]">admin</Badge>}
                {u.bloqueado && <Badge variant="destructive" className="text-[10px]">bloqueado</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">@{u.apelido} · {fmt(u.saldo_centavos)}</p>
              {u.bloqueado && u.bloqueado_motivo && <p className="text-[11px] text-destructive mt-0.5">Motivo: {u.bloqueado_motivo}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Link to="/admin/usuarios/$id" params={{ id: u.id }}>
                <Button size="sm" variant="outline">Detalhes</Button>
              </Link>
              <Button size="sm" variant="outline" onClick={() => setAjuste({ id: u.id, nome: u.nome_completo || u.apelido || "" })}>
                <Wallet className="w-3 h-3 mr-1" /> Ajustar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setReset({ id: u.id, nome: u.nome_completo || u.apelido || "" })}>
                <KeyRound className="w-3 h-3 mr-1" /> Resetar senha
              </Button>
              {u.bloqueado ? (
                <Button size="sm" variant="outline" onClick={() => mUnblock.mutate(u.id)}>
                  <Unlock className="w-3 h-3 mr-1" /> Desbloquear
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={() => setBloqueio({ id: u.id, nome: u.nome_completo || u.apelido || "" })}>
                  <Lock className="w-3 h-3 mr-1" /> Bloquear
                </Button>
              )}
            </div>
          </div>
        ))}
        {(!users || users.length === 0) && <p className="p-4 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>}
      </Card>

      <AjustarSaldoDialog data={ajuste} onClose={() => setAjuste(null)} onSubmit={(v, m) => ajuste && mAjuste.mutate({ id: ajuste.id, valor: v, motivo: m })} loading={mAjuste.isPending} />
      <BloquearDialog data={bloqueio} onClose={() => setBloqueio(null)} onSubmit={(m) => bloqueio && mBlock.mutate({ id: bloqueio.id, motivo: m })} loading={mBlock.isPending} />
      <ResetarSenhaDialog data={reset} onClose={() => setReset(null)} />
    </div>
  );
}

function AjustarSaldoDialog({ data, onClose, onSubmit, loading }: { data: { id: string; nome: string } | null; onClose: () => void; onSubmit: (centavos: number, motivo: string) => void; loading: boolean }) {
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar saldo — {data?.nome}</DialogTitle>
          <DialogDescription>Use valores positivos para crédito e negativos para débito (em reais).</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input type="number" step="0.01" placeholder="Ex: 50.00 ou -25.50" value={valor} onChange={(e) => setValor(e.target.value)} />
          <Textarea placeholder="Motivo (obrigatório, mín. 5 caracteres)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={loading} onClick={() => {
            const reais = parseFloat(valor.replace(",", "."));
            if (!reais || isNaN(reais)) { toast.error("Valor inválido"); return; }
            if (motivo.trim().length < 5) { toast.error("Motivo obrigatório"); return; }
            onSubmit(Math.round(reais * 100), motivo.trim());
          }}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BloquearDialog({ data, onClose, onSubmit, loading }: { data: { id: string; nome: string } | null; onClose: () => void; onSubmit: (motivo: string) => void; loading: boolean }) {
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear — {data?.nome}</DialogTitle>
          <DialogDescription>Usuário não poderá apostar nem sacar enquanto bloqueado.</DialogDescription>
        </DialogHeader>
        <Textarea placeholder="Motivo do bloqueio" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" disabled={loading} onClick={() => {
            if (motivo.trim().length < 3) { toast.error("Informe motivo"); return; }
            onSubmit(motivo.trim());
          }}>Bloquear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetarSenhaDialog({ data, onClose }: { data: { id: string; nome: string } | null; onClose: () => void }) {
  const [novaSenha, setNovaSenha] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "senha" | "link">("");

  const reset = () => { setNovaSenha(""); setLink(null); setBusy(""); };

  const definirSenha = async () => {
    if (!data) return;
    if (novaSenha.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setBusy("senha");
    const { data: res, error } = await supabase.functions.invoke("admin-resetar-senha", {
      body: { acao: "definir_senha", usuario_id: data.id, nova_senha: novaSenha },
    });
    setBusy("");
    if (error || (res as any)?.erro) { toast.error((res as any)?.erro || error?.message || "Falhou"); return; }
    toast.success("Senha definida! Envie por WhatsApp ao usuário.");
    setNovaSenha("");
  };

  const gerarLink = async () => {
    if (!data) return;
    setBusy("link");
    const { data: res, error } = await supabase.functions.invoke("admin-resetar-senha", {
      body: { acao: "gerar_link", usuario_id: data.id },
    });
    setBusy("");
    if (error || (res as any)?.erro) { toast.error((res as any)?.erro || error?.message || "Falhou"); return; }
    setLink((res as any)?.link ?? null);
    toast.success("Link gerado (válido por 1h)");
  };

  const copiar = async (s: string) => {
    try { await navigator.clipboard.writeText(s); toast.success("Copiado"); } catch { toast.error("Não foi possível copiar"); }
  };

  return (
    <Dialog open={!!data} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetar senha — {data?.nome}</DialogTitle>
          <DialogDescription>
            Defina uma senha temporária ou gere um link de recuperação para enviar ao usuário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 border border-border rounded-md p-3">
            <p className="text-xs font-medium">Opção A — Definir senha temporária</p>
            <Input type="text" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
            <Button size="sm" disabled={busy === "senha"} onClick={definirSenha} className="w-full">
              {busy === "senha" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Definir senha
            </Button>
          </div>

          <div className="space-y-2 border border-border rounded-md p-3">
            <p className="text-xs font-medium">Opção B — Gerar link de recuperação (1h)</p>
            <Button size="sm" variant="outline" disabled={busy === "link"} onClick={gerarLink} className="w-full">
              {busy === "link" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Gerar link
            </Button>
            {link && (
              <div className="space-y-2">
                <Textarea readOnly value={link} className="text-xs font-mono" rows={3} />
                <Button size="sm" variant="outline" onClick={() => copiar(link)} className="w-full">
                  <Copy className="w-3 h-3 mr-1" /> Copiar link
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}