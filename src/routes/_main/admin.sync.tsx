import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, RefreshCw, Trash2, AlertTriangle, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/sync")({
  head: () => ({ meta: [{ title: "Admin · Sincronização API" }] }),
  component: AdminSyncPage,
});

function AdminSyncPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmacaoReset, setConfirmacaoReset] = useState("");

  const { data: cfg } = useQuery({
    queryKey: ["config", "sync"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["sync-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("api_sync_log")
        .select("*")
        .order("iniciado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const [leagueId, setLeagueId] = useState("");
  const [season, setSeason] = useState("");

  useEffect(() => {
    if (cfg) {
      setLeagueId(String(cfg.api_football_league_id ?? 1));
      setSeason(String(cfg.api_football_season ?? 2026));
    }
  }, [cfg]);

  const syncMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-copa-2026", { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      if (d?.erro) toast.error(`Falha: ${d.erro}`);
      else toast.success(`Sync concluído: ${d?.partidas?.inseridas ?? 0} partidas inseridas, ${d?.partidas?.atualizadas ?? 0} atualizadas`);
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
      qc.invalidateQueries({ queryKey: ["config", "sync"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await supabase.from("config")
        .update({ api_football_sync_ativo: ativo } as any).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["config", "sync"] });
    },
  });

  const updateLeagueMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("config").update({
        api_football_league_id: parseInt(leagueId),
        api_football_season: parseInt(season),
      } as any).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liga/temporada atualizada");
      qc.invalidateQueries({ queryKey: ["config", "sync"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc("preparar_para_sync_real");
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Reset OK: ${d.partidas_apagadas} partidas e ${d.selecoes_apagadas} seleções apagadas. Agora clique "Sincronizar agora".`);
      setResetOpen(false);
      setConfirmacaoReset("");
      qc.invalidateQueries({ queryKey: ["sync-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!profile?.is_admin) {
    return <p className="p-8 text-muted-foreground">Acesso restrito.</p>;
  }

  const ultimoSync = cfg?.api_football_ultimo_sync ? new Date(cfg.api_football_ultimo_sync) : null;
  const semSync = !ultimoSync;
  const syncAntigo = ultimoSync && (Date.now() - ultimoSync.getTime() > 60 * 60 * 1000);

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-4 h-4" /> Voltar ao admin
      </Link>
      <PageHeader title="Sincronização API-Football" subtitle="Dados reais da Copa do Mundo 2026" />

      <Card className="bg-card border-border rounded-xl p-5 shadow-card mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold mb-1">Sincronização automática</h3>
            <p className="text-xs text-muted-foreground">Roda a cada 30 minutos via pg_cron</p>
          </div>
          <Switch
            checked={!!cfg?.api_football_sync_ativo}
            onCheckedChange={(v) => toggleMut.mutate(v)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-xs">Liga (league.id)</Label>
            <Input value={leagueId} onChange={(e) => setLeagueId(e.target.value)} />
            <p className="text-[11px] text-muted-foreground mt-1">World Cup geralmente é id=1</p>
          </div>
          <div>
            <Label className="text-xs">Temporada (year)</Label>
            <Input value={season} onChange={(e) => setSeason(e.target.value)} />
          </div>
        </div>
        <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 text-sm flex gap-2 mt-3 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-gold" />
          <div>
            <strong>Plano free da API-Football:</strong> só permite temporadas
            de 2022 a 2024. Para testar com dados reais agora, use season=2022
            (Copa do Catar). Quando a Copa 2026 começar, será necessário trocar
            para uma API que cubra 2026 (ex.: TheSportsDB).
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button type="button" variant="outline" size="sm"
            onClick={() => { setLeagueId("1"); setSeason("2022"); }}>
            Copa 2022 (Catar) — testar
          </Button>
          <Button type="button" variant="outline" size="sm"
            onClick={() => { setLeagueId("1"); setSeason("2026"); }}>
            Copa 2026 (precisa plano pago)
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => updateLeagueMut.mutate()}>
          Salvar liga/temporada
        </Button>
      </Card>

      <Card className="bg-card border-border rounded-xl p-5 shadow-card mb-4">
        <h3 className="font-semibold mb-3">Status do último sync</h3>
        {semSync ? (
          <Badge variant="outline">Nunca sincronizado</Badge>
        ) : syncAntigo ? (
          <Badge className="bg-gold text-gold-foreground">
            Atrasado · último em {ultimoSync!.toLocaleString("pt-BR")}
          </Badge>
        ) : (
          <Badge className="bg-green-600 text-white">
            OK · {ultimoSync!.toLocaleString("pt-BR")}
          </Badge>
        )}
        {cfg?.api_football_ultimo_erro && (
          <p className="text-xs text-destructive mt-2">
            Último erro: {cfg.api_football_ultimo_erro}
          </p>
        )}
        <div className="mt-4">
          <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            <RefreshCw className={`w-4 h-4 ${syncMut.isPending ? "animate-spin" : ""}`} />
            {syncMut.isPending ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </div>
      </Card>

      <Card className="bg-destructive/5 border-destructive/40 rounded-xl p-5 mb-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" /> Zona perigosa
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          Apaga TODAS as partidas e seleções fictícias do banco para popular
          com dados reais da API. Só funciona se NÃO houver apostas vinculadas.
          Use apenas uma vez, antes da Copa começar.
        </p>
        <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
          <Trash2 className="w-4 h-4" /> Limpar dados fictícios
        </Button>
      </Card>

      <Card className="bg-card border-border rounded-xl p-5 shadow-card">
        <h3 className="font-semibold mb-3">Histórico de sincronizações</h3>
        <div className="divide-y divide-border">
          {!logs?.length && (
            <p className="text-sm text-muted-foreground py-2">Nenhum sync ainda.</p>
          )}
          {logs?.map((l: any) => {
            const Icon = l.status === "sucesso" ? CheckCircle2
              : l.status === "falha" ? XCircle : Clock;
            const cor = l.status === "sucesso" ? "text-green-500"
              : l.status === "falha" ? "text-destructive" : "text-gold";
            return (
              <div key={l.id} className="py-3 flex items-start gap-3 text-sm">
                <Icon className={`w-4 h-4 mt-0.5 ${cor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(l.iniciado_em).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {l.status === "sucesso" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {l.partidas_inseridas} partidas inseridas, {l.partidas_atualizadas} atualizadas,
                      {" "}{l.selecoes_inseridas + l.selecoes_atualizadas} seleções,
                      {" "}{l.requests_consumidos} requests
                    </p>
                  )}
                  {l.erro && (
                    <p className="text-xs text-destructive mt-1 break-words">
                      {l.erro.includes("Free plans")
                        ? "Plano gratuito da API-Football não cobre essa temporada. Use season entre 2022 e 2024 para testes, ou contrate plano pago para 2026."
                        : l.erro}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" /> Confirmar limpeza
            </DialogTitle>
            <DialogDescription>
              Isso vai APAGAR todas as partidas e seleções do banco.
              Operação irreversível. Só prossiga se ainda não houver
              apostas em produção. Para confirmar, digite LIMPAR abaixo.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmacaoReset}
            onChange={(e) => setConfirmacaoReset(e.target.value)}
            placeholder="Digite LIMPAR"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetOpen(false); setConfirmacaoReset(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={confirmacaoReset !== "LIMPAR" || resetMut.isPending}
              onClick={() => resetMut.mutate()}
            >
              {resetMut.isPending ? "Limpando..." : "Confirmar limpeza"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}