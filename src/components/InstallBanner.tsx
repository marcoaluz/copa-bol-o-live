import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Download, X, Share2, PlusSquare, Check, ChevronDown } from "lucide-react";

const STORAGE_KEY = "install_banner_dismissed";
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < COOLDOWN_MS) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isMobile = ios || /Android|Mobi/i.test(ua);
    if (!isMobile) return;

    setIsIOS(ios);

    if (ios) {
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    const installedHandler = () => {
      setShow(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setShow(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShow(false);
  };

  if (!show) return null;

  return (
    <>
      <div className="bg-gradient-primary/10 border-b border-primary/20 h-12 px-4 flex items-center gap-2 text-xs sm:text-sm">
        <span className="text-foreground/90 truncate flex-1">
          📱 Instale o Copa Bolão na tela inicial
        </span>
        {isIOS ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs shrink-0"
            onClick={() => setDialogOpen(true)}
            aria-label="Como instalar no iPhone"
          >
            Como instalar
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={handleInstall}
            aria-label="Instalar agora"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Instalar agora
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar"
          className="text-muted-foreground hover:text-foreground p-1 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wider">Instalar no iPhone</DialogTitle>
            <DialogDescription>3 passos rápidos no Safari</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 mt-2">
            {[
              { n: 1, icon: Share2, text: <>Toque em <strong className="text-foreground">Compartilhar</strong> na barra inferior</> },
              { n: 2, icon: PlusSquare, text: <>Role e toque em <strong className="text-foreground">Adicionar à Tela de Início</strong></> },
              { n: 3, icon: Check, text: <>Toque em <strong className="text-foreground">Adicionar</strong> no canto superior</> },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  {s.n}
                </div>
                <s.icon className="w-5 h-5 text-gold shrink-0" />
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
            <div className="flex flex-col items-center text-muted-foreground/80 mt-2">
              <ChevronDown className="w-5 h-5 animate-bounce text-primary" />
              <p className="text-xs">O botão Compartilhar fica no rodapé do Safari</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
