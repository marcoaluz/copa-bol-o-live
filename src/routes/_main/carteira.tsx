import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Gift, CalendarDays, Coins, AlertCircle, ArrowDownCircle, ArrowUpCircle, Trophy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/carteira")({
  component: CarteiraPage,
});

function formatBRL(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const ms = target.getTime() - now;
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function BonusCard({
  title, valor, icon: Icon, descricao, tipo, ultimo, intervaloMs, onClaimed,
}: {
  title: string; valor: number; icon: typeof Gift; descricao: string;
  tipo: "diario" | "semanal"; ultimo: Date | null; intervaloMs: number; onClaimed: () => void;
}) {
  const proximo = ultimo ? new Date(ultimo.getTime() + intervaloMs) : null;
  const disponivel = !proximo || proximo.getTime() <= Date.now();
  const countdown = useCountdown(disponivel ? null : proximo);

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("resgatar_bonus", { p_tipo: tipo });
      if (error) throw error;
      return data as { ok: boolean; valor?: number; novo_saldo?: number; proximo_em?: string };
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`+R$ ${formatBRL(res.valor ?? 0)} creditados na sua carteira!`);
        onClaimed();
      } else {
        toast.error("Bônus ainda não disponível");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-6 bg-gradient-to-br from-surface to-surface-elevated border-border">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gold/15 flex items-center justify-center">
          <Icon className="w-6 h-6 text-gold" />
        </div>
        <Badge variant={disponivel ? "default" : "secondary"} className={disponivel ? "bg-gold text-background" : ""}>
          {disponivel ? "Disponível" : "Aguarde"}
        </Badge>
      </div>
      <h3 className="font-display text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{descricao}</p>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-3xl font-bold text-gold tabular-nums">R$ {formatBRL(valor)}</span>
      </div>
      <Button
        className="w-full"
        disabled={!disponivel || mut.isPending}
        onClick={() => mut.mutate()}
      >
        {disponivel ? (mut.isPending ? "Resgatando..." : "Resgatar agora") : `Próximo em ${countdown ?? "--:--:--"}`}
      </Button>
    </Card>
  );
}

function CarteiraPage() {
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const { data: transacoes, refetch } = useQuery({
    queryKey: ["transacoes", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const ultimoDiario = transacoes?.find(
    (t) => t.tipo === "bonus" && t.descricao === "Bônus diário",
  );
  const ultimoSemanal = transacoes?.find(
    (t) => t.tipo === "bonus" && t.descricao === "Bônus semanal",
  );

  const onClaimed = async () => {
    await Promise.all([refreshProfile(), refetch()]);
    qc.invalidateQueries({ queryKey: ["transacoes"] });
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Wallet className="w-7 h-7 text-gold" />
          <h1 className="font-display text-3xl">Carteira</h1>
        </div>
        <p className="text-muted-foreground">
          Suas moedas virtuais para apostar no bolão. Sem dinheiro real envolvido.
        </p>
      </header>

      <Card className="p-8 bg-gradient-primary border-0 shadow-glow">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-primary-foreground/80 text-sm uppercase tracking-wider mb-2">Saldo atual</p>
            <p className="text-5xl font-bold text-primary-foreground tabular-nums">
              R$ {formatBRL(profile?.saldo_centavos ?? 0)}
            </p>
          </div>
          <Coins className="w-20 h-20 text-primary-foreground/20" />
        </div>
      </Card>

      <div className="rounded-xl border border-border/50 bg-surface/40 p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <strong className="text-foreground">Bolão entre amigos.</strong> As moedas desta carteira são virtuais —
          não podem ser compradas, sacadas ou trocadas por dinheiro real. Use os bônus para participar das apostas
          e disputar o ranking. Reposição diária e semanal garante que ninguém fique de fora.
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl">Resgatar bônus</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <BonusCard
            title="Bônus diário"
            descricao="Resgate 1x a cada 24 horas"
            valor={5000}
            icon={Gift}
            tipo="diario"
            ultimo={ultimoDiario ? new Date(ultimoDiario.created_at) : null}
            intervaloMs={24 * 60 * 60 * 1000}
            onClaimed={onClaimed}
          />
          <BonusCard
            title="Bônus semanal"
            descricao="Resgate 1x a cada 7 dias"
            valor={20000}
            icon={CalendarDays}
            tipo="semanal"
            ultimo={ultimoSemanal ? new Date(ultimoSemanal.created_at) : null}
            intervaloMs={7 * 24 * 60 * 60 * 1000}
            onClaimed={onClaimed}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Histórico de transações</h2>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
          </Button>
        </div>
        <Card className="divide-y divide-border">
          {!transacoes?.length && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhuma transação ainda. Resgate seu primeiro bônus!
            </div>
          )}
          {transacoes?.map((t) => {
            const positiva = t.valor_centavos >= 0;
            const Icon = t.tipo === "bonus" ? Gift
              : t.tipo === "premio" ? Trophy
              : positiva ? ArrowDownCircle : ArrowUpCircle;
            const cor = positiva ? "text-green-500" : "text-destructive";
            return (
              <div key={t.id} className="flex items-center gap-4 p-4">
                <div className={`w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center ${cor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{t.descricao || t.tipo}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold tabular-nums ${cor}`}>
                    {positiva ? "+" : ""}R$ {formatBRL(t.valor_centavos)}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    saldo R$ {formatBRL(t.saldo_apos_centavos)}
                  </p>
                </div>
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}
