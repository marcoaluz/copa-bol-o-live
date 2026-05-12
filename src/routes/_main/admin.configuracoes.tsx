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
import { Checkbox } from "@/components/ui/checkbox";
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
  chave_pix_admin: string;
  nome_admin_recebedor: string;
  deposito_minimo_centavos: number;
  deposito_maximo_centavos: number;
  deposito_maximo_mensal_centavos: number;
  saldo_bancario_declarado_centavos: number;
  notif_email_ativo: boolean;
  notif_email_destino: string;
  notif_telegram_ativo: boolean;
  notif_eventos: Record<string, boolean>;
  app_url_publica: string;
  convite_template: string;
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

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <h3 className="font-semibold mb-1">Recebimento PIX</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Dados que aparecem para o usuário ao depositar. Sem chave configurada, depósitos ficam bloqueados.
        </p>
        <div className="space-y-3">
          <div>
            <Label>Chave PIX para recebimento</Label>
            <Input value={form.chave_pix_admin ?? ""}
              onChange={(e) => setForm({ ...form, chave_pix_admin: e.target.value })}
              placeholder="cpf, e-mail, telefone ou aleatória" />
          </div>
          <div>
            <Label>Nome que aparece na transferência</Label>
            <Input value={form.nome_admin_recebedor ?? ""}
              onChange={(e) => setForm({ ...form, nome_admin_recebedor: e.target.value })}
              placeholder="Nome do organizador" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Mínimo por depósito (R$)</Label>
              <Input type="number" step="0.01" value={reais(form.deposito_minimo_centavos)}
                onChange={(e) => setReais("deposito_minimo_centavos", e.target.value)} />
            </div>
            <div>
              <Label>Máximo por depósito (R$)</Label>
              <Input type="number" step="0.01" value={reais(form.deposito_maximo_centavos)}
                onChange={(e) => setReais("deposito_maximo_centavos", e.target.value)} />
            </div>
            <div>
              <Label>Limite mensal por usuário (R$)</Label>
              <Input type="number" step="0.01" value={reais(form.deposito_maximo_mensal_centavos)}
                onChange={(e) => setReais("deposito_maximo_mensal_centavos", e.target.value)} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <h3 className="font-semibold mb-1">Conciliação bancária</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Informe o saldo atual da conta usada para receber PIX. O painel de
          custódia alerta quando o saldo dos usuários supera esse valor.
        </p>
        <div>
          <Label>Saldo bancário declarado (R$)</Label>
          <Input type="number" step="0.01" value={reais(form.saldo_bancario_declarado_centavos ?? 0)}
            onChange={(e) => setReais("saldo_bancario_declarado_centavos", e.target.value)} />
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <h3 className="font-semibold mb-1">Notificações de admin</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Receba avisos imediatos quando houver depósitos, saques ou novos
          usuários. Configure os canais e os tipos de evento.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="block">E-mail (Resend)</Label>
              <p className="text-xs text-muted-foreground">Notificações no seu inbox</p>
            </div>
            <Switch
              checked={form.notif_email_ativo}
              onCheckedChange={(v) => setForm({ ...form, notif_email_ativo: v })}
            />
          </div>

          {form.notif_email_ativo && (
            <div>
              <Label>E-mail destino</Label>
              <Input
                type="email"
                value={form.notif_email_destino ?? ""}
                onChange={(e) => setForm({ ...form, notif_email_destino: e.target.value })}
                placeholder="seu-email@exemplo.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use o mesmo e-mail cadastrado na sua conta Resend (sandbox).
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div>
              <Label className="block">Telegram</Label>
              <p className="text-xs text-muted-foreground">Push instantâneo no celular</p>
            </div>
            <Switch
              checked={form.notif_telegram_ativo}
              onCheckedChange={(v) => setForm({ ...form, notif_telegram_ativo: v })}
            />
          </div>

          <div className="pt-2 border-t border-border">
            <Label className="block mb-2">Eventos para notificar</Label>
            <div className="space-y-2">
              {[
                { key: "deposito_pendente", label: "Novo depósito aguardando confirmação" },
                { key: "saque_pendente", label: "Novo saque solicitado" },
                { key: "novo_usuario", label: "Novo usuário cadastrado" },
              ].map((evt) => (
                <label key={evt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={!!form.notif_eventos?.[evt.key]}
                    onCheckedChange={(v) =>
                      setForm({
                        ...form,
                        notif_eventos: { ...(form.notif_eventos ?? {}), [evt.key]: !!v },
                      })
                    }
                  />
                  {evt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border rounded-xl shadow-card p-5 mb-4">
        <h3 className="font-semibold mb-1">Convite de novos usuários</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Configure a URL pública e o template da mensagem de convite.
        </p>
        <div className="space-y-4">
          <div>
            <Label>URL pública do app</Label>
            <Input
              value={form.app_url_publica ?? ""}
              onChange={(e) => setForm({ ...form, app_url_publica: e.target.value })}
              placeholder="https://copa-bolao-live.lovable.app"
            />
            <p className="text-xs text-muted-foreground mt-1">
              URL para onde os amigos vão acessar. Inclua https://
            </p>
          </div>
          <div>
            <Label>Mensagem do convite (template)</Label>
            <Textarea
              value={form.convite_template ?? ""}
              onChange={(e) => setForm({ ...form, convite_template: e.target.value })}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Variáveis disponíveis: <code>{"{nome}"}</code>, <code>{"{url}"}</code>, <code>{"{email}"}</code>
            </p>
          </div>
        </div>
      </Card>

      <Button className="bg-gradient-primary" disabled={m.isPending} onClick={() => m.mutate(form)}>
        <Save className="w-4 h-4 mr-2" /> Salvar configurações
      </Button>
    </div>
  );
}
