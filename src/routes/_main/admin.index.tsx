import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Shield, Users, Trophy, Settings, Banknote } from "lucide-react";

export const Route = createFileRoute("/_main/admin/")({
  head: () => ({ meta: [{ title: "Admin — Copa Bolão 2026" }] }),
  component: AdminPage,
});

const tiles = [
  { icon: Trophy, label: "Partidas", desc: "Lançar resultados, apurar e distribuir prêmios", to: "/admin/partidas" as const },
  { icon: Banknote, label: "Saques", desc: "Aprovar/rejeitar acertos via PIX", to: "/admin/saques" as const },
  { icon: Users, label: "Usuários", desc: "Lista de jogadores", to: null },
  { icon: Shield, label: "Permissões", desc: "Controle de acesso", to: null },
  { icon: Settings, label: "Configurações", desc: "Ajustes do bolão", to: null },
];

function AdminPage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 text-gold" />
        <span className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Acesso restrito</span>
      </div>
      <PageHeader title="Painel Admin" subtitle="Gestão completa do Copa Bolão 2026" />
      <div className="grid sm:grid-cols-2 gap-4">
        {tiles.map((t) => (
          t.to ? (
            <Link key={t.label} to={t.to}>
              <Card className="bg-card border-border rounded-xl p-5 shadow-card hover:border-gold/50 transition-colors cursor-pointer h-full">
                <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center mb-3"><t.icon className="w-5 h-5 text-gold" /></div>
                <h3 className="font-semibold mb-1">{t.label}</h3>
                <p className="text-sm text-muted-foreground">{t.desc}</p>
              </Card>
            </Link>
          ) : (
            <Card key={t.label} className="bg-card border-border rounded-xl p-5 shadow-card opacity-60">
              <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center mb-3"><t.icon className="w-5 h-5 text-gold" /></div>
              <h3 className="font-semibold mb-1">{t.label}</h3>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </Card>
          )
        ))}
      </div>
    </div>
  );
}
