import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useMinhasApostas, formatBRL, PALPITE_LABEL, STATUS_LABEL, type Aposta } from "@/lib/bets";
import { usePartidas, useSelecoes, selecaoMap, FASE_LABEL, type Partida } from "@/lib/tournament";

export const Route = createFileRoute("/_main/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Copa Bolão 2026" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile } = useAuth();
  const { data: apostas } = useMinhasApostas(user?.id);
  const { data: partidas } = usePartidas();
  const { data: selecoes } = useSelecoes();
  const sMap = useMemo(() => selecaoMap(selecoes), [selecoes]);
  const pMap = useMemo(() => {
    const m: Record<string, Partida> = {};
    partidas?.forEach((p) => (m[p.id] = p));
    return m;
  }, [partidas]);

  const [faseFiltro, setFaseFiltro] = useState<string>("todas");

  const total = apostas?.length ?? 0;
  const ganhas = apostas?.filter((a) => a.status === "ganhou").length ?? 0;
  const ativas = apostas?.filter((a) => a.status === "ativa").length ?? 0;
  const premioTotal = apostas?.reduce((s, a) => s + (a.premio_centavos ?? 0), 0) ?? 0;

  const stats = [
    { label: "Apostas", value: String(total) },
    { label: "Ativas", value: String(ativas) },
    { label: "Acertos", value: String(ganhas) },
    { label: "Prêmios", value: formatBRL(premioTotal) },
  ];

  const filtra = (lista: Aposta[] | undefined) =>
    (lista ?? []).filter((a) => {
      if (faseFiltro === "todas") return true;
      const part = pMap[a.partida_id];
      return part?.fase === faseFiltro;
    });

  const ativasList = filtra(apostas?.filter((a) => a.status === "ativa"));
  const encerradasList = filtra(apostas?.filter((a) => a.status !== "ativa"));
  const todasList = filtra(apostas);

  const initials = (profile?.apelido ?? profile?.nome_completo ?? "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div>
      <PageHeader title="Meu Perfil" />
      <Card className="bg-card border-border rounded-xl shadow-card p-6 mb-6 flex items-center gap-4">
        <Avatar className="w-20 h-20 border-4 border-primary shadow-glow">
          <AvatarFallback className="bg-surface-elevated text-2xl font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-display text-2xl tracking-wide">{profile?.nome_completo ?? "Usuário"}</h2>
          <p className="text-muted-foreground text-sm">@{profile?.apelido ?? "—"}</p>
          <p className="text-gold text-sm font-semibold mt-1">Saldo: {formatBRL(profile?.saldo_centavos ?? 0)}</p>
        </div>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="bg-card border-border rounded-xl p-4 text-center">
            <div className="font-display text-2xl text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="flex items-end justify-between mb-3 gap-3">
        <h3 className="font-display text-2xl tracking-wide">Minhas apostas</h3>
        <Select value={faseFiltro} onValueChange={setFaseFiltro}>
          <SelectTrigger className="w-44 bg-card border-border">
            <SelectValue placeholder="Filtrar por fase" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border z-50">
            <SelectItem value="todas">Todas as fases</SelectItem>
            <SelectItem value="grupos">Fase de grupos</SelectItem>
            <SelectItem value="oitavas">Oitavas</SelectItem>
            <SelectItem value="quartas">Quartas</SelectItem>
            <SelectItem value="semi">Semifinal</SelectItem>
            <SelectItem value="terceiro">3º lugar</SelectItem>
            <SelectItem value="final">Final</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="ativas">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="ativas">Ativas ({ativasList.length})</TabsTrigger>
          <TabsTrigger value="encerradas">Encerradas ({encerradasList.length})</TabsTrigger>
          <TabsTrigger value="todas">Todas ({todasList.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="ativas" className="mt-4">
          <ApostasList apostas={ativasList} pMap={pMap} sMap={sMap} />
        </TabsContent>
        <TabsContent value="encerradas" className="mt-4">
          <ApostasList apostas={encerradasList} pMap={pMap} sMap={sMap} />
        </TabsContent>
        <TabsContent value="todas" className="mt-4">
          <ApostasList apostas={todasList} pMap={pMap} sMap={sMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function statusVariant(s: Aposta["status"]) {
  switch (s) {
    case "ganhou":
      return "bg-primary/20 text-primary border-primary/40";
    case "perdeu":
      return "bg-destructive/20 text-destructive border-destructive/40";
    case "devolvida":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-gold/15 text-gold border-gold/40";
  }
}

function ApostasList({
  apostas,
  pMap,
  sMap,
}: {
  apostas: Aposta[];
  pMap: Record<string, Partida>;
  sMap: Record<string, ReturnType<typeof selecaoMap> extends Record<string, infer T> ? T : never>;
}) {
  if (apostas.length === 0) {
    return (
      <Card className="bg-card border-border rounded-xl p-8 text-center text-muted-foreground">
        Nenhuma aposta para exibir.
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {apostas.map((a) => {
        const p = pMap[a.partida_id];
        const casa = p?.selecao_casa_id ? sMap[p.selecao_casa_id] : null;
        const visit = p?.selecao_visitante_id ? sMap[p.selecao_visitante_id] : null;
        return (
          <Card key={a.id} className="bg-card border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="text-xs text-muted-foreground">
                {p ? FASE_LABEL[p.fase] : "—"} · {p ? new Date(p.data_hora).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
              </div>
              <Badge variant="outline" className={statusVariant(a.status)}>{STATUS_LABEL[a.status]}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">
                {(casa?.nome ?? p?.placeholder_casa ?? "—")} <span className="text-muted-foreground font-normal">vs</span> {(visit?.nome ?? p?.placeholder_visitante ?? "—")}
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Palpite</div>
                <div className="font-semibold">{PALPITE_LABEL[a.palpite]}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Valor</div>
                <div className="font-display text-gold">{formatBRL(a.valor_centavos)}</div>
              </div>
              {a.premio_centavos != null && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Prêmio</div>
                  <div className="font-display text-primary">{formatBRL(a.premio_centavos)}</div>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
