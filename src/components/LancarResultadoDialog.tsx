import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLancarResultado, useApurarPartida, useApostasDaPartida, useCancelarPartida } from "@/lib/admin";
import { formatBRL, PALPITE_LABEL } from "@/lib/bets";
import type { Partida, Selecao } from "@/lib/tournament";
import { toast } from "sonner";

export function LancarResultadoDialog({
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
  const lancar = useLancarResultado();
  const apurar = useApurarPartida();
  const cancelar = useCancelarPartida();
  const { data: apostas } = useApostasDaPartida(open ? partida?.id ?? null : null);

  const [gc, setGc] = useState(0);
  const [gv, setGv] = useState(0);
  const [resumo, setResumo] = useState<any>(null);

  useEffect(() => {
    if (open && partida) {
      setGc(partida.gols_casa ?? 0);
      setGv(partida.gols_visitante ?? 0);
      setResumo(null);
    }
  }, [open, partida]);

  if (!partida) return null;
  const casa = partida.selecao_casa_id ? sMap[partida.selecao_casa_id] : undefined;
  const visit = partida.selecao_visitante_id ? sMap[partida.selecao_visitante_id] : undefined;

  // modo teste: liberar edição mesmo em partidas encerradas
  const podeLancar = partida.status !== "cancelada";
  const podeApurar = partida.status === "encerrada" && partida.resultado != null;
  const podeCancelar = partida.status !== "cancelada";

  const onLancar = async () => {
    try {
      await lancar.mutateAsync({ partida_id: partida.id, gols_casa: gc, gols_visitante: gv });
      toast.success("Resultado lançado");
    } catch (e: any) { toast.error(e.message); }
  };

  const onApurar = async () => {
    try {
      const r = await apurar.mutateAsync(partida.id);
      setResumo(r);
      toast.success("Apuração concluída");
    } catch (e: any) { toast.error(e.message); }
  };

  const onCancelar = async () => {
    if (!confirm("Cancelar a partida e devolver TODAS as apostas?")) return;
    try {
      await cancelar.mutateAsync(partida.id);
      toast.success("Partida cancelada e apostas devolvidas");
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const totalApostado = (apostas ?? []).reduce((s: number, a: any) => s + a.valor_centavos, 0);
  const ganhadores = (apostas ?? []).filter((a: any) => a.status === "ganhou");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-wider">
            {casa?.nome ?? "—"} vs {visit?.nome ?? "—"}
          </DialogTitle>
          <DialogDescription>
            <Badge variant="secondary" className="mr-2">{partida.status}</Badge>
            {(apostas?.length ?? 0)} apostas · {formatBRL(totalApostado)}
            {partida.bracket_proximo_id && partida.fase !== "grupos" && (
              <span className="ml-2">· Mata-mata</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Lançar resultado */}
        <div className="space-y-3">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">Placar final</div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="text-center">
              <div className="text-sm font-semibold mb-2">{casa?.nome ?? "—"}</div>
              <Input type="number" min={0} value={gc} disabled={!podeLancar}
                onChange={(e) => setGc(Math.max(0, parseInt(e.target.value || "0")))}
                className="text-center font-display text-2xl" />
            </div>
            <span className="text-2xl text-muted-foreground">×</span>
            <div className="text-center">
              <div className="text-sm font-semibold mb-2">{visit?.nome ?? "—"}</div>
              <Input type="number" min={0} value={gv} disabled={!podeLancar}
                onChange={(e) => setGv(Math.max(0, parseInt(e.target.value || "0")))}
                className="text-center font-display text-2xl" />
            </div>
          </div>
          <Button onClick={onLancar} disabled={!podeLancar || lancar.isPending}
            className="w-full bg-gradient-primary font-semibold">
            {lancar.isPending ? "Lançando…" : "Lançar resultado"}
          </Button>
        </div>

        {/* Apurar */}
        {resumo ? (
          <div className="border-t border-border pt-4 space-y-2 text-sm">
            <div className="font-semibold text-gold">Resumo da apuração</div>
            <pre className="text-xs bg-surface-elevated p-3 rounded-lg overflow-auto max-h-48">{JSON.stringify(resumo, null, 2)}</pre>
            {ganhadores.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Ganhadores</div>
                <div className="space-y-1">
                  {ganhadores.map((g: any) => (
                    <div key={g.id} className="flex justify-between text-xs bg-surface rounded px-2 py-1">
                      <span>@{g.profiles?.apelido ?? "—"} · {PALPITE_LABEL[g.palpite as "casa"|"empate"|"visitante"]} · apostou {formatBRL(g.valor_centavos)}</span>
                      <span className="text-primary font-semibold">{formatBRL(g.premio_centavos ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button onClick={onApurar} disabled={!podeApurar || apurar.isPending}
            variant="outline" className="w-full border-gold/40 text-gold hover:bg-gold/10">
            {apurar.isPending ? "Apurando…" : "Apurar e distribuir prêmios"}
          </Button>
        )}

        <DialogFooter className="border-t border-border pt-4">
          <Button onClick={onCancelar} disabled={!podeCancelar || cancelar.isPending}
            variant="ghost" className="text-destructive hover:bg-destructive/10">
            Cancelar partida (devolve apostas)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}