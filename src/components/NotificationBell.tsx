import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type Notif = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["notificacoes", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Notif[]> => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Notif[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes", filter: `usuario_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notificacoes", user.id] });
        qc.invalidateQueries({ queryKey: ["apostas"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  const marcarLidas = useMutation({
    mutationFn: async (ids?: string[]) => {
      const { error } = await supabase.rpc("marcar_notificacoes_lidas", ids ? { p_ids: ids } : {});
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", user?.id] }),
  });

  const naoLidas = (data ?? []).filter((n) => !n.lida).length;
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-surface-elevated transition-colors" aria-label="Notificações">
          <Bell className="w-5 h-5" />
          {naoLidas > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 bg-card border-border p-0 max-h-[70vh] overflow-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="font-semibold text-sm">Notificações</span>
          {naoLidas > 0 && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => marcarLidas.mutate(undefined)}>
              Marcar todas lidas
            </Button>
          )}
        </div>
        {(data ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Sem notificações.</div>
        ) : (
          <ul className="divide-y divide-border">
            {(data ?? []).map((n) => (
              <li key={n.id}>
                <button
                  className={`w-full text-left p-3 hover:bg-surface-elevated transition-colors ${!n.lida ? "bg-primary/5" : ""}`}
                  onClick={() => {
                    if (!n.lida) marcarLidas.mutate([n.id]);
                    if (n.link) navigate({ to: n.link });
                  }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-sm font-semibold">{n.titulo}</span>
                    {!n.lida && <span className="w-2 h-2 rounded-full bg-primary mt-1.5" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}