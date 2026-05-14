import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { Trophy, Download, LogIn, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LegalModal } from "@/components/LegalModal";
import { InstallCTA } from "@/components/InstallCTA";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";

const searchSchema = z.object({
  de: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Copa Bolão 2026 — Você foi convidado" },
      {
        name: "description",
        content: "Bolão privado entre amigos para a Copa 2026. Instale o app, entre com Google e aposte com a galera.",
      },
      { property: "og:title", content: "Copa Bolão 2026 — Você foi convidado" },
      { property: "og:description", content: "Vem participar do bolão oficial da sua torcida." },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const { de } = useSearch({ from: "/" });
  const { user, loading } = useAuth();
  const convidante = de?.trim();

  return (
    <div className="min-h-screen bg-gradient-pitch relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-gold blur-3xl" />
      </div>

      <div className="relative max-w-2xl mx-auto px-5 py-10 sm:py-14 flex flex-col gap-8">
        {/* Hero */}
        <header className="text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow mb-4">
            <Trophy className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground">COPA BOLÃO</h1>
          <p className="font-display text-xl tracking-[0.4em] text-gold mb-4">2026</p>
          {convidante ? (
            <p className="text-base sm:text-lg text-foreground max-w-md">
              <strong className="text-gold">{convidante}</strong> te chamou para o Copa Bolão 2026
            </p>
          ) : (
            <p className="text-base sm:text-lg text-muted-foreground max-w-md">
              Você foi convidado para o bolão oficial da sua torcida
            </p>
          )}

          {!loading && user && (
            <Button asChild variant="ghost" size="sm" className="mt-4 text-muted-foreground hover:text-foreground">
              <Link to="/home" aria-label="Continuar para o app">
                Continuar para o app <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          )}
        </header>

        {/* Install CTA */}
        <section aria-labelledby="install-heading">
          <h2 id="install-heading" className="sr-only">Instalar o app</h2>
          <InstallCTA />
        </section>

        {/* Como funciona */}
        <section aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="font-display text-xl tracking-wider text-foreground text-center mb-4">
            COMO FUNCIONA
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: Download, n: 1, title: "Instale o app", desc: "Adicione à tela inicial do seu celular." },
              { icon: LogIn, n: 2, title: "Entre com Google", desc: "Login rápido em 1 toque, seguro." },
              { icon: Trophy, n: 3, title: "Aposte com seus amigos", desc: "Palpites, ranking e prêmios via PIX." },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-border bg-card/60 p-4 flex md:flex-col gap-3 md:gap-2 items-start md:items-center md:text-center">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    <span className="text-gold mr-1">{s.n}.</span>{s.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alternativa navegador */}
        <section className="text-center">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px bg-border flex-1" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">ou</span>
            <div className="h-px bg-border flex-1" />
          </div>
          <Button asChild variant="outline" size="lg" className="h-12">
            <Link to="/login" aria-label="Acessar pelo navegador">
              Acessar pelo navegador
            </Link>
          </Button>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-muted-foreground pt-4 border-t border-border/50">
          <p>
            Bolão privado · sem fim lucrativo · 100% redistribuído
          </p>
          <p className="mt-2 space-x-3">
            <LegalModal
              title="Termos de Uso"
              src="/legal/termos.md"
              trigger={<button type="button" className="underline hover:text-foreground">Termos de Uso</button>}
            />
            <span>·</span>
            <LegalModal
              title="Política de Privacidade"
              src="/legal/termos.md"
              trigger={<button type="button" className="underline hover:text-foreground">Política de Privacidade</button>}
            />
          </p>
        </footer>
      </div>
    </div>
  );
}
