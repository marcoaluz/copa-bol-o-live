import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_main/chaveamento")({
  head: () => ({ meta: [{ title: "Chaveamento — Copa Bolão 2026" }] }),
  component: BracketPage,
});

function MatchSlot({ a = "—", b = "—", sa = "-", sb = "-" }) {
  return (
    <Card className="bg-card border-border p-3 rounded-lg shadow-card w-44">
      <div className="flex items-center justify-between text-sm py-1">
        <span>{a}</span><span className="font-display text-lg tabular-nums text-gold">{sa}</span>
      </div>
      <div className="border-t border-border" />
      <div className="flex items-center justify-between text-sm py-1">
        <span>{b}</span><span className="font-display text-lg tabular-nums text-gold">{sb}</span>
      </div>
    </Card>
  );
}

function BracketPage() {
  const rounds = [
    { title: "Oitavas", count: 4 },
    { title: "Quartas", count: 2 },
    { title: "Semis", count: 1 },
    { title: "Final", count: 1 },
  ];
  return (
    <div>
      <PageHeader title="Chaveamento" subtitle="Mata-mata da Copa 2026" />
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max">
          {rounds.map((r) => (
            <div key={r.title} className="flex flex-col gap-4 justify-around">
              <h3 className="font-display text-lg text-muted-foreground tracking-wider">{r.title}</h3>
              {Array.from({ length: r.count }).map((_, i) => <MatchSlot key={i} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}