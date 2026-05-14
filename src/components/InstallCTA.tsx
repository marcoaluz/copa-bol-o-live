import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Download,
  Share2,
  PlusSquare,
  Check,
  ChevronDown,
  Smartphone,
  Monitor,
  Copy,
  AlertTriangle,
  LogIn,
} from "lucide-react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Platform = "loading" | "installed" | "ios-safari" | "ios-inapp" | "android" | "android-fallback" | "desktop";

function detectInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|Instagram|Line|MicroMessenger|FB_IAB|Twitter|TikTok/i.test(ua);
}

export function InstallCTA() {
  const [platform, setPlatform] = useState<Platform>("loading");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIOS || isAndroid || /Mobi/i.test(ua);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setPlatform("installed");
      return;
    }

    if (isIOS) {
      setPlatform(detectInAppBrowser(ua) || !/Safari/i.test(ua) ? "ios-inapp" : "ios-safari");
      return;
    }

    if (!isMobile) {
      setPlatform("desktop");
      return;
    }

    // Android: aguardar beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform("android");
    };
    const installedHandler = () => {
      setPlatform("installed");
      setDeferredPrompt(null);
      toast.success("App instalado! Bem-vindo ao Copa Bolão.");
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    const fallbackTimer = window.setTimeout(() => {
      setPlatform((prev) => (prev === "loading" ? "android-fallback" : prev));
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado! Cole no Safari para instalar.");
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente da barra de endereço.");
    }
  };

  if (platform === "loading") {
    return (
      <Card className="bg-card border-primary/30 p-8 text-center">
        <div className="h-14 animate-pulse bg-muted/30 rounded-xl" />
      </Card>
    );
  }

  if (platform === "installed") {
    return (
      <Card className="bg-card border-primary/40 shadow-glow p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto mb-3">
          <Check className="w-7 h-7" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-foreground mb-1">App instalado!</h3>
        <p className="text-sm text-muted-foreground mb-5">Você já está no Copa Bolão.</p>
        <Button asChild size="lg" className="w-full h-14 text-base">
          <Link to="/home" aria-label="Entrar no app">
            <LogIn className="w-5 h-5 mr-2" /> Entrar no app
          </Link>
        </Button>
      </Card>
    );
  }

  if (platform === "ios-inapp") {
    return (
      <Card className="bg-card border-gold/40 shadow-glow p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display text-xl tracking-wide text-foreground">Abra no Safari</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Para instalar o app no iPhone, este link precisa ser aberto no Safari (não no Instagram, WhatsApp ou Facebook).
            </p>
          </div>
        </div>
        <Button onClick={copyLink} size="lg" className="w-full h-14 text-base" aria-label="Copiar link para abrir no Safari">
          <Copy className="w-5 h-5 mr-2" /> Copiar link
        </Button>
      </Card>
    );
  }

  if (platform === "ios-safari") {
    return (
      <Card className="bg-card border-primary/40 shadow-glow p-6">
        <h3 className="font-display text-2xl tracking-wider text-foreground text-center mb-1">Instalar no iPhone</h3>
        <p className="text-sm text-muted-foreground text-center mb-6">3 passos rápidos no Safari</p>

        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          {[
            { n: 1, icon: Share2, text: <>Toque em <strong className="text-foreground">Compartilhar</strong> na barra inferior</> },
            { n: 2, icon: PlusSquare, text: <>Role e toque em <strong className="text-foreground">Adicionar à Tela de Início</strong></> },
            { n: 3, icon: Check, text: <>Toque em <strong className="text-foreground">Adicionar</strong> no canto superior</> },
          ].map((s) => (
            <div key={s.n} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
              <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                {s.n}
              </div>
              <s.icon className="w-6 h-6 text-gold hidden sm:block" />
              <p className="text-sm text-muted-foreground sm:px-1">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center text-muted-foreground/80 mt-4">
          <ChevronDown className="w-6 h-6 animate-bounce text-primary" />
          <p className="text-xs">O botão Compartilhar fica no rodapé do Safari</p>
        </div>
      </Card>
    );
  }

  if (platform === "android") {
    return (
      <Card className="bg-card border-primary/40 shadow-glow p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-3 shadow-glow">
          <Smartphone className="w-7 h-7 text-primary-foreground" />
        </div>
        <h3 className="font-display text-2xl tracking-wider text-foreground mb-1">Instalar no celular</h3>
        <p className="text-sm text-muted-foreground mb-5">Tela cheia, ícone na home, sem barra do navegador.</p>
        <Button
          onClick={handleInstall}
          disabled={installing}
          size="lg"
          className="w-full h-14 text-base"
          aria-label="Instalar app no celular"
        >
          <Download className="w-5 h-5 mr-2" />
          {installing ? "Instalando..." : "Instalar app no celular"}
        </Button>
      </Card>
    );
  }

  if (platform === "android-fallback") {
    return (
      <Card className="bg-card border-primary/40 shadow-glow p-6">
        <h3 className="font-display text-2xl tracking-wider text-foreground text-center mb-1">Adicionar à tela inicial</h3>
        <p className="text-sm text-muted-foreground text-center mb-5">
          No menu do navegador (⋮ três pontinhos no canto superior), toque em{" "}
          <strong className="text-foreground">"Instalar app"</strong> ou{" "}
          <strong className="text-foreground">"Adicionar à tela inicial"</strong>.
        </p>
        <Button asChild variant="outline" size="lg" className="w-full h-14 text-base">
          <Link to="/login"><LogIn className="w-5 h-5 mr-2" /> Continuar pelo navegador</Link>
        </Button>
      </Card>
    );
  }

  // desktop
  return (
    <Card className="bg-card border-border p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center mx-auto mb-3">
        <Monitor className="w-7 h-7" />
      </div>
      <h3 className="font-display text-2xl tracking-wider text-foreground mb-1">Você está no computador</h3>
      <p className="text-sm text-muted-foreground mb-5">
        Para a melhor experiência, abra este link no celular e instale como app.
      </p>
      <Button asChild size="lg" className="w-full h-14 text-base">
        <Link to="/login"><LogIn className="w-5 h-5 mr-2" /> Entrar pelo navegador</Link>
      </Button>
    </Card>
  );
}
