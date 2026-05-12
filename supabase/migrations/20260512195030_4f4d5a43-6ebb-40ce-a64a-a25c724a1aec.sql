ALTER TABLE public.config
  ADD COLUMN IF NOT EXISTS app_url_publica text NOT NULL DEFAULT 'https://copa-bolao-live.lovable.app',
  ADD COLUMN IF NOT EXISTS convite_template text NOT NULL DEFAULT
$txt$Fala {nome}! 🏆

Te convidei pro nosso Bolão da Copa 2026!

▸ Apostas em vencedor e placar exato
▸ Bolão privado entre amigos, sem fins lucrativos
▸ 100% do valor apostado vai pros ganhadores
▸ Depósitos e saques via PIX direto comigo

Pra entrar:
1️⃣ Acesse: {url}
2️⃣ Faça login com Google usando ESTE e-mail: {email}
3️⃣ Preenche o cadastro (CPF + data de nascimento)

Qualquer coisa me chama 👊$txt$;