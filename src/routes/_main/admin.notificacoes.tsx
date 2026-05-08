import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, RefreshCw, RotateCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/notificacoes")({
  head: () => ({ meta: [{ title: "Admin · Notificações" }] }),
  component: Page,
});

type Notif = {
  id: string;
  evento: string;
  payload: any;
  status: "pendente" | "enviada" | "falhou" | "ignorada";
  canais_enviados: string[];
  canais_falharam: string[];
  tentativas: number;
  ultimo_erro: string | null;
  enviada_em: string | null;
  created_at: string;
};

const eventoLabel: Record<string, string> = {
  deposito_pendente: "Depósito pendente",
  saque_pendente: "Saque pendente",
  novo_usuario: "Novo usuário",
};

const statusVariant = (s: string) =>
  s === "enviada" ? "default" : s === "falhou" ? "destructive" : s === "pendente" ? "secondary" : "outline";

function Page() {
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroEvento, setFiltroEvento] = useState<string>("todos");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "notificacoes", filtroStatus, filtroEvento],
    queryFn: async () => {
      let q = supabase
        .from("notificacoes_admin" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filtroStatus !== "todos") q = q.eq("status", filtroStatus);
      if (filtroEvento !== "todos") q = q.eq("evento", filtroEvento);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Notif[];
    },
  });

  const reenviar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes_admin" as any)
        .update({ status: "pendente" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcada para reenvio. Próxima execução em até 1 min.");
      qc.invalidateQueries({ queryKey: ["admin", "notificacoes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-3 hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>
      <PageHeader title="Notificações de admin" subtitle="Histórico de avisos enviados por e-mail e Telegram" />

      <Card className="bg-card border-border rounded-xl shadow-card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="falhou">Falhou</SelectItem>
                <SelectItem value="ignorada">Ignorada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Evento</label>
            <Select value={filtroEvento} onValueChange={setFiltroEvento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="deposito_pendente">Depósito pendente</SelectItem>
                <SelectItem value="saque_pendente">Saque pendente</SelectItem>
                <SelectItem value="novo_usuario">Novo usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-card p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviados</TableHead>
              <TableHead>Falharam</TableHead>
              <TableHead>Último erro</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={7} className="text-sm text-muted-foreground">Nenhuma notificação.</TableCell></TableRow>
            )}
            {data?.map((n) => (
              <TableRow key={n.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-sm">{eventoLabel[n.evento] ?? n.evento}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(n.status) as any}>{n.status}</Badge>
                </TableCell>
                <TableCell className="text-xs">{n.canais_enviados?.join(", ") || "—"}</TableCell>
                <TableCell className="text-xs text-destructive">
                  {n.canais_falharam?.join(", ") || "—"}
                </TableCell>
                <TableCell className="text-xs max-w-[280px] truncate" title={n.ultimo_erro ?? ""}>
                  {n.ultimo_erro ?? "—"}
                </TableCell>
                <TableCell>
                  {n.status === "falhou" && (
                    <Button size="sm" variant="outline" disabled={reenviar.isPending}
                      onClick={() => reenviar.mutate(n.id)}>
                      <RotateCw className="w-3 h-3 mr-1" /> Reenviar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}