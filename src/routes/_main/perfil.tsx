import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_main/perfil")({
  head: () => ({ meta: [{ title: "Perfil — Copa Bolão 2026" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const stats = [
    { label: "Apostas", value: "0" },
    { label: "Acertos", value: "0" },
    { label: "Pontos", value: "0" },
    { label: "Posição", value: "—" },
  ];
  return (
    <div>
      <PageHeader title="Meu Perfil" />
      <Card className="bg-card border-border rounded-xl shadow-card p-6 mb-6 flex items-center gap-4">
        <Avatar className="w-20 h-20 border-4 border-primary shadow-glow">
          <AvatarFallback className="bg-surface-elevated text-2xl font-bold">JD</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-display text-2xl tracking-wide">João da Silva</h2>
          <p className="text-muted-foreground text-sm">joao@email.com</p>
          <p className="text-gold text-sm font-semibold mt-1">Saldo: R$ 0,00</p>
        </div>
      </Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="bg-card border-border rounded-xl p-4 text-center">
            <div className="font-display text-3xl text-foreground">{s.value}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
          </Card>
        ))}
      </div>
      <h3 className="font-display text-2xl mb-3 tracking-wide">Histórico de apostas</h3>
      <Card className="bg-card border-border rounded-xl p-8 text-center text-muted-foreground">
        Você ainda não fez nenhuma aposta.
      </Card>
    </div>
  );
}
