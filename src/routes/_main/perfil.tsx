import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useMinhasApostas, useCancelarAposta, formatBRL, PALPITE_LABEL, STATUS_LABEL, TRAVA_MINUTOS, type Aposta } from "@/lib/bets";
import { usePartidas, useSelecoes, selecaoMap, FASE_LABEL, type Partida } from "@/lib/tournament";
import { useEstatisticasUsuario, useEvolucaoSaldo, useToggleAnonimo } from "@/lib/ranking";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Trophy, Flame, Target, TrendingUp, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_main/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Copa Bolão 2026" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const { data: apostas } = useMinhasApostas(user?.id);
  const { data: partidas } = usePartidas();
  const { data: selecoes } = useSelecoes();
  const sMap = useMemo(() => selecaoMap(selecoes), [selecoes]);
  const { data: stats } = useEstatisticasUsuario(user?.id);
  const { data: evol } = useEvolucaoSaldo(user?.id, 30);
  const toggleAnon = useToggleAnonimo();

  const { data: transp } = useQuery({
    queryKey: ["perfil", "transparencia", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const uid = user!.id;
      const [dep, ap, sq] = await Promise.all([
        supabase.from("depositos").select("valor_centavos").eq("usuario_id", uid).eq("status", "confirmado"),
        supabase.from("apostas").select("valor_centavos, premio_centavos").eq("usuario_id", uid),
        supabase.from("saques").select("valor_centavos").eq("usuario_id", uid).eq("status", "pago"),
      ]);
      const totalDep = (dep.data ?? []).reduce((s: number, r: any) => s + Number(r.valor_centavos), 0);
      const totalApostado = (ap.data ?? []).reduce((s: number, r: any) => s + Number(r.valor_centavos), 0);
      const totalGanho = (ap.data ?? []).reduce((s: number, r: any) => s + Number(r.premio_centavos ?? 0), 0);
      const totalSaq = (sq.data ?? []).reduce((s: number, r: any) => s + Number(r.valor_centavos), 0);
      return { totalDep, totalApostado, totalGanho, totalSaq };
    },
  });

  const exportarHistorico = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("transacoes")
        .select("created_at, tipo, valor_centavos, saldo_apos_centavos, descricao")
        .eq("usuario_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const linhas = [
        ["data", "tipo", "valor_brl", "saldo_apos_brl", "descricao"].join(","),
        ...(data ?? []).map((t: any) =>
          [
            new Date(t.created_at).toISOString(),
            t.tipo,
            (Number(t.valor_centavos) / 100).toFixed(2).replace(".", ","),
            (Number(t.saldo_apos_centavos) / 100).toFixed(2).replace(".", ","),
            `"${(t.descricao ?? "").replace(/"/g, '""')}"`,
          ].join(",")
        ),
      ];
      const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meu-historico-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Histórico exportado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const pMap = useMemo(() => {
    const m: Record<string, Partida> = {};
    partidas?.forEach((p) => (m[p.id] = p));
    return m;
  }, [partidas]);

  const [faseFiltro, setFaseFiltro] = useState<string>("todas");

  const total = apostas?.length ?? 0;
  const ganhas = apostas?.filter((a) => a.status === "ganhou").length ?? 0;
  const ativas = apostas?.filter((a) => a.status === "ativa").length ?? 0;
  const premioTotal =
    apostas?.filter((a) => a.status === "ganhou").reduce((s, a) => s + (a.premio_centavos ?? 0), 0) ?? 0;
  const devolvido =
    apostas?.filter((a) => a.status === "devolvida").reduce((s, a) => s + (a.premio_centavos ?? 0), 0) ?? 0;

  const cards: { label: string; value: string; muted?: boolean }[] = [
    { label: "Apostas", value: String(total) },
    { label: "Ativas", value: String(ativas) },
    { label: "Acertos", value: String(ganhas) },
    { label: "Prêmios", value: formatBRL(premioTotal) },
  ];
  if (devolvido > 0) {
    cards.push({ label: "Devoluções", value: formatBRL(devolvido), muted: true });
  }

  const filtra = (lista: Aposta[] | undefined) =>
    (lista ?? []).filter((a) => {
      if (faseFiltro === "todas") return true;
      const part = pMap[a.partida_id];
      // Defensivo: se a partida ainda não carregou, mostra a aposta em vez de escondê-la.
      if (!part) return true;
      return part.fase === faseFiltro;
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

  const onToggleAnonimo = async (v: boolean) => {
    if (!user) return;
    try {
      await toggleAnon.mutateAsync({ uid: user.id, anonimo: v });
      await refreshProfile();
      toast.success(v ? "Perfil agora aparece como Anônimo no ranking" : "Perfil voltou a aparecer com seu apelido");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const chartData = (evol ?? []).map((t) => ({
    x: new Date(t.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    saldo: Number(t.saldo_apos_centavos) / 100,
  }));

  return (
    <div>
      <PageHeader title="Meu Perfil" />
      <Card className="bg-card border-border rounded-xl shadow-card p-6 mb-6 flex items-center gap-4">
        <Avatar className="w-20 h-20 border-4 border-primary shadow-glow">
          <AvatarFallback className="bg-surface-elevated text-2xl font-bold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-display text-2xl tracking-wide">{profile?.nome_completo ?? "Usuário"}</h2>
          <p className="text-muted-foreground text-sm">@{profile?.apelido ?? "—"}</p>
          <p className="text-gold text-sm font-semibold mt-1">Saldo: {formatBRL(profile?.saldo_centavos ?? 0)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="anon"
            checked={!!profile?.anonimo}
            onCheckedChange={onToggleAnonimo}
            disabled={toggleAnon.isPending}
          />
          <Label htmlFor="anon" className="text-xs text-muted-foreground cursor-pointer">Anônimo no ranking</Label>
        </div>
      </Card>

      {/* Sua estatística */}
      <Card className="bg-gradient-to-br from-primary/10 to-gold/10 border-gold/30 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-gold" />
          <h3 className="font-display text-xl tracking-wider">Sua estatística</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatTile icon={<Trophy className="w-4 h-4" />} label="Posição" value={stats?.posicao ? `#${stats.posicao}` : "—"} />
          <StatTile icon={<Target className="w-4 h-4" />} label="Acertos" value={String(stats?.total_acertos ?? 0)} />
          <StatTile icon={<TrendingUp className="w-4 h-4" />} label="Taxa de acerto" value={`${stats?.taxa_acerto ?? 0}%`} />
          <StatTile icon={<TrendingUp className="w-4 h-4" />} label="Lucro" value={formatBRL(stats?.lucro_centavos ?? 0)}
            className={(stats?.lucro_centavos ?? 0) >= 0 ? "text-primary" : "text-destructive"} />
          <StatTile icon={<Flame className="w-4 h-4" />} label="Sequência" value={String(stats?.melhor_sequencia ?? 0)} />
        </div>
      </Card>

      {/* Transparência */}
      <Card className="bg-card border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gold" />
            <h3 className="font-display text-xl tracking-wider">Transparência</h3>
          </div>
          <Button onClick={exportarHistorico} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-2" /> Exportar meu histórico CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile icon={<TrendingUp className="w-4 h-4" />} label="Depositado" value={formatBRL(transp?.totalDep ?? 0)} />
          <StatTile icon={<Target className="w-4 h-4" />} label="Apostado" value={formatBRL(transp?.totalApostado ?? 0)} />
          <StatTile icon={<Trophy className="w-4 h-4" />} label="Ganho em prêmios" value={formatBRL(transp?.totalGanho ?? 0)} />
          <StatTile icon={<TrendingUp className="w-4 h-4" />} label="Sacado" value={formatBRL(transp?.totalSaq ?? 0)} />
          <StatTile icon={<Flame className="w-4 h-4" />} label="Saldo atual" value={formatBRL(profile?.saldo_centavos ?? 0)} className="text-gold" />
        </div>
      </Card>

      {/* Evolução do saldo */}
      <Card className="bg-card border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-xl tracking-wider">Evolução do saldo</h3>
          <span className="text-xs text-muted-foreground">Últimas {chartData.length} transações</span>
        </div>
        {chartData.length < 2 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Faça apostas para ver seu histórico aqui.</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
                <XAxis dataKey="x" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }}
                  formatter={(v: number) => [`R$ ${v.toFixed(2)}`, "Saldo"]}
                />
                <Line type="monotone" dataKey="saldo" stroke="var(--gold)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {cards.map((s) => (
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

      <PWAStatusBadge />
    </div>
  );
}

function StatTile({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className="bg-card/60 rounded-lg p-3 border border-border/40">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wider mb-1">
        {icon}<span>{label}</span>
      </div>
      <div className={`font-display text-2xl ${className ?? ""}`}>{value}</div>
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
  const { refreshProfile } = useAuth();
  const mCancelar = useCancelarAposta();
  const cancelar = async (id: string) => {
    if (!window.confirm("Cancelar esta aposta? O valor será devolvido ao seu saldo.")) return;
    try {
      await mCancelar.mutateAsync(id);
      await refreshProfile();
      toast.success("Aposta cancelada e valor devolvido");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar");
    }
  };
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
        const minutosAteJogo = p ? (new Date(p.data_hora).getTime() - Date.now()) / 60000 : 0;
        const podeCancelar = a.status === "ativa" && p?.status === "agendada" && minutosAteJogo > TRAVA_MINUTOS;
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
            {podeCancelar && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={mCancelar.isPending}
                  onClick={() => cancelar(a.id)}
                >
                  {mCancelar.isPending ? "Cancelando…" : "Cancelar aposta"}
                </Button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function PWAStatusBadge() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(check());
  }, []);
  return (
    <Card className="bg-card border-border p-4 mt-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Sobre</div>
      {installed ? (
        <div className="text-sm text-primary font-medium">✅ Instalado como app</div>
      ) : (
        <div className="text-sm text-muted-foreground">
          🌐 Navegador <span className="text-xs">(instale para uma melhor experiência)</span>
        </div>
      )}
    </Card>
  );
}
