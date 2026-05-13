import { ChevronDown } from "lucide-react";
import { useTorneios, useTorneioStore } from "@/lib/torneio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TorneioSelector() {
  const { data: torneios } = useTorneios();
  const slug = useTorneioStore((s) => s.torneioAtivoSlug);
  const setSlug = useTorneioStore((s) => s.setTorneioAtivo);
  const ativo = torneios?.find((t) => t.slug === slug) ?? torneios?.[0];

  if (!torneios || torneios.length < 2) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border hover:border-primary/50 transition-colors">
        <span className="text-base leading-none">{ativo?.emoji ?? "🏆"}</span>
        <span className="text-sm font-semibold hidden sm:inline">{ativo?.nome_curto ?? "Torneio"}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px] bg-card border-border">
        {torneios.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setSlug(t.slug)}
            className={`cursor-pointer ${t.slug === (ativo?.slug ?? slug) ? "bg-primary/10 text-primary" : ""}`}
          >
            <span className="mr-2 text-base">{t.emoji}</span>
            <span className="text-sm">{t.nome}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}