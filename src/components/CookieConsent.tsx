import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const KEY = "lgpd_consent_v1";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (!stored) setShow(true);
    } catch {
      // ignore (SSR / private mode)
    }
  }, []);

  function decide(accepted: boolean) {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ accepted, at: new Date().toISOString() }),
      );
    } catch {
      // ignore
    }
    setShow(false);
    if (accepted) {
      // Disparar evento global para integrar GA4 quando configurado
      window.dispatchEvent(new CustomEvent("lgpd:consent", { detail: { accepted } }));
    }
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-2 bottom-2 sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-sm z-50 rounded-2xl border border-border bg-card shadow-2xl p-4 lg:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Cookie className="w-5 h-5 text-primary" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Cookies & privacidade</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Usamos cookies essenciais para o funcionamento do app e, com seu
            consentimento, cookies analíticos para entender como melhorar.
            Conforme a LGPD, você decide.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => decide(true)} className="flex-1">
              Aceitar todos
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide(false)} className="flex-1">
              Só essenciais
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}