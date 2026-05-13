import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { TeamLabel } from "@/components/TeamLabel";
import { useTorneioAtivo } from "@/lib/torneio";
import { useClassificacaoPontosCorridos, type ClassificacaoPCLinha } from "@/lib/tournament";

export const Route = createFileRoute("/_main/tabela")({
  head: () => ({ meta: [{ title: "Tabela — Copa Bolão" }] }),
  component: TabelaPage,
});

type Zona = "libertadores" | "pre_libertadores" | "sulamericana" | "rebaixamento" | "neutra";

function zonaPorPosicao(pos: number, total: number): Zona {
  if (pos <= 4) return "libertadores";
  if (pos <= 6) return "pre_libertadores";
  if (pos <= 12) return "sulamericana";
  if (pos > total - 4) return "rebaixamento";
  return "neutra";
}

const ZONA_INFO: Record<Zona, { label: string; bar: string; row: string }> = {
  libertadores: { label: "Libertadores (fase de grupos)", bar: "bg-emerald-500", row: "border-l-emerald-500" },
  pre_libertadores: { label: "Pré-Libertadores", bar: "bg-sky-500", row: "border-l-sky-500" },
  sulamericana: { label: "Sul-Americana", bar: "bg-amber-500", row: "border-l-amber-500" },
  rebaixamento: { label: "Rebaixamento", bar: "bg-destructive", row: "border-l-destructive" },
  neutra: { label: "", bar: "", row: "border-l-transparent" },
};

function TabelaPage() {
  const torneio = useTorneioAtivo();
  const navigate = useNavigate();
  useEffect(() => {
    if (torneio && torneio.tipo !== "pontos_corridos") navigate({ to: "/home" });
  }, [torneio, navigate]);

  const { data, isLoading } = useClassificacaoPontosCorridos();

  const ordenado = useMemo<ClassificacaoPCLinha[]>(
    () =>
      (data ?? []).slice().sort((a, b) => {
        if (b.pontos !== a.pontos) return b.pontos - a.pontos;
        const sgA = a.gp - a.gc;
        const sgB = b.gp - b.gc;
        if (sgB !== sgA) return sgB - sgA;
        if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
        return a.nome.localeCompare(b.nome);
      }),
    [data],
  );

  const total = ordenado.length;

  return (
    <div>
      <PageHeader title="Tabela" subtitle={`${torneio?.nome_curto ?? "Pontos corridos"} · classificação atualizada`} />

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando classificação…</div>
      ) : (
        <>
          <Card className="bg-card border-border rounded-xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-elevated/40">
                  <tr>
                    <th className="text-left p-2 pl-3 font-medium w-10">#</th>
                    <th className="text-left p-2 font-medium">Time</th>
                    <th className="p-2 font-bold text-foreground">Pts</th>
                    <th className="p-2 font-medium">J</th>
                    <th className="p-2 font-medium">V</th>
                    <th className="p-2 font-medium">E</th>
                    <th className="p-2 font-medium">D</th>
                    <th className="p-2 font-medium">GP</th>
                    <th className="p-2 font-medium">GC</th>
                    <th className="p-2 pr-3 font-medium">SG</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenado.map((l, i) => {
                    const pos = i + 1;
                    const z = zonaPorPosicao(pos, total);
                    const info = ZONA_INFO[z];
                    const sg = l.gp - l.gc;
                    const sel = {
                      id: l.id,
                      nome: l.nome,
                      codigo_iso: l.codigo_iso,
                      bandeira_url: l.bandeira_url,
                      grupo: null,
                    };
                    return (
                      <tr
                        key={l.id}
                        className={`border-t border-border border-l-4 ${info.row} hover:bg-surface-elevated/40 transition-colors`}
                      >
                        <td className="p-2 pl-3">
                          <span
                            className={`inline-flex w-6 h-6 items-center justify-center text-[11px] font-bold rounded ${info.bar ? `${info.bar} text-white` : "bg-surface-elevated text-muted-foreground"}`}
                          >
                            {pos}
                          </span>
                        </td>
                        <td className="p-2">
                          <TeamLabel selecao={sel as any} size="sm" />
                        </td>
                        <td className="text-center p-2 font-bold tabular-nums text-foreground">{l.pontos}</td>
                        <td className="text-center p-2 text-muted-foreground tabular-nums">{l.jogos}</td>
                        <td className="text-center p-2 text-muted-foreground tabular-nums">{l.vitorias}</td>
                        <td className="text-center p-2 text-muted-foreground tabular-nums">{l.empates}</td>
                        <td className="text-center p-2 text-muted-foreground tabular-nums">{l.derrotas}</td>
                        <td className="text-center p-2 text-muted-foreground tabular-nums">{l.gp}</td>
                        <td className="text-center p-2 text-muted-foreground tabular-nums">{l.gc}</td>
                        <td
                          className={`text-center p-2 pr-3 tabular-nums ${sg > 0 ? "text-primary-glow" : sg < 0 ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {sg > 0 ? `+${sg}` : sg}
                        </td>
                      </tr>
                    );
                  })}
                  {ordenado.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-sm text-muted-foreground">
                        Sem times cadastrados ainda. Sincronize o torneio em /admin/sync.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 text-xs">
            <Legend color="bg-emerald-500" label="Libertadores (1º–4º)" />
            <Legend color="bg-sky-500" label="Pré-Libertadores (5º–6º)" />
            <Legend color="bg-amber-500" label="Sul-Americana (7º–12º)" />
            <Legend color="bg-destructive" label="Rebaixamento (últimos 4)" />
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block w-3 h-3 rounded ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}