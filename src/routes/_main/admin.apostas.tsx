import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Search } from "lucide-react";

export const Route = createFileRoute("/_main/admin/apostas")({
  head: () => ({ meta: [{ title: "Admin · Apostas ativas" }] }),
  component: Page,
});

const fmt = (c: number) =>
  "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tipo = "vencedor" | "placar" | "todas";

function Page() {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<Tipo>("todas");
  const [torneioId, setTorneioId] = useState<string>("todos");

  const { data: torneios } = useQuery({
    queryKey: ["admin", "apostas", "torneios"],
    queryFn: async () => (await supabase.from("torneios").select("id, nome_curto, emoji").order("ordem")).data ?? [],
  });

  const { data: apostas } = useQuery({
    queryKey: ["admin", "apostas-ativas", "vencedor", torneioId],
    queryFn: async () => {
      let q = supabase.from("apostas").select("*").eq("status", "ativa").order("created_at", { ascending: false }).limit(1000);
      if (torneioId !== "todos") q = q.eq("torneio_id", torneioId);
      return (await q).data ?? [];
    },
  });

  const { data: apostasPlacar } = useQuery({
    queryKey: ["admin", "apostas-ativas", "placar", torneioId],
    queryFn: async () => {
      let q = supabase.from("apostas_placar").select("*").eq("status", "ativa").order("created_at", { ascending: false }).limit(1000);
      if (torneioId !== "todos") q = q.eq("torneio_id", torneioId);
      return (await q).data ?? [];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    (apostas ?? []).forEach((a: any) => s.add(a.usuario_id));
    (apostasPlacar ?? []).forEach((a: any) => s.add(a.usuario_id));
    return Array.from(s);
  }, [apostas, apostasPlacar]);

  const partidaIds = useMemo(() => {
    const s = new Set<string>();
    (apostas ?? []).forEach((a: any) => s.add(a.partida_id));
    (apostasPlacar ?? []).forEach((a: any) => s.add(a.partida_id));
    return Array.from(s);
  }, [apostas, apostasPlacar]);

  const { data: profiles } = useQuery({
    queryKey: ["admin", "apostas", "profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => (await supabase.from("profiles").select("id, apelido, nome_completo").in("id", userIds)).data ?? [],
  });
  const { data: partidas } = useQuery({
    queryKey: ["admin", "apostas", "partidas", partidaIds.join(",")],
    enabled: partidaIds.length > 0,
    queryFn: async () => (await supabase.from("partidas").select("id, codigo, fase, data_hora, status, selecao_casa_id, selecao_visitante_id, placeholder_casa, placeholder_visitante").in("id", partidaIds)).data ?? [],
  });
  const selecaoIds = useMemo(() => {
    const s = new Set<string>();
    (partidas ?? []).forEach((p: any) => { if (p.selecao_casa_id) s.add(p.selecao_casa_id); if (p.selecao_visitante_id) s.add(p.selecao_visitante_id); });
    return Array.from(s);
  }, [partidas]);
  const { data: selecoes } = useQuery({
    queryKey: ["admin", "apostas", "selecoes", selecaoIds.join(",")],
    enabled: selecaoIds.length > 0,
    queryFn: async () => (await supabase.from("selecoes").select("id, nome, codigo_iso").in("id", selecaoIds)).data ?? [],
  });

  const profileMap = useMemo(() => Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p])), [profiles]);
  const partidaMap = useMemo(() => Object.fromEntries((partidas ?? []).map((p: any) => [p.id, p])), [partidas]);
  const selecaoMap = useMemo(() => Object.fromEntries((selecoes ?? []).map((s: any) => [s.id, s])), [selecoes]);

  const nomePartida = (pid: string) => {
    const p = partidaMap[pid];
    if (!p) return "—";
    const casa = p.selecao_casa_id ? selecaoMap[p.selecao_casa_id]?.nome ?? "?" : p.placeholder_casa ?? "?";
    const vis = p.selecao_visitante_id ? selecaoMap[p.selecao_visitante_id]?.nome ?? "?" : p.placeholder_visitante ?? "?";
    return `${casa} × ${vis}`;
  };
  const palpiteVencedor = (pid: string, palpite: string) => {
    const p = partidaMap[pid];
    if (!p) return palpite;
    if (palpite === "casa") return p.selecao_casa_id ? selecaoMap[p.selecao_casa_id]?.nome ?? "Casa" : p.placeholder_casa ?? "Casa";
    if (palpite === "visitante") return p.selecao_visitante_id ? selecaoMap[p.selecao_visitante_id]?.nome ?? "Visitante" : p.placeholder_visitante ?? "Visitante";
    return "Empate";
  };

  type Linha = {
    id: string; tipo: "vencedor" | "placar"; usuario_id: string; partida_id: string;
    valor: number; created_at: string; descricao: string;
  };
  const linhas: Linha[] = useMemo(() => {
    const a: Linha[] = (apostas ?? []).map((x: any) => ({
      id: `v-${x.id}`, tipo: "vencedor", usuario_id: x.usuario_id, partida_id: x.partida_id,
      valor: x.valor_centavos, created_at: x.created_at,
      descricao: `Vencedor: ${palpiteVencedor(x.partida_id, x.palpite)}`,
    }));
    const b: Linha[] = (apostasPlacar ?? []).map((x: any) => ({
      id: `p-${x.id}`, tipo: "placar", usuario_id: x.usuario_id, partida_id: x.partida_id,
      valor: x.valor_centavos, created_at: x.created_at,
      descricao: `Placar exato: ${x.gols_casa_palpite} × ${x.gols_visitante_palpite}`,
    }));
    let arr = [...a, ...b];
    if (tipo !== "todas") arr = arr.filter((l) => l.tipo === tipo);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter((l) => {
        const u = profileMap[l.usuario_id];
        return (
          (u?.apelido ?? "").toLowerCase().includes(q) ||
          (u?.nome_completo ?? "").toLowerCase().includes(q) ||
          nomePartida(l.partida_id).toLowerCase().includes(q) ||
          (partidaMap[l.partida_id]?.codigo ?? "").toLowerCase().includes(q)
        );
      });
    }
    return arr.sort((x, y) => y.created_at.localeCompare(x.created_at));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apostas, apostasPlacar, tipo, busca, profileMap, partidaMap, selecaoMap]);

  const total = linhas.reduce((s, l) => s + l.valor, 0);

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-3 hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
      <PageHeader title="Apostas ativas" subtitle={`${linhas.length} apostas · total ${fmt(total)}`} />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por usuário, partida ou código…" className="pl-9" />
        </div>
        <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
          <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os tipos</SelectItem>
            <SelectItem value="vencedor">Vencedor</SelectItem>
            <SelectItem value="placar">Placar exato</SelectItem>
          </SelectContent>
        </Select>
        <Select value={torneioId} onValueChange={setTorneioId}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os torneios</SelectItem>
            {(torneios ?? []).map((t: any) => (
              <SelectItem key={t.id} value={t.id}>{t.emoji} {t.nome_curto}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border rounded-xl shadow-card divide-y divide-border">
        {linhas.map((l) => {
          const u = profileMap[l.usuario_id];
          const p = partidaMap[l.partida_id];
          return (
            <div key={l.id} className="p-3 flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to="/admin/usuarios/$id" params={{ id: l.usuario_id }} className="font-medium text-sm hover:underline">
                    {u?.nome_completo || u?.apelido || l.usuario_id.slice(0, 8)}
                  </Link>
                  {u?.apelido && <span className="text-xs text-muted-foreground">@{u.apelido}</span>}
                  <Badge variant="outline" className="text-[10px]">{l.tipo === "vencedor" ? "vencedor" : "placar"}</Badge>
                </div>
                <p className="text-sm mt-0.5">
                  <span className="text-muted-foreground">{p?.codigo ? `${p.codigo} · ` : ""}</span>
                  {nomePartida(l.partida_id)}
                </p>
                <p className="text-xs text-foreground/80 mt-0.5">{l.descricao}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                  {p?.data_hora && <> · jogo {new Date(p.data_hora).toLocaleString("pt-BR")}</>}
                  {p?.status && <> · <span className="uppercase">{p.status}</span></>}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{fmt(l.valor)}</p>
              </div>
            </div>
          );
        })}
        {linhas.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhuma aposta ativa encontrada.</p>}
      </Card>
    </div>
  );
}
