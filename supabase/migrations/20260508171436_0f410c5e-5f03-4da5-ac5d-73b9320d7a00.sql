CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.suporte_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email_contato TEXT NOT NULL,
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','respondido','fechado')),
  resposta_admin TEXT,
  respondido_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_suporte_status ON public.suporte_mensagens(status);
CREATE INDEX idx_suporte_usuario ON public.suporte_mensagens(usuario_id);
ALTER TABLE public.suporte_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own support" ON public.suporte_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() OR usuario_id IS NULL);
CREATE POLICY "users read own support" ON public.suporte_mensagens
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());
CREATE POLICY "admins all support" ON public.suporte_mensagens
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE TRIGGER update_suporte_updated_at
BEFORE UPDATE ON public.suporte_mensagens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.checklist_lancamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  ordem INT NOT NULL DEFAULT 0,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  concluido_em TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_categoria ON public.checklist_lancamento(categoria, ordem);
ALTER TABLE public.checklist_lancamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage checklist" ON public.checklist_lancamento
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
CREATE TRIGGER update_checklist_updated_at
BEFORE UPDATE ON public.checklist_lancamento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.checklist_lancamento (categoria, titulo, descricao, ordem) VALUES
('Jurídico', 'Termos de uso revisados por advogado', 'Validar conformidade com art. 51 LCP', 10),
('Jurídico', 'Política de privacidade LGPD', 'Finalidades, base legal e retenção', 20),
('Jurídico', 'Aviso: app não é casa de apostas regulada', 'Banner no rodapé e home', 30),
('Jurídico', 'Disclaimer sobre PIX manual', 'Transferências entre pessoas físicas', 40),
('Testes', 'Cadastro + login testado', 'Email, Google, recuperação', 110),
('Testes', 'Fluxo aposta → resultado → premiação', 'Validar taxa e distribuição', 120),
('Testes', 'Fluxo de saque completo', 'Aprovação e rejeição com devolução', 130),
('Testes', 'Bloqueio de usuário', 'Bloqueado não aposta nem saca', 140),
('Testes', 'Modo manutenção', 'Banner e bloqueios ativos', 150),
('Conteúdo', 'FAQ com 10+ perguntas', 'Cobrir todas as áreas', 210),
('Conteúdo', 'Imagem Open Graph 1200x630', 'Para compartilhamento social', 220),
('Conteúdo', 'Ícones PWA todos os tamanhos', '192, 512, maskable', 230),
('Conteúdo', 'Texto de boas-vindas', 'Tom claro, sem promessa de lucro', 240),
('Infra', 'Backup automático do banco', 'Política de retenção definida', 310),
('Infra', 'Domínio customizado', 'DNS e SSL válidos', 320),
('Infra', 'Sentry configurado', 'DSN no secret e captura ativa', 330),
('Infra', 'Analytics com consentimento LGPD', 'Banner de cookies funcional', 340),
('Infra', 'Rate limiting endpoints sensíveis', 'Login, saque, aposta', 350),
('Suporte', 'Email de contato monitorado', 'Caixa ativa com notificações', 410),
('Suporte', 'SLA de 48h documentado', 'Visível ao usuário', 420),
('Suporte', 'Canal alternativo opcional', 'WhatsApp/Telegram para emergências', 430),
('Lançamento', 'Teste piloto 10-20 usuários', 'Feedback antes do público geral', 510),
('Lançamento', 'Plano de comunicação', 'Como divulgar na cidade', 520),
('Lançamento', 'Saldo inicial em conta', 'Caixa para honrar premiações', 530),
('Lançamento', 'Plano de contingência', 'Como pausar e comunicar', 540);