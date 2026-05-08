import type { Selecao } from "@/lib/tournament";

export function TeamLabel({
  selecao,
  placeholder,
  size = "md",
  align = "left",
}: {
  selecao?: Selecao | null;
  placeholder?: string | null;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
}) {
  const sz = size === "sm" ? "w-5 h-5" : size === "lg" ? "w-10 h-10" : "w-7 h-7";
  const text = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const isPlaceholder = !selecao;

  return (
    <div
      className={`flex items-center gap-2 min-w-0 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      {selecao?.bandeira_url ? (
        <img
          src={selecao.bandeira_url}
          alt={selecao.nome}
          className={`${sz} rounded-sm object-cover ring-1 ring-border shrink-0`}
          loading="lazy"
        />
      ) : (
        <div className={`${sz} rounded-sm bg-surface-elevated border border-dashed border-border shrink-0`} />
      )}
      <span
        className={`${text} font-semibold truncate ${
          isPlaceholder ? "text-muted-foreground italic font-normal" : "text-foreground"
        }`}
      >
        {selecao?.nome ?? placeholder ?? "—"}
      </span>
    </div>
  );
}