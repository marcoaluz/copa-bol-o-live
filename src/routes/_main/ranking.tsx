import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal } from "lucide-react";

export const Route = createFileRoute("/_main/ranking")({
  head: () => ({ meta: [{ title: "Ranking — Copa Bolão 2026" }] }),
  component: RankingPage,
});

const players = Array.from({ length: 8 }).map((_, i) => ({
  pos: i + 1,
  name: `Jogador ${i + 1}`,
  pts: 100 - i * 7,
}));

function RankingPage() {
  return (
    <div>
      <PageHeader title="Ranking" subtitle="Top apostadores do bolão" />
      <Card className="bg-card border-border rounded-xl shadow-card overflow-hidden">
        {players.map((p) => (
          <div key={p.pos} className="flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-surface-elevated/50 transition-colors">
            <div className="w-8 text-center">
              {p.pos === 1 && <Trophy className="w-5 h-5 text-gold mx-auto" />}
              {p.pos === 2 && <Medal className="w-5 h-5 text-muted-foreground mx-auto" />}
              {p.pos === 3 && <Medal className="w-5 h-5 text-orange-400 mx-auto" />}
              {p.pos > 3 && <span className="font-display text-lg text-muted-foreground">{p.pos}</span>}
            </div>
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-surface-elevated text-xs">{p.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
            </Avatar>
            <span className="flex-1 font-medium">{p.name}</span>
            <span className="font-display text-2xl tabular-nums text-gold">{p.pts}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}