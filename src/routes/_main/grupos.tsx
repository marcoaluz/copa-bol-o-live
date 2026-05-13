import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { TeamLabel } from "@/components/TeamLabel";
import { useSelecoes, useClassificacao, selecaoMap, type ClassificacaoLinha } from "@/lib/tournament";
import { useTorneioAtivo } from "@/lib/torneio";

export const Route = createFileRoute("/_main/grupos")({
  head: () => ({ meta: [{ title: "Grupos — Copa Bolão 2026" }] }),
  component: GroupsPage,
});

const GRUPOS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function GroupsPage() {
  const torneio = useTorneioAtivo();
  const navigate = useNavigate();
  useEffect(() => {
    if (torneio && torneio.tipo !== "copa") navigate({ to: "/home" });
  }, [torneio, navigate]);
  const { data: selecoes, isLoading: ls } = useSelecoes();
  const { data: classif, isLoading: lc } = useClassificacao();
  const sMap = useMemo(() => selecaoMap(selecoes), [selecoes]);

  const porGrupo = useMemo(() => {
    const m: Record<string, ClassificacaoLinha[]> = {};
    classif?.forEach((l) => {
      if (!m[l.grupo]) m[l.grupo] = [];
      m[l.grupo].push(l);
    });
    Object.values(m).forEach((arr) => arr.sort((a, b) => b.pontos - a.pontos || b.sg - a.sg || b.gp - a.gp));
    return m;
  }, [classif]);

  return (
    <div>
      <PageHeader title="Grupos" subtitle="Classificação da fase de grupos · Top 2 avançam direto" />
      {ls || lc ? (
        <div className="text-muted-foreground text-sm">Carregando…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {GRUPOS.map((g) => {
            const linhas = porGrupo[g] ?? [];
            return (
              <Card key={g} className="bg-card border-border rounded-xl shadow-card overflow-hidden">
                <div className="bg-gradient-primary px-4 py-2 flex items-center">
                  <h3 className="font-display text-lg text-primary-foreground tracking-wider">Grupo {g}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="text-left p-2 pl-3 font-medium">#</th>
                        <th className="text-left p-2 font-medium">Seleção</th>
                        <th className="p-2 font-medium">J</th>
                        <th className="p-2 font-medium">V</th>
                        <th className="p-2 font-medium">E</th>
                        <th className="p-2 font-medium">D</th>
                        <th className="p-2 font-medium">GP</th>
                        <th className="p-2 font-medium">GC</th>
                        <th className="p-2 font-medium">SG</th>
                        <th className="p-2 pr-3 font-bold text-foreground">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l, i) => {
                        const sel = sMap[l.selecao_id];
                        const classificado = i < 2;
                        return (
                          <tr
                            key={l.selecao_id}
                            className={`border-t border-border ${classificado ? "bg-primary/10" : ""}`}
                          >
                            <td className="p-2 pl-3">
                              <span
                                className={`inline-flex w-5 h-5 items-center justify-center text-[11px] font-bold rounded ${
                                  classificado
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-surface-elevated text-muted-foreground"
                                }`}
                              >
                                {i + 1}
                              </span>
                            </td>
                            <td className="p-2">
                              <TeamLabel selecao={sel} size="sm" />
                            </td>
                            <td className="text-center p-2 text-muted-foreground tabular-nums">{l.jogos}</td>
                            <td className="text-center p-2 text-muted-foreground tabular-nums">{l.vitorias}</td>
                            <td className="text-center p-2 text-muted-foreground tabular-nums">{l.empates}</td>
                            <td className="text-center p-2 text-muted-foreground tabular-nums">{l.derrotas}</td>
                            <td className="text-center p-2 text-muted-foreground tabular-nums">{l.gp}</td>
                            <td className="text-center p-2 text-muted-foreground tabular-nums">{l.gc}</td>
                            <td
                              className={`text-center p-2 tabular-nums ${l.sg > 0 ? "text-primary-glow" : l.sg < 0 ? "text-destructive" : "text-muted-foreground"}`}
                            >
                              {l.sg > 0 ? `+${l.sg}` : l.sg}
                            </td>
                            <td className="text-center p-2 pr-3 font-bold text-foreground tabular-nums">{l.pontos}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
