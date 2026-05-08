import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { OnboardingTour } from "@/components/OnboardingTour";
import { useEffect } from "react";
import { ensureI18n } from "@/lib/i18n";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl tracking-wider text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço que você acessou não existe ou foi movido.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar para a Home
          </Link>
          <Link
            to="/ajuda"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Falar com suporte
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl tracking-wider text-destructive">500</h1>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Tente novamente, volte para a home ou nos avise.
        </p>
        {error?.message && (
          <p className="mt-2 text-xs text-muted-foreground/70 font-mono">{error.message}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar para a Home
          </a>
          <a
            href={`mailto:suporte@copabolao.app?subject=Erro%20no%20app&body=${encodeURIComponent(error?.message ?? "")}`}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Reportar
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Copa Bolão 2026" },
      { name: "description", content: "Bolão entre amigos da Copa 2026 — apostas, ranking e premiação via PIX manual." },
      { name: "theme-color", content: "#0F172A" },
      { name: "application-name", content: "Copa Bolão 2026" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Copa Bolão" },
      { property: "og:site_name", content: "Copa Bolão 2026" },
      { property: "og:title", content: "Copa Bolão 2026" },
      { property: "og:description", content: "Bolão entre amigos da Copa 2026 — apostas, ranking e premiação via PIX manual." },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Copa Bolão 2026" },
      { name: "twitter:description", content: "Bolão entre amigos da Copa 2026 — apostas, ranking e premiação via PIX manual." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    ensureI18n();

    // Service Worker — só fora do preview do Lovable e fora de iframe
    if (typeof window === "undefined") return;
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const previewHost =
      window.location.hostname.includes("lovableproject.com") ||
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovable.app");

    if (inIframe || previewHost) {
      // Limpa SW que possam ter ficado registrados em ambiente de preview
      navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
        <CookieConsent />
        <OnboardingTour />
      </AuthProvider>
    </QueryClientProvider>
  );
}
