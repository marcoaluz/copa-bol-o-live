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
import { MailPlus, Trash2, Users } from "lucide-react";
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

function ConvitesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [raw, setRaw] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "aceitos" | "pendentes">("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (profile && !profile.is_admin) navigate({ to: "/home" });
  }, [profile, navigate]);

  const { data, isLoading } = useQuery({
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

  const adicionar = useMutation({
    mutationFn: async (emails: string[]) => {
      const { data, error } = await (supabase as any).rpc("adicionar_emails_autorizados", {
        p_emails: emails,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} e-mail(s) adicionado(s) à allowlist.`);
      setRaw("");
      qc.invalidateQueries({ queryKey: ["admin", "convites"] });
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

  const handleAdd = () => {
    const emails = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (emails.length === 0) {
      toast.error("Cole pelo menos um e-mail.");
      return;
    }
    adicionar.mutate(emails);
  };

  return (
    <div>
      <PageHeader title="Convites" subtitle="Allowlist do bolão privado" />

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Kpi label="Total" value={stats.total} />
        <Kpi label="Aceitos" value={stats.aceitos} />
        <Kpi label="Pendentes" value={stats.pendentes} accent />
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
        <Button
          onClick={handleAdd}
          disabled={adicionar.isPending}
          className="bg-gradient-primary shadow-glow"
        >
          {adicionar.isPending ? "Adicionando..." : "Adicionar à allowlist"}
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