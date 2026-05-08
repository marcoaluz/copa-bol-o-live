import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LegalModal } from "@/components/LegalModal";
import { useAuth, isOnboarded } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { maskCpf, isValidCpf, calcAge } from "@/lib/cpf";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Cadastro — Copa Bolão 2026" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const [dataNasc, setDataNasc] = useState("");
  const [cpf, setCpf] = useState("");
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [aceitouRisco, setAceitouRisco] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [erroIdade, setErroIdade] = useState(false);
  const [naoAutorizado, setNaoAutorizado] = useState(false);
  const [verificandoAcesso, setVerificandoAcesso] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (isOnboarded(profile)) navigate({ to: "/home" });
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    if (loading || !user) return;
    let cancel = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("email_esta_autorizado");
      if (cancel) return;
      if (error || !data) {
        setNaoAutorizado(true);
        await supabase.auth.signOut();
      } else {
        await (supabase as any).rpc("marcar_convite_aceito");
      }
      setVerificandoAcesso(false);
    })();
    return () => { cancel = true; };
  }, [user, loading]);

  const podeEnviar =
    aceitouTermos &&
    aceitouRisco &&
    dataNasc.length === 10 &&
    isValidCpf(cpf) &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido. Confira os dígitos.");
      return;
    }
    const idade = calcAge(dataNasc);
    if (idade < 18) {
      setErroIdade(true);
      await supabase.auth.updateUser({ data: { bloqueado_menor_idade: true } });
      await signOut();
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        data_nascimento: dataNasc,
        cpf: cpf.replace(/\D/g, ""),
        aceitou_termos_em: now,
        aceitou_risco_em: now,
      })
      .eq("id", user.id);

    if (error) {
      setSubmitting(false);
      if (error.code === "23505") toast.error("Este CPF já está cadastrado.");
      else toast.error("Erro ao salvar cadastro: " + error.message);
      return;
    }

    await refreshProfile();
    toast.success("Cadastro concluído! Bem-vindo ao bolão.");
    navigate({ to: "/home" });
  };

  if (erroIdade) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-pitch">
        <div className="max-w-md text-center bg-card border border-destructive/40 rounded-2xl p-8">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="font-display text-3xl tracking-wider mb-2">Cadastro bloqueado</h1>
          <p className="text-muted-foreground mb-6">
            É necessário ter 18 anos completos para participar do Copa Bolão 2026.
            Sua sessão foi encerrada e este acesso ficou registrado como menor de idade.
          </p>
          <Button onClick={() => navigate({ to: "/login" })} variant="outline">Voltar ao login</Button>
        </div>
      </div>
    );
  }

  if (naoAutorizado) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-pitch">
        <div className="max-w-md text-center bg-card border border-gold/40 rounded-2xl p-8">
          <Lock className="w-12 h-12 text-gold mx-auto mb-4" />
          <h1 className="font-display text-3xl tracking-wider mb-2">Acesso restrito</h1>
          <p className="text-muted-foreground mb-6">
            Este é um bolão privado entre amigos. Peça um convite ao organizador
            para acessar.
          </p>
          <Button onClick={() => navigate({ to: "/login" })} variant="outline">Voltar ao login</Button>
        </div>
      </div>
    );
  }

  if (verificandoAcesso) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-pitch">
        <Trophy className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-gradient-pitch">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Trophy className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl tracking-wider leading-none">Quase lá!</h1>
            <p className="text-sm text-muted-foreground">Complete seu cadastro para começar a apostar.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-5 shadow-card">
          {profile?.nome_completo && (
            <div className="text-sm text-muted-foreground">
              Olá, <span className="text-foreground font-semibold">{profile.nome_completo}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dob">Data de nascimento</Label>
            <Input
              id="dob"
              type="date"
              required
              max={new Date().toISOString().split("T")[0]}
              value={dataNasc}
              onChange={(e) => setDataNasc(e.target.value)}
              className="bg-surface border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              required
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              className="bg-surface border-border tabular-nums"
            />
            {cpf.length === 14 && !isValidCpf(cpf) && (
              <p className="text-xs text-destructive">CPF inválido</p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={aceitouTermos}
                onCheckedChange={(c) => setAceitouTermos(c === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                Li e aceito os{" "}
                <LegalModal
                  title="Termos de Uso"
                  src="/legal/termos.md"
                  trigger={<button type="button" className="underline text-foreground hover:text-gold">Termos de Uso</button>}
                />{" "}
                e a Política de Privacidade.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={aceitouRisco}
                onCheckedChange={(c) => setAceitouRisco(c === true)}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                Declaro estar ciente de que apostas envolvem{" "}
                <LegalModal
                  title="Termo de Ciência de Risco"
                  src="/legal/risco.md"
                  trigger={<button type="button" className="underline text-foreground hover:text-gold">risco de perda total</button>}
                />{" "}
                e que não há garantia de ganho. Sou maior de 18 anos.
              </span>
            </label>
          </div>

          <Button
            type="submit"
            disabled={!podeEnviar}
            className="w-full h-12 rounded-xl bg-gradient-primary shadow-glow font-semibold"
          >
            {submitting ? "Enviando..." : "Confirmar cadastro"}
          </Button>
        </form>
      </div>
    </div>
  );
}