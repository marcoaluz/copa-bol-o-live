import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Redefinir senha — Copa Bolão 2026" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase processa o hash automaticamente e dispara PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setPronto(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPronto(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const salvar = async () => {
    if (senha.length < 6) return toast.error("Senha mínima de 6 caracteres");
    if (senha !== confirma) return toast.error("As senhas não conferem");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("Senha atualizada! Redirecionando…");
    setTimeout(() => navigate({ to: "/home" }), 800);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-pitch">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
          <Trophy className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-3xl tracking-wider text-foreground mb-2">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground mb-6">Defina uma nova senha para sua conta.</p>

        {!pronto ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Validando link…
          </div>
        ) : (
          <div className="w-full space-y-3 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="np">Nova senha</Label>
              <Input id="np" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np2">Confirmar nova senha</Label>
              <Input id="np2" type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" onKeyDown={(e) => e.key === "Enter" && salvar()} />
            </div>
            <Button onClick={salvar} disabled={loading} className="w-full h-11">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar nova senha
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}