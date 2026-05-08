import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamLabel } from "@/components/TeamLabel";
import { Calendar, MapPin } from "lucide-react";
import { FASE_LABEL, type Partida, type Selecao } from "@/lib/tournament";
import { BetDialog } from "@/components/BetDialog";
import { CountdownPartida, useApostasEncerradas } from "@/components/CountdownPartida";
import { useState } from "react";

function fmtDate(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MatchDetailDialog({
  partida,
  sMap,
  open,
  onOpenChange,
}: {
  partida: Partida | null;
  sMap: Record<string, Selecao>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [betOpen, setBetOpen] = useState(false);
  const encerrada = partida?.status === "encerrada";
  const apostasFechadas = useApostasEncerradas(partida?.data_hora);
  if (!partida) return null;
  const casa = partida.selecao_casa_id ? sMap[partida.selecao_casa_id] : undefined;
  const visitante = partida.selecao_visitante_id ? sMap[partida.selecao_visitante_id] : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wider flex items-center gap-2">
            {FASE_LABEL[partida.fase]}
            {partida.grupo && <Badge variant="secondary">Grupo {partida.grupo}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-4">
          <div className="flex flex-col items-center gap-2 text-center">
            {casa?.bandeira_url ? (
              <img src={casa.bandeira_url} alt={casa.nome} className="w-16 h-16 rounded-md ring-1 ring-border object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-md bg-surface-elevated border border-dashed border-border" />
            )}
            <span className="text-sm font-semibold">{casa?.nome ?? partida.placeholder_casa ?? "—"}</span>
          </div>
          <div className="font-display text-4xl text-gold tabular-nums text-center">
            {encerrada ? `${partida.gols_casa} - ${partida.gols_visitante}` : "vs"}
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            {visitante?.bandeira_url ? (
              <img src={visitante.bandeira_url} alt={visitante.nome} className="w-16 h-16 rounded-md ring-1 ring-border object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-md bg-surface-elevated border border-dashed border-border" />
            )}
            <span className="text-sm font-semibold">{visitante?.nome ?? partida.placeholder_visitante ?? "—"}</span>
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gold" />
            <span className="capitalize">{fmtDate(partida.data_hora)}</span>
          </div>
          {partida.estadio && (
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gold" />
              <span>{partida.estadio}</span>
            </div>
          )}
          {!encerrada && (
            <div className="text-xs">
              <CountdownPartida dataHora={partida.data_hora} />
            </div>
          )}
        </div>

        <Button
          disabled={encerrada || apostasFechadas || !casa || !visitante}
          onClick={() => setBetOpen(true)}
          className="w-full mt-4 bg-gradient-primary shadow-glow font-semibold"
        >
          {encerrada ? "Partida encerrada" : apostasFechadas ? "Apostas encerradas" : "Apostar nesta partida"}
        </Button>
        <BetDialog partida={partida} sMap={sMap} open={betOpen} onOpenChange={setBetOpen} />
      </DialogContent>
    </Dialog>
  );
}

export { TeamLabel };