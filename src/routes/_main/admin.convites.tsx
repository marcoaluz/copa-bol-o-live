import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MailPlus, Trash2, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/convites")({
  head: () => ({ meta: [{ title: "Convites — Admin" }] }),
  component: ConvitesPage,
});

type Autorizado = {
  email: string;
  convidado_por: string | null;
  convite_aceito: boolean;
  observacao: string | null;
  created_at: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string): { validos: string[]; invalidos: string[] } {
  const linhas = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const validos: string[] = [];
  const invalidos: string[] = [];
  const seen = new Set<string>();
  for (const l of linhas) {
    if (seen.has(l)) continue;
    seen.add(l);
    if (EMAIL_REGEX.test(l)) validos.push(l);
    else invalidos.push(l);
  }
  return { validos, invalidos };
}

function ConvitesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "aceitos" | "pendentes">("todos");
  const [busca, setBusca] = useState("");
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date>(() => new Date());

  useEffect(() => {
    if (profile && !profile.is_admin) navigate({ to: "/home" });
  }, [profile, navigate]);

  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["admin", "convites"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("usuarios_autorizados")
        .select("email, convidado_por, convite_aceito, observacao, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Autorizado[];
    },
  });

  useEffect(() => {
    if (isError && error) {
      toast.error(`Erro ao carregar lista: ${(error as Error).message}`);
    }
  }, [isError, error]);

  useEffect(() => {
    if (dataUpdatedAt) setUltimaAtualizacao(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  const adicionar = useMutation({
    mutationFn: async (emails: string[]) => {
      const { data, error } = await (supabase as any).rpc("adicionar_emails_autorizados", {
        p_emails: emails,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (qtd) => {
      toast.success(`${qtd} e-mail(s) autorizado(s)`);
      setRaw("");
      qc.invalidateQueries({ queryKey: ["admin", "convites"] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar"),
  });

  const remover = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await (supabase as any).rpc("remover_email_autorizado", { p_email: email });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido da allowlist.");
      qc.invalidateQueries({ queryKey: ["admin", "convites"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  const stats = useMemo(() => {
    const list = data ?? [];
    const aceitos = list.filter((x) => x.convite_aceito).length;
    return { total: list.length, aceitos, pendentes: list.length - aceitos };
  }, [data]);

  const filtrados = useMemo(() => {
    let list = data ?? [];
    if (filtro === "aceitos") list = list.filter((x) => x.convite_aceito);
    else if (filtro === "pendentes") list = list.filter((x) => !x.convite_aceito);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter((x) => x.email.includes(q));
    }
    return list;
  }, [data, filtro, busca]);

  const parsed = useMemo(() => parseEmails(raw), [raw]);

  const handleAdd = () => {
    if (parsed.invalidos.length > 0) {
      toast.error("Corrija os e-mails inválidos antes de adicionar.");
      return;
    }
    if (parsed.validos.length === 0) {
      toast.error("Cole pelo menos um e-mail.");
      return;
    }
    if (parsed.validos.length <= 2) {
      if (!confirm(`Confirmar autorização de:\n${parsed.validos.join("\n")}`)) return;
    }
    adicionar.mutate(parsed.validos);
  };

  return (
    <div>
      <PageHeader title="Convites" subtitle="Allowlist do bolão privado" />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Kpi label="Total" value={stats.total} />
        <Kpi label="Aceitos" value={stats.aceitos} />
        <Kpi label="Pendentes" value={stats.pendentes} accent />
      </div>

      <div className="flex items-center justify-end gap-2 -mt-4 mb-4 text-[11px] text-muted-foreground">
        <span>
          Última atualização: {ultimaAtualizacao.toLocaleTimeString("pt-BR")}
        </span>
        <span>·</span>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1 hover:text-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <Card className="bg-card border-border rounded-xl p-5 shadow-card mb-6">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <MailPlus className="w-4 h-4 text-gold" /> Adicionar à allowlist
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Cole e-mails autorizados (um por linha ou separados por vírgula).
        </p>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="amigo1@gmail.com&#10;amigo2@gmail.com, amigo3@gmail.com"
          className="bg-surface border-border min-h-32 mb-3"
        />

        {parsed.validos.length > 0 && (
          <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-medium text-primary mb-2">
              Serão autorizados: {parsed.validos.length} e-mail(s)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {parsed.validos.map((e) => (
                <Badge key={e} className="bg-primary/15 text-primary border-primary/30 font-normal">
                  {e}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {parsed.invalidos.length > 0 && (
          <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Formato inválido — corrija antes de adicionar ({parsed.invalidos.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {parsed.invalidos.map((e) => (
                <Badge key={e} variant="destructive" className="font-mono text-[11px]">
                  {e}
                </Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Esperado: nome@dominio.com — verifique se não falta o "@" ou o domínio.
            </p>
          </div>
        )}

        <Button
          onClick={handleAdd}
          disabled={
            adicionar.isPending ||
            parsed.invalidos.length > 0 ||
            parsed.validos.length === 0
          }
          className="bg-gradient-primary shadow-glow"
        >
          {adicionar.isPending
            ? "Adicionando..."
            : parsed.validos.length > 0
              ? `Adicionar ${parsed.validos.length} à allowlist`
              : "Adicionar à allowlist"}
        </Button>
      </Card>

      <Card className="bg-card border-border rounded-xl p-5 shadow-card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input
            placeholder="Buscar e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="bg-surface border-border flex-1"
          />
          <div className="flex gap-2">
            {(["todos", "aceitos", "pendentes"] as const).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filtro === f ? "default" : "outline"}
                onClick={() => setFiltro(f)}
              >
                {f === "todos" ? "Todos" : f === "aceitos" ? "Aceitos" : "Pendentes"}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : isError ? (
          <div className="py-8 text-center rounded-lg border border-destructive/40 bg-destructive/5">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <p className="font-semibold text-destructive mb-1">Erro ao carregar lista</p>
            <p className="text-[11px] text-muted-foreground mb-3 px-4 break-words">
              {(error as Error)?.message}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-3 h-3 mr-1" /> Tentar novamente
            </Button>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Nenhum e-mail na lista.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtrados.map((a) => (
              <div key={a.email} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{a.email}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                {a.convite_aceito ? (
                  <Badge className="bg-primary/15 text-primary border-primary/30">Aceito</Badge>
                ) : (
                  <Badge variant="outline">Pendente</Badge>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm(`Remover ${a.email} da allowlist?`)) remover.mutate(a.email);
                  }}
                  disabled={remover.isPending}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className="bg-card border-border rounded-xl p-4 shadow-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent ? "text-gold" : ""}`}>{value}</p>
    </Card>
  );
}