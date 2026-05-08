import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_main/grupos")({
  head: () => ({ meta: [{ title: "Grupos — Copa Bolão 2026" }] }),
  component: GroupsPage,
});

const groups = ["A", "B", "C", "D"].map((g) => ({
  name: `Grupo ${g}`,
  teams: ["Seleção 1", "Seleção 2", "Seleção 3", "Seleção 4"].map((t) => ({
    name: t, p: 0, j: 0, v: 0, sg: 0,
  })),
}));

function GroupsPage() {
  return (
    <div>
      <PageHeader title="Grupos" subtitle="Classificação da fase de grupos" />
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.name} className="bg-card border-border rounded-xl shadow-card overflow-hidden">
            <div className="bg-gradient-primary px-4 py-2">
              <h3 className="font-display text-lg text-primary-foreground tracking-wider">{g.name}</h3>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="text-left p-2 pl-4">Time</th>
                  <th className="p-2">P</th><th className="p-2">J</th>
                  <th className="p-2">V</th><th className="p-2">SG</th>
                </tr>
              </thead>
              <tbody>
                {g.teams.map((t, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2 pl-4 flex items-center gap-2">
                      <span className={`w-5 text-xs text-center rounded ${i < 2 ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>{i + 1}</span>
                      {t.name}
                    </td>
                    <td className="text-center p-2 font-semibold">{t.p}</td>
                    <td className="text-center p-2 text-muted-foreground">{t.j}</td>
                    <td className="text-center p-2 text-muted-foreground">{t.v}</td>
                    <td className="text-center p-2 text-muted-foreground">{t.sg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}