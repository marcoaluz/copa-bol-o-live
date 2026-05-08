import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { LifeBuoy, Mail } from "lucide-react";

export const Route = createFileRoute("/_main/ajuda")({
  head: () => ({
    meta: [
      { title: "Ajuda — Copa Bolão 2026" },
      { name: "description", content: "Perguntas frequentes e contato com o suporte do Copa Bolão 2026." },
      { property: "og:title", content: "Central de ajuda — Copa Bolão 2026" },
      { property: "og:description", content: "FAQ e suporte para apostas, saques e cadastro." },
    ],
  }),
  component: AjudaPage,
});

const FAQ = [
  { q: "Como funciona o bolão?", a: "Você aposta nos placares das partidas com saldo da sua carteira. Acertos somam pontos no ranking e dividem o bolo da partida proporcionalmente." },
  { q: "Como deposito dinheiro?", a: "Vá em Carteira → Depositar. Faça um PIX para a chave indicada e envie o comprovante. O admin libera o saldo após confirmar." },
  { q: "Como saco meu saldo?", a: "Em Carteira → Sacar via PIX, informe sua chave PIX e o valor. O admin processa manualmente em até 48h." },
  { q: "Qual o saque mínimo?", a: "R$ 20,00 por solicitação. Apenas 1 saque pendente por vez." },
  { q: "Tem taxa para apostar?", a: "Sim, há uma taxa da casa configurada pelo admin (até 20%) que é descontada do bolo total antes da divisão entre os ganhadores." },
  { q: "Posso alterar uma aposta?", a: "Sim, até o início da partida. Depois disso a aposta fica trancada." },
  { q: "E se ninguém acertar?", a: "Conforme a configuração, o bolo pode rolar para a próxima partida ou ser devolvido proporcionalmente." },
  { q: "Meus dados estão seguros?", a: "Usamos autenticação criptografada e seguimos a LGPD. Sua chave PIX só é vista por você e pelo admin que processa o saque." },
  { q: "Esqueci minha senha", a: "Na tela de login, clique em 'Esqueci minha senha' e siga as instruções enviadas por e-mail." },
  { q: "Posso jogar pelo celular?", a: "Sim, o app é responsivo e pode ser instalado na tela inicial (PWA)." },
  { q: "Esse app é uma casa de apostas regulada?", a: "Não. É um bolão entre amigos, sem fim lucrativo da plataforma. Os acertos via PIX são feitos manualmente, no formato 'acerto entre amigos' previsto no art. 51 da Lei das Contravenções Penais." },
  { q: "Como reporto um problema?", a: "Use o formulário abaixo. Respondemos em até 48h úteis." },
];

function AjudaPage() {
  const { user, profile } = useAuth();
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("suporte_mensagens").insert({
        usuario_id: user?.id ?? null,
        email_contato: email,
        assunto,
        mensagem,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mensagem enviada! Vamos responder em breve.");
      setAssunto(""); setMensagem("");
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao enviar"),
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Central de Ajuda" subtitle="Perguntas frequentes e contato" />

      <Card className="p-5 lg:p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-primary" aria-hidden="true" /> Perguntas frequentes
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ.map((f, i) => (
            <AccordionItem key={i} value={`q${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Card>

      <Card className="p-5 lg:p-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" aria-hidden="true" /> Fale com o suporte
        </h2>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (assunto && mensagem && email) enviar.mutate(); }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail para contato</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="assunto">Assunto</Label>
            <Input id="assunto" required maxLength={120} value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="msg">Mensagem</Label>
            <Textarea id="msg" required rows={5} maxLength={2000} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </div>
          <Button type="submit" disabled={enviar.isPending}>
            {enviar.isPending ? "Enviando…" : "Enviar mensagem"}
          </Button>
          {profile && (
            <p className="text-xs text-muted-foreground">
              Você está logado como <span className="text-foreground">{profile.nome_completo ?? user?.email}</span>.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
