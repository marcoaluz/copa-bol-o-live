import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Trophy } from "lucide-react";
import { TeamLabel } from "@/components/TeamLabel";
import { MatchDetailDialog } from "@/components/MatchDetailDialog";
import { useSelecoes, usePartidas, selecaoMap, FASE_LABEL, type Partida } from "@/lib/tournament";

export const Route = createFileRoute("/_main/home")({
  head: () => ({ meta: [{ title: "Home — Copa Bolão 2026" }] }),
  component: HomePage,
});

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function countdown(target: string, now: Date): string {
  const diff = new Date(target).getTime() - now.getTime();
  if (diff <= 0) return "Começou";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `em ${d}d ${h}h`;
  if (h > 0) return `em ${h}h ${m}min`;
  return `em ${m}min`;
}

function fmtHora(d: string) {
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function HomePage() {
  const { data: selecoes } = useSelecoes();
  const { data: partidas, isLoading } = usePartidas();
  const sMap = useMemo(() => selecaoMap(selecoes), [selecoes]);
  const now = useNow();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Partida | null>(null);

  const buckets = useMemo(() => {
    const today = startOfDay(now);
    const tomorrow = new Date(today.getTime() + 86400000);
    const dayAfter = new Date(today.getTime() + 2 * 86400000);
    const weekEnd = new Date(today.getTime() + 7 * 86400000);

    const hoje: Partida[] = [];
    const amanha: Partida[] = [];
    const semana: Partida[] = [];
    const proximas: Partida[] = [];

    partidas?.forEach((p) => {
      const dt = new Date(p.data_hora);
      if (dt >= today && dt < tomorrow) hoje.push(p);
      else if (dt >= tomorrow && dt < dayAfter) amanha.push(p);
      else if (dt >= dayAfter && dt < weekEnd) semana.push(p);
      else if (dt >= weekEnd) proximas.push(p);
    });
    return { hoje, amanha, semana, proximas: proximas.slice(0, 6) };
  }, [partidas, now]);

  const openDetail = (p: Partida) => {
    setSelected(p);
    setOpen(true);
  };

  return (
    <div>
      <PageHeader title="Partidas" subtitle="Confira os jogos do dia e faça suas apostas" />

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando partidas…</div>
      ) : (
        <div className="space-y-8">
          <Section title="Hoje" partidas={buckets.hoje} sMap={sMap} now={now} onOpen={openDetail} emptyText="Sem jogos hoje." />
          <Section title="Amanhã" partidas={buckets.amanha} sMap={sMap} now={now} onOpen={openDetail} emptyText="Sem jogos amanhã." />
          <Section title="Esta semana" partidas={buckets.semana} sMap={sMap} now={now} onOpen={openDetail} emptyText="Nada nos próximos 7 dias." />
          {buckets.hoje.length === 0 && buckets.amanha.length === 0 && buckets.semana.length === 0 && (
            <Section title="Próximos jogos" partidas={buckets.proximas} sMap={sMap} now={now} onOpen={openDetail} />
          )}
        </div>
      )}

      <MatchDetailDialog partida={selected} sMap={sMap} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function Section({
  title,
  partidas,
  sMap,
  now,
  onOpen,
  emptyText,
}: {
  title: string;
  partidas: Partida[];
  sMap: Record<string, ReturnType<typeof selecaoMap> extends Record<string, infer T> ? T : never>;
  now: Date;
  onOpen: (p: Partida) => void;
  emptyText?: string;
}) {
  if (partidas.length === 0 && !emptyText) return null;
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-gold" />
        <h2 className="font-display text-2xl tracking-wider">{title}</h2>
        <span className="text-xs text-muted-foreground">{partidas.length} jogo(s)</span>
      </div>
      {partidas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {partidas.map((p) => (
            <MatchCard key={p.id} partida={p} sMap={sMap} now={now} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({
  partida,
  sMap,
  now,
  onOpen,
}: {
  partida: Partida;
  sMap: Record<string, any>;
  now: Date;
  onOpen: (p: Partida) => void;
}) {
  const casa = partida.selecao_casa_id ? sMap[partida.selecao_casa_id] : null;
  const visitante = partida.selecao_visitante_id ? sMap[partida.selecao_visitante_id] : null;
  const encerrada = partida.status === "encerrada";
  const aoVivo = partida.status === "ao_vivo";
  return (
    <Card
      className="bg-card border-border p-4 rounded-xl shadow-card hover:border-primary/50 transition-colors cursor-pointer"
      onClick={() => onOpen(partida)}
    >
      <div className="flex items-center justify-between mb-3">
        <Badge variant="secondary" className="bg-surface-elevated text-muted-foreground text-[10px]">
          {partida.grupo ? `Grupo ${partida.grupo}` : FASE_LABEL[partida.fase]}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {fmtHora(partida.data_hora)}
          {!encerrada && !aoVivo && <span className="text-gold ml-1">· {countdown(partida.data_hora, now)}</span>}
          {aoVivo && <span className="text-destructive ml-1 font-bold">· AO VIVO</span>}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamLabel selecao={casa} placeholder={partida.placeholder_casa} />
        <span className="font-display text-2xl text-gold tabular-nums px-2">
          {encerrada ? `${partida.gols_casa} - ${partida.gols_visitante}` : "vs"}
        </span>
        <TeamLabel selecao={visitante} placeholder={partida.placeholder_visitante} align="right" />
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={encerrada}
        className="w-full mt-3 border-primary/30 hover:bg-primary/10"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(partida);
        }}
      >
        {encerrada ? "Encerrada" : "Apostar"}
      </Button>
    </Card>
  );
}