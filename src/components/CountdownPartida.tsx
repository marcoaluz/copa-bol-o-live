import { useServerNow, TRAVA_MINUTOS } from "@/lib/bets";

function fmt(ms: number) {
  if (ms <= 0) return "00h 00min 00s";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}min`;
  return `${pad(h)}h ${pad(m)}min ${pad(s)}s`;
}

/**
 * Tempo restante até T - 60min da partida (quando as apostas fecham).
 * Usa hora do servidor (re-sincronizada) para evitar manipulação do relógio.
 */
export function CountdownPartida({
  dataHora,
  className,
}: {
  dataHora: string;
  className?: string;
}) {
  const now = useServerNow();
  const fechaEm = new Date(dataHora).getTime() - TRAVA_MINUTOS * 60_000;
  const restante = fechaEm - now.getTime();
  const fechado = restante <= 0;
  return (
    <span className={className}>
      {fechado ? (
        <span className="text-muted-foreground">Apostas encerradas</span>
      ) : (
        <>
          Apostas fecham em: <span className="font-display tabular-nums text-gold">{fmt(restante)}</span>
        </>
      )}
    </span>
  );
}

export function useApostasEncerradas(dataHora: string | undefined) {
  const now = useServerNow();
  if (!dataHora) return false;
  return new Date(dataHora).getTime() - TRAVA_MINUTOS * 60_000 - now.getTime() <= 0;
}