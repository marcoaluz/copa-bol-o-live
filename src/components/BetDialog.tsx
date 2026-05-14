import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TeamLabel } from "@/components/TeamLabel";
import { CountdownPartida, useApostasEncerradas } from "@/components/CountdownPartida";
import { FASE_LABEL, type Partida, type Selecao } from "@/lib/tournament";
import { useAuth } from "@/hooks/use-auth";
import {
  MIN_APOSTA,
  MAX_APOSTA,
  formatBRL,
  useApostaDaPartida,
  useCriarOuAlterarAposta,
  useCancelarAposta,
  PALPITE_LABEL,
  type Aposta,
} from "@/lib/bets";
import {
  useApostaPlacarDaPartida,
  useCriarOuAlterarApostaPlacar,
  useCancelarApostaPlacar,
} from "@/lib/score-bets";
import { toast } from "sonner";

type Palpite = "casa" | "empate" | "visitante";

export function BetDialog({
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
  const { user, profile, refreshProfile } = useAuth();
  const { data: apostaAtual } = useApostaDaPartida(user?.id, partida?.id);
  const { data: placarAtual } = useApostaPlacarDaPartida(user?.id, partida?.id);
  const mutation = useCriarOuAlterarAposta();
  const mCancelar = useCancelarAposta();
  const mPlacar = useCriarOuAlterarApostaPlacar();
  const mCancelarPlacar = useCancelarApostaPlacar();
  const encerrada = useApostasEncerradas(partida?.data_hora);

  const isMataMata = partida && partida.fase !== "grupos";
  const palpitesDisponiveis: Palpite[] = isMataMata ? ["casa", "visitante"] : ["casa", "empate", "visitante"];

  const [palpite, setPalpite] = useState<Palpite | null>(null);
  const [valor, setValor] = useState<number>(MIN_APOSTA);
  const [golsCasa, setGolsCasa] = useState<string>("");
  const [golsVisit, setGolsVisit] = useState<string>("");
  const [valorPlacar, setValorPlacar] = useState<number>(MIN_APOSTA);

  useEffect(() => {
    if (open && partida) {
      setPalpite((apostaAtual?.palpite as Palpite | undefined) ?? null);
      setValor(apostaAtual?.valor_centavos ?? MIN_APOSTA);
      setGolsCasa(placarAtual ? String(placarAtual.gols_casa_palpite) : "");
      setGolsVisit(placarAtual ? String(placarAtual.gols_visitante_palpite) : "");
      setValorPlacar(placarAtual?.valor_centavos ?? MIN_APOSTA);
    }
  }, [open, partida, apostaAtual, placarAtual]);

  if (!partida) return null;
  const casa = partida.selecao_casa_id ? sMap[partida.selecao_casa_id] : undefined;
  const visitante = partida.selecao_visitante_id ? sMap[partida.selecao_visitante_id] : undefined;
  const podeApostar = !!casa && !!visitante && partida.status === "agendada" && !encerrada;

  const saldoAtual = profile?.saldo_centavos ?? 0;
  const valorAnterior = apostaAtual?.valor_centavos ?? 0;
  const saldoApos = saldoAtual + valorAnterior - valor;
  const saldoInsuficiente = saldoApos < 0;

  const valorPlacarAnterior = placarAtual?.valor_centavos ?? 0;
  const saldoAposPlacar = saldoAtual + valorPlacarAnterior - valorPlacar;
  const saldoPlacarInsuficiente = saldoAposPlacar < 0;
  const placarValido =
    golsCasa !== "" && golsVisit !== "" &&
    Number.isInteger(Number(golsCasa)) && Number.isInteger(Number(golsVisit)) &&
    Number(golsCasa) >= 0 && Number(golsVisit) >= 0 &&
    Number(golsCasa) <= 20 && Number(golsVisit) <= 20;

  const submit = async () => {
    if (!palpite) { toast.error("Escolha um palpite"); return; }
    try {
      await mutation.mutateAsync({ partida_id: partida.id, palpite, valor_centavos: valor });
      await refreshProfile();
      toast.success(apostaAtual ? "Aposta alterada com sucesso" : "Aposta confirmada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar aposta");
    }
  };

  const cancelarVencedor = async () => {
    if (!apostaAtual) return;
    try {
      await mCancelar.mutateAsync(apostaAtual.id);
      await refreshProfile();
      setPalpite(null);
      setValor(MIN_APOSTA);
      toast.success("Aposta cancelada e valor devolvido");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar");
    }
  };

  const submitPlacar = async () => {
    if (!placarValido) { toast.error("Informe um placar válido (0-20)"); return; }
    try {
      await mPlacar.mutateAsync({
        partida_id: partida.id,
        gols_casa: Number(golsCasa),
        gols_visitante: Number(golsVisit),
        valor_centavos: valorPlacar,
      });
      await refreshProfile();
      toast.success(placarAtual ? "Placar alterado" : "Palpite de placar confirmado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar placar");
    }
  };

  const cancelarPlacar = async () => {
    if (!placarAtual) return;
    try {
      await mCancelarPlacar.mutateAsync(placarAtual.id);
      await refreshProfile();
      setGolsCasa(""); setGolsVisit(""); setValorPlacar(MIN_APOSTA);
      toast.success("Aposta de placar cancelada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wider flex items-center gap-2">
            {FASE_LABEL[partida.fase]}
            {partida.grupo && <Badge variant="secondary">Grupo {partida.grupo}</Badge>}
          </DialogTitle>
          <DialogDescription>Vencedor e placar são apostas independentes.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
          <TeamLabel selecao={casa ?? null} placeholder={partida.placeholder_casa} />
          <span className="font-display text-xl text-muted-foreground">vs</span>
          <TeamLabel selecao={visitante ?? null} placeholder={partida.placeholder_visitante} align="right" />
        </div>

        <div className="text-xs text-center text-muted-foreground">
          <CountdownPartida dataHora={partida.data_hora} />
        </div>

        <Tabs defaultValue="vencedor" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="vencedor">
              Vencedor {apostaAtual && <span className="ml-1 text-primary">●</span>}
            </TabsTrigger>
            <TabsTrigger value="placar">
              Placar exato {placarAtual && <span className="ml-1 text-gold">●</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vencedor" className="space-y-4 mt-3">
            <div className={`grid gap-2 ${palpitesDisponiveis.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {palpitesDisponiveis.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={!podeApostar}
                  onClick={() => setPalpite(p)}
                  className={`rounded-xl border-2 p-3 text-sm font-semibold transition-all ${
                    palpite === p
                      ? "border-primary bg-primary/15 shadow-glow text-primary-foreground"
                      : "border-border bg-surface-elevated hover:border-primary/40"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {PALPITE_LABEL[p]}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Valor da aposta</label>
                <Input
                  type="number" min={MIN_APOSTA / 100} max={MAX_APOSTA / 100} step={1}
                  value={(valor / 100).toFixed(2)}
                  onChange={(e) => {
                    const cents = Math.round(parseFloat(e.target.value || "0") * 100);
                    setValor(Math.max(MIN_APOSTA, Math.min(MAX_APOSTA, isNaN(cents) ? MIN_APOSTA : cents)));
                  }}
                  className="w-28 text-right font-display text-lg"
                  disabled={!podeApostar}
                />
              </div>
              <Slider value={[valor]} min={MIN_APOSTA} max={MAX_APOSTA} step={100}
                onValueChange={(v) => setValor(v[0])} disabled={!podeApostar} />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatBRL(MIN_APOSTA)}</span>
                <span>{formatBRL(MAX_APOSTA)}</span>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Saldo atual</span>
                <span>{formatBRL(saldoAtual)}</span>
              </div>
              {apostaAtual && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Aposta atual ({PALPITE_LABEL[apostaAtual.palpite]})</span>
                  <span>{formatBRL(valorAnterior)}</span>
                </div>
              )}
              <div className={`flex justify-between font-semibold ${saldoInsuficiente ? "text-destructive" : "text-gold"}`}>
                <span>Saldo após aposta</span>
                <span>{formatBRL(saldoApos)}</span>
              </div>
            </div>

            {!podeApostar ? (
              <Button disabled className="w-full">{encerrada ? "Apostas encerradas" : "Indisponível"}</Button>
            ) : (
              <div className="grid gap-2">
                <Button onClick={submit}
                  disabled={!palpite || saldoInsuficiente || mutation.isPending}
                  className="w-full bg-gradient-primary shadow-glow font-semibold">
                  {mutation.isPending ? "Enviando…" : apostaAtual ? "Alterar palpite de vencedor" : "Confirmar palpite de vencedor"}
                </Button>
                {apostaAtual && (
                  <Button onClick={cancelarVencedor} variant="outline"
                    disabled={mCancelar.isPending} className="w-full">
                    {mCancelar.isPending ? "Cancelando…" : "Cancelar aposta de vencedor"}
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="placar" className="space-y-4 mt-3">
            <div className="rounded-lg bg-gold/10 border border-gold/30 p-3 text-xs text-gold">
              🎯 Acertar o placar exato paga muito mais. Se ninguém acertar, sua aposta é devolvida.
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="text-center">
                <div className="text-[10px] uppercase text-muted-foreground mb-1 truncate">{casa?.nome ?? "Casa"}</div>
                <Input type="number" min={0} max={20} inputMode="numeric"
                  value={golsCasa}
                  onChange={(e) => setGolsCasa(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  className="text-center text-2xl font-display h-14" placeholder="0" disabled={!podeApostar} />
              </div>
              <span className="font-display text-2xl text-muted-foreground">×</span>
              <div className="text-center">
                <div className="text-[10px] uppercase text-muted-foreground mb-1 truncate">{visitante?.nome ?? "Visitante"}</div>
                <Input type="number" min={0} max={20} inputMode="numeric"
                  value={golsVisit}
                  onChange={(e) => setGolsVisit(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  className="text-center text-2xl font-display h-14" placeholder="0" disabled={!podeApostar} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Valor desta aposta</label>
                <Input type="number" min={MIN_APOSTA / 100} max={MAX_APOSTA / 100} step={1}
                  value={(valorPlacar / 100).toFixed(2)}
                  onChange={(e) => {
                    const cents = Math.round(parseFloat(e.target.value || "0") * 100);
                    setValorPlacar(Math.max(MIN_APOSTA, Math.min(MAX_APOSTA, isNaN(cents) ? MIN_APOSTA : cents)));
                  }}
                  className="w-28 text-right font-display text-lg" disabled={!podeApostar} />
              </div>
              <Slider value={[valorPlacar]} min={MIN_APOSTA} max={MAX_APOSTA} step={100}
                onValueChange={(v) => setValorPlacar(v[0])} disabled={!podeApostar} />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{formatBRL(MIN_APOSTA)}</span>
                <span>{formatBRL(MAX_APOSTA)}</span>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Saldo atual</span>
                <span>{formatBRL(saldoAtual)}</span>
              </div>
              {placarAtual && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Placar atual ({placarAtual.gols_casa_palpite}×{placarAtual.gols_visitante_palpite})</span>
                  <span>{formatBRL(valorPlacarAnterior)}</span>
                </div>
              )}
              <div className={`flex justify-between font-semibold ${saldoPlacarInsuficiente ? "text-destructive" : "text-gold"}`}>
                <span>Saldo após aposta</span>
                <span>{formatBRL(saldoAposPlacar)}</span>
              </div>
            </div>

            {!podeApostar ? (
              <Button disabled className="w-full">{encerrada ? "Apostas encerradas" : "Indisponível"}</Button>
            ) : (
              <div className="grid gap-2">
                <Button onClick={submitPlacar}
                  disabled={!placarValido || saldoPlacarInsuficiente || mPlacar.isPending}
                  className="w-full bg-gradient-to-r from-gold to-amber-500 text-background font-semibold hover:opacity-90">
                  {mPlacar.isPending ? "Enviando…" : placarAtual ? "Alterar palpite de placar" : "Confirmar palpite de placar"}
                </Button>
                {placarAtual && (
                  <Button onClick={cancelarPlacar} variant="outline"
                    disabled={mCancelarPlacar.isPending} className="w-full">
                    {mCancelarPlacar.isPending ? "Cancelando…" : "Cancelar aposta de placar"}
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export type { Aposta };
