import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X, Share, Trophy } from "lucide-react";

const STORAGE_KEY = "pwa-banner-dismissed-until";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detecta iOS
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(ios);

    // Já instalado?
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // Dispensado recentemente?
    const dismissedUntil = localStorage.getItem(STORAGE_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) return;

    // Não mostrar dentro de iframe (preview do Lovable)
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    // Só em mobile
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Android: aguarda evento beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 5000);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // iOS: mostra após 5s sem evento
    let timer: number | undefined;
    if (ios) {
      timer = window.setTimeout(() => setShow(true), 5000);
    }

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 inset-x-3 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="bg-card border-primary/40 shadow-glow p-3 max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Instale o app no seu celular
            </p>
            {isIOS ? (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                Toque em <Share className="inline w-3 h-3 mx-0.5" /> compartilhar e escolha
                <span className="font-medium text-foreground"> "Adicionar à Tela de Início"</span>.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                Tenha o Bolão sempre à mão, com tela cheia e abertura rápida.
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              {!isIOS && deferredPrompt && (
                <Button size="sm" onClick={handleInstall} className="h-8">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Instalar
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8 text-xs">
                Agora não
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1 -mt-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </Card>
    </div>
  );
}