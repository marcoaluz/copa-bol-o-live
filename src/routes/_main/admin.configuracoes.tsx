import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_main/admin/configuracoes")({
  head: () => ({ meta: [{ title: "Admin · Configurações" }] }),
  component: Page,
});

type Cfg = {
  taxa_casa_percentual: number;
  politica_sem_ganhadores: "devolver" | "acumular";
  valor_minimo_aposta_centavos: number;
  valor_maximo_aposta_centavos: number;
  valor_minimo_saque_centavos: number;
  valor_maximo_saque_diario_centavos: number;
  manutencao_ativa: boolean;
  manutencao_mensagem: string | null;
};

function Page() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin", "config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("config").select("*").eq("id", 1).single();
      if (error) throw error;
      return data as unknown as Cfg;
    },
  });
  const [form, setForm] = useState<Cfg | null>(null);
  useEffect(() => { if (data && !form) setForm(data); }, [data, form]);

  const m = useMutation({
    mutationFn: async (v: Cfg) => {
      const { error } = await supabase.from("config").update(v as any).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["admin", "config"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!form) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const setReais = (key: keyof Cfg, valor: string) => {
    const r = parseFloat(valor.replace(",", "."));
    setForm({ ...form, [key]: isNaN(r) ? 0 : Math.round(r * 100) } as Cfg);
  };
  const reais = (c: number) => (c / 100).toFixed(2);

  return (
    <div>
      <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-3 hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Voltar</Link>
      <PageHeader title="Configurações" subtitle="Parâmetros gerais do bolão" />

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <h3 className="font-semibold mb-4">Modo manutenção</h3>
        <div className="flex items-center gap-3 mb-3">
          <Switch checked={form.manutencao_ativa} onCheckedChange={(v) => setForm({ ...form, manutencao_ativa: v })} />
          <Label>Bloquear novas apostas e exibir banner</Label>
        </div>
        <Textarea placeholder="Mensagem opcional do banner" value={form.manutencao_mensagem ?? ""} onChange={(e) => setForm({ ...form, manutencao_mensagem: e.target.value })} />
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <h3 className="font-semibold mb-4">Taxa da casa: <span className="text-gold tabular-nums">{form.taxa_casa_percentual}%</span></h3>
        <Slider min={0} max={20} step={1} value={[form.taxa_casa_percentual]} onValueChange={(v) => setForm({ ...form, taxa_casa_percentual: v[0] })} />

        <div className="mt-5">
          <Label className="mb-2 block">Política sem ganhadores</Label>
          <Select value={form.politica_sem_ganhadores} onValueChange={(v) => setForm({ ...form, politica_sem_ganhadores: v as Cfg["politica_sem_ganhadores"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="devolver">Devolver apostas</SelectItem>
              <SelectItem value="acumular">Acumular para próxima partida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <h3 className="font-semibold mb-4">Limites de aposta (R$)</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Mínimo</Label><Input type="number" step="0.01" value={reais(form.valor_minimo_aposta_centavos)} onChange={(e) => setReais("valor_minimo_aposta_centavos", e.target.value)} /></div>
          <div><Label>Máximo</Label><Input type="number" step="0.01" value={reais(form.valor_maximo_aposta_centavos)} onChange={(e) => setReais("valor_maximo_aposta_centavos", e.target.value)} /></div>
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <h3 className="font-semibold mb-4">Limites de saque (R$)</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Mínimo</Label><Input type="number" step="0.01" value={reais(form.valor_minimo_saque_centavos)} onChange={(e) => setReais("valor_minimo_saque_centavos", e.target.value)} /></div>
          <div><Label>Máximo diário</Label><Input type="number" step="0.01" value={reais(form.valor_maximo_saque_diario_centavos)} onChange={(e) => setReais("valor_maximo_saque_diario_centavos", e.target.value)} /></div>
        </div>
      </Card>

      <Button className="bg-gradient-primary" disabled={m.isPending} onClick={() => m.mutate(form)}>
        <Save className="w-4 h-4 mr-2" /> Salvar configurações
      </Button>
    </div>
  );
}