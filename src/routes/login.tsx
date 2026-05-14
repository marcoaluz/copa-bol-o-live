import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Trophy, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LegalModal } from "@/components/LegalModal";
import { supabase } from "@/integrations/supabase/client";
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
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    if (user.user_metadata?.bloqueado_menor_idade) return;
    navigate({ to: isOnboarded(profile) ? "/home" : "/onboarding" });
  }, [user, profile, loading, navigate]);

  const handleGoogle = async () => {
    setSigning(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/onboarding`,
    });
    if (result.error) {
      toast.error("Não foi possível entrar. Tente novamente.");
      setSigning(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/onboarding" });
  };

  const entrarComSenha = async () => {
    if (!email.trim() || !senha) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    setSigning(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("E-mail ou senha incorretos");
      } else {
        toast.error(error.message);
      }
      setSigning(false);
    }
  };

  const criarConta = async () => {
    if (!email.trim() || !senha) {
      toast.error("Preencha e-mail e senha");
      return;
    }
    if (senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (senha !== confirmaSenha) {
      toast.error("As senhas não conferem");
      return;
    }
    setSigning(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    });
    if (error) {
      if (error.message.toLowerCase().includes("não está autorizado") || error.message.toLowerCase().includes("not authorized")) {
        toast.error(error.message, { duration: 8000 });
      } else if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("user already")) {
        toast.error("Este e-mail já tem cadastro. Tente entrar em vez de criar conta.");
      } else {
        toast.error(error.message);
      }
      setSigning(false);
      return;
    }
    toast.success("Conta criada! Bem-vindo ao bolão.");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-gradient-pitch relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-gold blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
          <Trophy className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-4xl tracking-wider text-foreground">COPA BOLÃO</h1>
        <p className="font-display text-xl tracking-[0.4em] text-gold mb-2">2026</p>
        <p className="text-sm text-muted-foreground mb-6">Bolão privado entre amigos</p>

        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a tela de boas-vindas
        </Link>

        <Button
          onClick={handleGoogle}
          disabled={signing}
          size="lg"
          className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-xl h-12 font-semibold"
        >
          {signing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : (
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Entrar com Google
        </Button>

        <div className="flex items-center gap-3 my-5 w-full">
          <div className="h-px bg-border flex-1" />
          <span className="text-xs text-muted-foreground uppercase tracking-wider">ou use seu e-mail</span>
          <div className="h-px bg-border flex-1" />
        </div>

        <Tabs value={modo} onValueChange={(v) => setModo(v as "entrar" | "criar")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entrar">Entrar</TabsTrigger>
            <TabsTrigger value="criar">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="entrar" className="space-y-3 mt-4 text-left">
            <div className="space-y-1.5">
              <Label htmlFor="email-in">E-mail</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="email-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu-email@exemplo.com" className="pl-9" autoComplete="email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha-in">Senha</Label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="senha-in" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha" className="pl-9" autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && entrarComSenha()} />
              </div>
            </div>
            <Button onClick={entrarComSenha} disabled={signing} className="w-full h-11">
              {signing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Entrar
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Esqueceu a senha? Peça ao organizador para resetar.
            </p>
          </TabsContent>

          <TabsContent value="criar" className="space-y-3 mt-4 text-left">
            <div className="rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-foreground/80">
              ⚠ Você precisa estar na lista de convidados. Caso contrário, o cadastro será bloqueado. Peça acesso ao organizador.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-cr">E-mail</Label>
              <Input id="email-cr" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@exemplo.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha-cr">Senha</Label>
              <Input id="senha-cr" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="senha-cr2">Confirmar senha</Label>
              <Input id="senha-cr2" type="password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)}
                placeholder="Digite a senha novamente" autoComplete="new-password"
                onKeyDown={(e) => e.key === "Enter" && criarConta()} />
            </div>
            <Button onClick={criarConta} disabled={signing} className="w-full h-11">
              {signing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar conta
            </Button>
          </TabsContent>
        </Tabs>

        <p className="mt-8 text-xs text-muted-foreground">
          Ao continuar você concorda com nossos{" "}
          <LegalModal title="Termos de Uso" src="/legal/termos.md"
            trigger={<button className="underline text-foreground/80 hover:text-gold">Termos de Uso</button>} />
          {" "}e{" "}
          <LegalModal title="Política de Privacidade" src="/legal/termos.md"
            trigger={<button className="underline text-foreground/80 hover:text-gold">Política de Privacidade</button>} />.
        </p>

        <p className="mt-4 text-[11px] text-muted-foreground/70 uppercase tracking-[0.2em]">
          Bolão privado · acesso somente por convite
        </p>
      </div>
    </div>
  );
}
