import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRanking, nomeExibicao, iniciais, type RankingFiltro, type RankingLinha } from "@/lib/ranking";
import { formatBRL } from "@/lib/bets";

export const Route = createFileRoute("/_main/ranking")({
  head: () => ({ meta: [{ title: "Ranking — Copa Bolão 2026" }] }),
  component: RankingPage,
});

function RankingPage() {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState<RankingFiltro>("geral");
  const [busca, setBusca] = useState("");
  const { data: ranking, isLoading } = useRanking(filtro);

  const ordenado = useMemo(
    () => (ranking ?? []).slice().sort((a, b) => a.posicao - b.posicao),
    [ranking],
  );
  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ordenado;
    return ordenado.filter((r) =>
      nomeExibicao(r).toLowerCase().includes(q) || (r.apelido ?? "").toLowerCase().includes(q),
    );
  }, [ordenado, busca]);

  const top3 = filtrado.slice(0, 3);
  const resto = filtrado.slice(3, 100);
  const meu = ordenado.find((r) => r.usuario_id === user?.id);
  const meuForaDoTop = meu && meu.posicao > 100;

  return (
    <div>
      <PageHeader title="Ranking" subtitle="Top apostadores do bolão" />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as RankingFiltro)} className="flex-1">
          <TabsList className="bg-card border border-border w-full sm:w-auto overflow-x-auto">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="grupos">Fase de grupos</TabsTrigger>
            <TabsTrigger value="mata">Mata-mata</TabsTrigger>
            <TabsTrigger value="semana">Última semana</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar apelido…"
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando ranking…</div>
      ) : (
        <>
          <Podium top3={top3} myId={user?.id} />
          <Card className="bg-card border-border rounded-xl shadow-card overflow-hidden mt-5">
            {resto.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Sem apostadores nessa faixa.</div>
            ) : resto.map((r) => (
              <RankRow key={r.usuario_id} linha={r} eh_eu={r.usuario_id === user?.id} />
            ))}
          </Card>

          {meuForaDoTop && (
            <Card className="mt-4 bg-gradient-to-r from-primary/15 to-gold/10 border-gold/40 rounded-xl p-4 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-gold" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Sua posição</div>
                <div className="font-display text-2xl text-gold">#{meu?.posicao}</div>
              </div>
              <div className="text-right text-sm">
                <div className="text-muted-foreground text-xs">Acertos / Lucro</div>
                <div className="font-semibold">{meu?.total_acertos} · <span className={meu && meu.lucro_centavos >= 0 ? "text-primary" : "text-destructive"}>{formatBRL(meu?.lucro_centavos ?? 0)}</span></div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Podium({ top3, myId }: { top3: RankingLinha[]; myId?: string }) {
  if (top3.length === 0) return null;
  // Reorder: 2 / 1 / 3 visually
  const order = [top3[1], top3[0], top3[2]].filter(Boolean);
  const heights = ["h-32", "h-40", "h-28"];
  const colors = ["from-slate-400 to-slate-600", "from-gold to-amber-500", "from-orange-500 to-orange-700"];
  return (
    <div className="grid grid-cols-3 gap-3 items-end">
      {order.map((r, idx) => {
        const realPos = r.posicao;
        const isMe = r.usuario_id === myId;
        const nome = nomeExibicao(r);
        return (
          <Card key={r.usuario_id}
            className={`bg-card border-border rounded-xl p-4 text-center ${isMe ? "ring-2 ring-gold" : ""}`}>
            <Avatar className={`mx-auto mb-2 ${realPos === 1 ? "w-20 h-20" : "w-16 h-16"} border-4 ${realPos === 1 ? "border-gold shadow-glow" : realPos === 2 ? "border-slate-400" : "border-orange-500"}`}>
              {!r.anonimo && r.foto_url ? <AvatarImage src={r.foto_url} alt={nome} /> : null}
              <AvatarFallback className="bg-surface-elevated text-lg font-bold">{iniciais(nome)}</AvatarFallback>
            </Avatar>
            <div className="font-semibold truncate">{nome}</div>
            <div className="text-xs text-muted-foreground">{r.total_acertos} acertos · {r.taxa_acerto}%</div>
            <div className={`mt-3 mx-auto rounded-t-lg bg-gradient-to-b ${colors[idx]} ${heights[idx]} flex items-end justify-center pb-2`}>
              <span className="font-display text-3xl text-foreground drop-shadow">#{realPos}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function RankRow({ linha, eh_eu }: { linha: RankingLinha; eh_eu: boolean }) {
  const nome = nomeExibicao(linha);
  const lucroPos = linha.lucro_centavos >= 0;
  return (
    <div className={`flex items-center gap-4 p-3 border-b border-border last:border-b-0 ${eh_eu ? "bg-gold/10 ring-1 ring-gold/40" : "hover:bg-surface-elevated/50"} transition-colors`}>
      <div className="w-10 text-center">
        {linha.posicao === 1 && <Trophy className="w-4 h-4 text-gold mx-auto" />}
        {linha.posicao === 2 && <Medal className="w-4 h-4 text-slate-300 mx-auto" />}
        {linha.posicao === 3 && <Medal className="w-4 h-4 text-orange-400 mx-auto" />}
        {linha.posicao > 3 && <span className="font-display text-base text-muted-foreground">{linha.posicao}</span>}
      </div>
      <Avatar className="w-9 h-9">
        {!linha.anonimo && linha.foto_url ? <AvatarImage src={linha.foto_url} alt={nome} /> : null}
        <AvatarFallback className="bg-surface-elevated text-xs">{iniciais(nome)}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{nome}{eh_eu && <span className="ml-2 text-xs text-gold">(você)</span>}</div>
        <div className="text-xs text-muted-foreground">{linha.total_acertos} acertos · {linha.taxa_acerto}%</div>
      </div>
      <div className={`font-display tabular-nums ${lucroPos ? "text-primary" : "text-destructive"}`}>
        {formatBRL(linha.lucro_centavos)}
      </div>
    </div>
  );
}