import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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
  PALPITE_LABEL,
  type Aposta,
} from "@/lib/bets";
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
  const mutation = useCriarOuAlterarAposta();
  const encerrada = useApostasEncerradas(partida?.data_hora);

  const isMataMata = partida && partida.fase !== "grupos";
  const palpitesDisponiveis: Palpite[] = isMataMata ? ["casa", "visitante"] : ["casa", "empate", "visitante"];

  const [palpite, setPalpite] = useState<Palpite | null>(null);
  const [valor, setValor] = useState<number>(MIN_APOSTA);

  useEffect(() => {
    if (open && partida) {
      setPalpite((apostaAtual?.palpite as Palpite | undefined) ?? null);
      setValor(apostaAtual?.valor_centavos ?? MIN_APOSTA);
    }
  }, [open, partida, apostaAtual]);

  if (!partida) return null;
  const casa = partida.selecao_casa_id ? sMap[partida.selecao_casa_id] : undefined;
  const visitante = partida.selecao_visitante_id ? sMap[partida.selecao_visitante_id] : undefined;
  const podeApostar =
    !!casa && !!visitante && partida.status === "agendada" && !encerrada;

  const saldoAtual = profile?.saldo_centavos ?? 0;
  const valorAnterior = apostaAtual?.valor_centavos ?? 0;
  const saldoApos = saldoAtual + valorAnterior - valor;
  const saldoInsuficiente = saldoApos < 0;

  const submit = async () => {
    if (!palpite) {
      toast.error("Escolha um palpite");
      return;
    }
    try {
      await mutation.mutateAsync({
        partida_id: partida.id,
        palpite,
        valor_centavos: valor,
      });
      await refreshProfile();
      toast.success(apostaAtual ? "Aposta alterada com sucesso" : "Aposta confirmada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar aposta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wider flex items-center gap-2">
            {FASE_LABEL[partida.fase]}
            {partida.grupo && <Badge variant="secondary">Grupo {partida.grupo}</Badge>}
          </DialogTitle>
          <DialogDescription>Faça seu palpite e confirme abaixo.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
          <TeamLabel selecao={casa ?? null} placeholder={partida.placeholder_casa} />
          <span className="font-display text-xl text-muted-foreground">vs</span>
          <TeamLabel selecao={visitante ?? null} placeholder={partida.placeholder_visitante} align="right" />
        </div>

        <div className="text-xs text-center text-muted-foreground">
          <CountdownPartida dataHora={partida.data_hora} />
        </div>

        {/* Palpites */}
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

        {/* Valor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground">Valor da aposta</label>
            <Input
              type="number"
              min={MIN_APOSTA / 100}
              max={MAX_APOSTA / 100}
              step={1}
              value={(valor / 100).toFixed(2)}
              onChange={(e) => {
                const cents = Math.round(parseFloat(e.target.value || "0") * 100);
                setValor(Math.max(MIN_APOSTA, Math.min(MAX_APOSTA, isNaN(cents) ? MIN_APOSTA : cents)));
              }}
              className="w-28 text-right font-display text-lg"
              disabled={!podeApostar}
            />
          </div>
          <Slider
            value={[valor]}
            min={MIN_APOSTA}
            max={MAX_APOSTA}
            step={100}
            onValueChange={(v) => setValor(v[0])}
            disabled={!podeApostar}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{formatBRL(MIN_APOSTA)}</span>
            <span>{formatBRL(MAX_APOSTA)}</span>
          </div>
        </div>

        {/* Saldo */}
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
          <Button disabled className="w-full">
            {encerrada ? "Apostas encerradas" : "Indisponível"}
          </Button>
        ) : (
          <Button
            onClick={submit}
            disabled={!palpite || saldoInsuficiente || mutation.isPending}
            className="w-full bg-gradient-primary shadow-glow font-semibold"
          >
            {mutation.isPending ? "Enviando…" : apostaAtual ? "Alterar aposta" : "Confirmar aposta"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type { Aposta };