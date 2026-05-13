import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { TeamLabel } from "@/components/TeamLabel";
import { MatchDetailDialog } from "@/components/MatchDetailDialog";
import { useSelecoes, usePartidas, selecaoMap, type Partida } from "@/lib/tournament";
import { useTorneioAtivo } from "@/lib/torneio";

export const Route = createFileRoute("/_main/chaveamento")({
  head: () => ({ meta: [{ title: "Chaveamento — Copa Bolão 2026" }] }),
  component: BracketPage,
});

function fmtData(d: string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function MatchSlot({
  partida,
  sMap,
  onClick,
}: {
  partida: Partida;
  sMap: Record<string, any>;
  onClick: (p: Partida) => void;
}) {
  const casa = partida.selecao_casa_id ? sMap[partida.selecao_casa_id] : null;
  const visitante = partida.selecao_visitante_id ? sMap[partida.selecao_visitante_id] : null;
  const encerrada = partida.status === "encerrada";
  return (
    <Card
      className="bg-card border-border p-3 rounded-lg shadow-card w-56 cursor-pointer hover:border-primary/60 transition-colors"
      onClick={() => onClick(partida)}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
        <span>{partida.codigo}</span>
        <span>{fmtData(partida.data_hora)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 py-1">
        <TeamLabel selecao={casa} placeholder={partida.placeholder_casa} size="sm" />
        <span className="font-display text-base tabular-nums text-gold w-5 text-right">
          {encerrada ? partida.gols_casa : "-"}
        </span>
      </div>
      <div className="border-t border-border my-1" />
      <div className="flex items-center justify-between gap-2 py-1">
        <TeamLabel selecao={visitante} placeholder={partida.placeholder_visitante} size="sm" />
        <span className="font-display text-base tabular-nums text-gold w-5 text-right">
          {encerrada ? partida.gols_visitante : "-"}
        </span>
      </div>
    </Card>
  );
}

function BracketPage() {
  const { data: selecoes } = useSelecoes();
  const { data: partidas, isLoading } = usePartidas();
  const sMap = useMemo(() => selecaoMap(selecoes), [selecoes]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Partida | null>(null);

  const ofs = (partidas ?? []).filter((p) => p.fase === "oitavas").sort((a, b) => (a.ordem_bracket ?? 0) - (b.ordem_bracket ?? 0));
  const qfs = (partidas ?? []).filter((p) => p.fase === "quartas").sort((a, b) => (a.ordem_bracket ?? 0) - (b.ordem_bracket ?? 0));
  const sfs = (partidas ?? []).filter((p) => p.fase === "semi").sort((a, b) => (a.ordem_bracket ?? 0) - (b.ordem_bracket ?? 0));
  const fin = (partidas ?? []).find((p) => p.fase === "final");
  const ter = (partidas ?? []).find((p) => p.fase === "terceiro");

  const onClick = (p: Partida) => {
    setSelected(p);
    setOpen(true);
  };

  const Coluna = ({ titulo, partidas }: { titulo: string; partidas: Partida[] }) => (
    <div className="flex flex-col gap-3 justify-around">
      <h3 className="font-display text-lg text-muted-foreground tracking-wider sticky top-0">{titulo}</h3>
      {partidas.map((p) => (
        <div key={p.id} className="relative">
          <MatchSlot partida={p} sMap={sMap} onClick={onClick} />
          {p.bracket_proximo_id && (
            <div className="hidden md:block absolute top-1/2 -right-3 w-3 h-px bg-border" aria-hidden />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader title="Chaveamento" subtitle="Mata-mata da Copa 2026 · clique numa partida para detalhes" />
      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando bracket…</div>
      ) : (
        <>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-8 min-w-max">
              <Coluna titulo="Oitavas" partidas={ofs} />
              <Coluna titulo="Quartas" partidas={qfs} />
              <Coluna titulo="Semis" partidas={sfs} />
              <div className="flex flex-col gap-3 justify-around">
                <h3 className="font-display text-lg text-gold tracking-wider">Final</h3>
                {fin && <MatchSlot partida={fin} sMap={sMap} onClick={onClick} />}
              </div>
            </div>
          </div>

          {ter && (
            <div className="mt-8">
              <h3 className="font-display text-lg text-muted-foreground tracking-wider mb-3">Disputa de 3º lugar</h3>
              <MatchSlot partida={ter} sMap={sMap} onClick={onClick} />
            </div>
          )}
        </>
      )}

      <MatchDetailDialog partida={selected} sMap={sMap} open={open} onOpenChange={setOpen} />
    </div>
  );
}