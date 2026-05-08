import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ListSkeleton } from "@/components/Skeletons";
import { EmptyState } from "@/components/EmptyState";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";

export const Route = createFileRoute("/_main/admin/checklist")({
  head: () => ({ meta: [{ title: "Checklist de pré-lançamento — Admin" }] }),
  component: ChecklistPage,
});

type Item = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  concluido: boolean;
  observacao: string | null;
  concluido_em: string | null;
};

function ChecklistPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "checklist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_lancamento")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (item: Item) => {
      const concluido = !item.concluido;
      const { error } = await supabase
        .from("checklist_lancamento")
        .update({
          concluido,
          concluido_por: concluido ? profile?.id ?? null : null,
          concluido_em: concluido ? new Date().toISOString() : null,
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "checklist"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Item[]>();
    (data ?? []).forEach((it) => {
      if (!m.has(it.categoria)) m.set(it.categoria, []);
      m.get(it.categoria)!.push(it);
    });
    return Array.from(m.entries());
  }, [data]);

  const total = data?.length ?? 0;
  const done = (data ?? []).filter((i) => i.concluido).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (!profile?.is_admin) {
    return <div className="p-8 text-center text-muted-foreground">Acesso restrito.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Checklist de pré-lançamento" subtitle="Itens obrigatórios antes de abrir ao público" />

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-muted-foreground">Progresso geral</p>
            <p className="text-2xl font-bold tabular-nums">{done} / {total}</p>
          </div>
          <Badge variant={pct === 100 ? "default" : "secondary"} className="text-base px-3 py-1">{pct}%</Badge>
        </div>
        <Progress value={pct} aria-label={`${pct}% concluído`} />
      </Card>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : grouped.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Sem itens" description="O checklist ainda não foi populado." />
      ) : (
        <div className="space-y-5">
          {grouped.map(([cat, items]) => {
            const catDone = items.filter((i) => i.concluido).length;
            return (
              <Card key={cat} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-lg">{cat}</h2>
                  <Badge variant="outline">{catDone} / {items.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-surface/30">
                      <Checkbox
                        id={`c-${it.id}`}
                        checked={it.concluido}
                        onCheckedChange={() => toggle.mutate(it)}
                        aria-label={it.titulo}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <label htmlFor={`c-${it.id}`} className={`text-sm font-medium cursor-pointer ${it.concluido ? "line-through text-muted-foreground" : ""}`}>
                          {it.titulo}
                        </label>
                        {it.descricao && (
                          <p className="text-xs text-muted-foreground mt-0.5">{it.descricao}</p>
                        )}
                        {it.concluido_em && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            ✓ {new Date(it.concluido_em).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
