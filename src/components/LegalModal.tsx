import { useEffect, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function LegalModal({
  trigger,
  title,
  src,
}: {
  trigger: ReactNode;
  title: string;
  src: string;
}) {
  const [content, setContent] = useState<string>("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !content) {
      fetch(src)
        .then((r) => r.text())
        .then(setContent)
        .catch(() => setContent("Não foi possível carregar o documento."));
    }
  }, [open, content, src]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wider">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="prose prose-invert prose-sm max-w-none text-foreground/90 [&_h1]:font-display [&_h1]:tracking-wider [&_h2]:text-gold [&_h2]:font-semibold [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-1 [&_a]:text-primary-glow">
            <ReactMarkdown>{content || "Carregando…"}</ReactMarkdown>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}