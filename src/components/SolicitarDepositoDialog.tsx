import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Copy, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

function fmt(c: number) {
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type CriarRes = {
  id: string;
  codigo_referencia: string;
  valor_centavos: number;
  chave_pix: string;
  nome_recebedor: string;
};

export function SolicitarDepositoDialog({
  open,
  onOpenChange,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmed?: () => void;
}) {
  const [valor, setValor] = useState("");
  const [pago, setPago] = useState(false);
  const [resp, setResp] = useState<CriarRes | null>(null);

  const { data: cfg } = useQuery({
    queryKey: ["config", "deposito"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config")
        .select("deposito_minimo_centavos, deposito_maximo_centavos, chave_pix_admin")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data as { deposito_minimo_centavos: number; deposito_maximo_centavos: number; chave_pix_admin: string };
    },
  });

  useEffect(() => {
    if (!open) {
      setValor(""); setResp(null); setPago(false);
    }
  }, [open]);

  const criar = useMutation({
    mutationFn: async () => {
      const r = parseFloat(valor.replace(",", "."));
      if (isNaN(r) || r <= 0) throw new Error("Informe um valor válido");
      const { data, error } = await (supabase as any).rpc("criar_deposito", {
        p_valor_centavos: Math.round(r * 100),
      });
      if (error) throw error;
      return data as CriarRes;
    },
    onSuccess: (d) => setResp(d),
    onError: (e: Error) => toast.error(e.message),
  });

  const marcarPago = useMutation({
    mutationFn: async () => {
      if (!resp) return;
      const { error } = await (supabase as any).rpc("marcar_deposito_pago", { p_deposito_id: resp.id });
      if (error) throw error;
    },
    onSuccess: () => {
      setPago(true);
      toast.success("Pagamento registrado! Aguarde a confirmação do organizador.");
      onConfirmed?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (t: string, label: string) => {
    navigator.clipboard.writeText(t);
    toast.success(`${label} copiado`);
  };

  const min = cfg?.deposito_minimo_centavos ?? 1000;
  const max = cfg?.deposito_maximo_centavos ?? 50000;
  const semChave = cfg && (!cfg.chave_pix_admin || cfg.chave_pix_admin === "");

  const setRapido = (c: number) => setValor((c / 100).toFixed(2));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {!resp && (
          <>
            <DialogHeader>
              <DialogTitle>Depositar via PIX</DialogTitle>
              <DialogDescription>
                Mínimo R$ {fmt(min)} · Máximo R$ {fmt(max)} por depósito
              </DialogDescription>
            </DialogHeader>

            {semChave && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Recebimento PIX ainda não configurado pelo organizador.</span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="text-lg tabular-nums"
              />
              <div className="flex gap-2 flex-wrap pt-1">
                {[1000, 2500, 5000, 10000].map((c) => (
                  <Button key={c} type="button" size="sm" variant="outline" onClick={() => setRapido(c)}>
                    R$ {fmt(c)}
                  </Button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                disabled={criar.isPending || semChave || !valor}
                onClick={() => criar.mutate()}
                className="bg-gradient-primary"
              >
                {criar.isPending ? "Gerando..." : "Gerar PIX"}
              </Button>
            </DialogFooter>
          </>
        )}

        {resp && !pago && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-gold">Faça o PIX agora</span>
              </DialogTitle>
              <DialogDescription>
                Use os dados abaixo no app do seu banco
              </DialogDescription>
            </DialogHeader>

            <Card className="p-4 bg-gold/10 border-gold/40">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Valor exato</p>
              <p className="text-3xl font-bold text-gold tabular-nums">R$ {fmt(resp.valor_centavos)}</p>
            </Card>

            <Card className="p-4 bg-surface/40 border-border/50 space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Chave PIX</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-medium truncate">{resp.chave_pix}</code>
                <Button size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => copy(resp.chave_pix, "Chave PIX")}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              {resp.nome_recebedor && (
                <p className="text-xs text-muted-foreground">Recebedor: {resp.nome_recebedor}</p>
              )}
            </Card>

            <Card className="p-4 bg-primary/10 border-primary/40">
              <p className="text-xs text-primary uppercase tracking-wider mb-1 font-semibold">
                Código de referência
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-2xl font-bold tabular-nums tracking-wider">{resp.codigo_referencia}</code>
                <Button size="icon" variant="ghost"
                  onClick={() => copy(resp.codigo_referencia, "Código")}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 mt-2 text-xs text-destructive flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  É <strong>obrigatório</strong> colocar este código na descrição do PIX, senão
                  seu depósito não será identificado.
                </span>
              </div>
            </Card>

            <DialogFooter className="flex-col sm:flex-row">
              <Button variant="outline" onClick={() => setResp(null)}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Mudar valor
              </Button>
              <Button
                onClick={() => marcarPago.mutate()}
                disabled={marcarPago.isPending}
                className="bg-gradient-primary"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {marcarPago.isPending ? "Confirmando..." : "Já fiz o PIX"}
              </Button>
            </DialogFooter>
          </>
        )}

        {resp && pago && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-5 h-5" /> Aguardando confirmação
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Recebemos o aviso do seu PIX no valor de{" "}
              <strong>R$ {fmt(resp.valor_centavos)}</strong> com o código{" "}
              <code className="text-foreground">{resp.codigo_referencia}</code>.
            </p>
            <p className="text-sm text-muted-foreground">
              Após confirmar, aguarde até algumas horas para o organizador
              liberar o saldo na sua carteira. Você receberá uma notificação.
            </p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="bg-gradient-primary">
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}