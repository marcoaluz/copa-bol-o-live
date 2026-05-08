import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LegalModal } from "@/components/LegalModal";
import { lovable } from "@/integrations/lovable";
import { useAuth, isOnboarded } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Copa Bolão 2026" },
      { name: "description", content: "Faça login no Copa Bolão 2026 e participe do maior bolão da Copa." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (user.user_metadata?.bloqueado_menor_idade) return;
    navigate({ to: isOnboarded(profile) ? "/home" : "/onboarding" });
  }, [user, profile, loading, navigate]);

  const handleGoogle = async () => {
    setSigning(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar. Tente novamente.");
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-pitch relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-gold blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-6">
          <Trophy className="w-10 h-10 text-primary-foreground" />
        </div>
        <h1 className="font-display text-5xl tracking-wider text-foreground">COPA BOLÃO</h1>
        <p className="font-display text-2xl tracking-[0.4em] text-gold mb-3">2026</p>
        <p className="text-xl text-foreground/90 font-semibold mb-2">O bolão oficial da sua torcida</p>
        <p className="text-muted-foreground mb-10">
          Aposte com seus amigos. Acompanhe cada lance. Levante a taça.
        </p>

        <Button
          onClick={handleGoogle}
          disabled={signing}
          size="lg"
          className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl h-12 font-semibold"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {signing ? "Entrando..." : "Entrar com Google"}
        </Button>

        <p className="mt-10 text-xs text-muted-foreground">
          Ao continuar você concorda com nossos{" "}
          <LegalModal
            title="Termos de Uso"
            src="/legal/termos.md"
            trigger={<button className="underline text-foreground/80 hover:text-gold">Termos de Uso</button>}
          />{" "}
          e{" "}
          <LegalModal
            title="Política de Privacidade"
            src="/legal/termos.md"
            trigger={<button className="underline text-foreground/80 hover:text-gold">Política de Privacidade</button>}
          />
          .
        </p>

        <p className="mt-6 text-[11px] text-muted-foreground/70 uppercase tracking-[0.2em]">
          Bolão privado — acesso somente por convite
        </p>
      </div>
    </div>
  );
}