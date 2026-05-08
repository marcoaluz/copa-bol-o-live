import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

type TipoChave = "cpf" | "email" | "telefone" | "aleatoria";

function validarChave(tipo: TipoChave, chave: string): string | null {
  const c = chave.trim();
  if (!c) return "Informe a chave PIX";
  if (tipo === "cpf") {
    const d = c.replace(/\D/g, "");
    if (d.length !== 11) return "CPF deve ter 11 dígitos";
  } else if (tipo === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return "E-mail inválido";
  } else if (tipo === "telefone") {
    const d = c.replace(/\D/g, "");
    if (d.length < 10 || d.length > 13) return "Telefone inválido";
  } else if (tipo === "aleatoria") {
    if (c.length < 32) return "Chave aleatória inválida";
  }
  return null;
}

function formatBRL(c: number) {
  return (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SolicitarSaqueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const saldo = profile?.saldo_centavos ?? 0;
  const [valorStr, setValorStr] = useState("");
  const [tipoChave, setTipoChave] = useState<TipoChave>("cpf");
  const [chave, setChave] = useState("");

  const valorCentavos = Math.round(parseFloat(valorStr.replace(",", ".") || "0") * 100);

  const erroChave = validarChave(tipoChave, chave);
  const erroValor =
    !valorCentavos ? "Informe o valor"
    : valorCentavos < 2000 ? "Mínimo R$ 20,00"
    : valorCentavos > saldo ? "Saldo insuficiente"
    : null;

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("solicitar_saque", {
        p_valor_centavos: valorCentavos,
        p_chave_pix: chave.trim(),
        p_tipo_chave: tipoChave,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      toast.success("Solicitação enviada! Aguarde a confirmação do admin.");
      setValorStr(""); setChave("");
      onOpenChange(false);
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["saques"] });
      qc.invalidateQueries({ queryKey: ["transacoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const podeEnviar = !erroChave && !erroValor && !mut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card">
        <DialogHeader>
          <DialogTitle>Solicitar acerto via PIX</DialogTitle>
          <DialogDescription>
            Saldo disponível: <strong className="text-gold">R$ {formatBRL(saldo)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="number" inputMode="decimal" step="0.01" min="20"
              value={valorStr} onChange={(e) => setValorStr(e.target.value)}
              placeholder="0,00"
              className="text-lg tabular-nums"
            />
            {valorStr && erroValor && <p className="text-xs text-destructive mt-1">{erroValor}</p>}
            <div className="flex gap-2 mt-2">
              {[2000, 5000, 10000, saldo].filter((v, i, a) => v > 0 && v <= saldo && a.indexOf(v) === i).map((v) => (
                <Button key={v} type="button" variant="outline" size="sm"
                  onClick={() => setValorStr((v / 100).toFixed(2))}>
                  R$ {formatBRL(v)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Tipo de chave PIX</Label>
            <RadioGroup value={tipoChave} onValueChange={(v) => setTipoChave(v as TipoChave)} className="grid grid-cols-2 gap-2 mt-2">
              {(["cpf", "email", "telefone", "aleatoria"] as TipoChave[]).map((t) => (
                <Label key={t} htmlFor={`t-${t}`} className="flex items-center gap-2 border border-border rounded-lg p-2 cursor-pointer hover:bg-surface-elevated">
                  <RadioGroupItem id={`t-${t}`} value={t} />
                  <span className="capitalize text-sm">{t === "aleatoria" ? "Aleatória" : t.toUpperCase()}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="chave">Chave PIX</Label>
            <Input id="chave" value={chave} onChange={(e) => setChave(e.target.value)}
              placeholder={
                tipoChave === "cpf" ? "000.000.000-00"
                : tipoChave === "email" ? "voce@exemplo.com"
                : tipoChave === "telefone" ? "+55 31 99999-9999"
                : "00000000-0000-0000-0000-000000000000"
              } />
            {chave && erroChave && <p className="text-xs text-destructive mt-1">{erroChave}</p>}
          </div>

          <div className="flex gap-2 text-xs text-muted-foreground bg-surface/40 p-3 rounded-lg border border-border/50">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              O acerto é feito <strong>manualmente pelo admin via PIX</strong>, fora do app.
              O valor sai do seu saldo agora e fica reservado até o pagamento ser confirmado.
              Se rejeitado, o saldo é devolvido.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!podeEnviar}>
            {mut.isPending ? "Enviando..." : "Solicitar acerto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
