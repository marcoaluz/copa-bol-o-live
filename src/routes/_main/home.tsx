import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/_main/home")({
  head: () => ({ meta: [{ title: "Home — Copa Bolão 2026" }] }),
  component: HomePage,
});

const matches = [
  { home: "Brasil", away: "Argentina", time: "16:00", status: "Hoje", group: "Grupo A" },
  { home: "França", away: "Alemanha", time: "19:00", status: "Hoje", group: "Grupo B" },
  { home: "Inglaterra", away: "Espanha", time: "13:00", status: "Amanhã", group: "Grupo C" },
];

function HomePage() {
  return (
    <div>
      <PageHeader title="Partidas" subtitle="Confira os jogos do dia e faça suas apostas" />
      <div className="grid gap-3 sm:grid-cols-2">
        {matches.map((m, i) => (
          <Card key={i} className="bg-card border-border p-4 rounded-xl shadow-card hover:border-primary/50 transition-colors">
            <div className="flex items-center justify-between mb-3">
              <Badge variant="secondary" className="bg-surface-elevated text-muted-foreground">{m.group}</Badge>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" /> {m.status} · {m.time}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-xl">⚽</div>
                <span className="font-semibold text-sm">{m.home}</span>
              </div>
              <span className="font-display text-3xl text-muted-foreground tabular-nums">VS</span>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-xl">⚽</div>
                <span className="font-semibold text-sm">{m.away}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}