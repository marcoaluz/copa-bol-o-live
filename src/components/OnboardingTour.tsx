import { useEffect, useState } from "react";
import Joyride, { type CallBackProps, type Step, STATUS } from "react-joyride";
import { useAuth } from "@/hooks/use-auth";

const KEY = "tour_v1_done";

const steps: Step[] = [
  { target: "body", placement: "center", content: "Bem-vindo ao Copa Bolão 2026! Vamos te mostrar o essencial em 5 passos.", disableBeacon: true },
  { target: '[data-tour="bracket"]', content: "Aqui você vê o chaveamento ao vivo e pode apostar nas próximas partidas." },
  { target: '[data-tour="ranking"]', content: "Ranking dos jogadores — quem mais acertou aparece no topo." },
  { target: '[data-tour="wallet"]', content: "Sua carteira: deposite via PIX e solicite saque quando quiser." },
  { target: '[data-tour="profile"]', content: "Seu perfil com histórico de apostas, prêmios e suporte." },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      if (!localStorage.getItem(KEY)) {
        const t = setTimeout(() => setRun(true), 800);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, [user]);

  function onCallback(data: CallBackProps) {
    const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    if (finished.includes(data.status)) {
      try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
      setRun(false);
    }
  }

  if (!run) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={onCallback}
      locale={{ back: "Voltar", close: "Fechar", last: "Pronto", next: "Próximo", skip: "Pular" }}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          backgroundColor: "hsl(var(--card))",
          textColor: "hsl(var(--foreground))",
          arrowColor: "hsl(var(--card))",
          overlayColor: "rgba(0,0,0,0.6)",
          zIndex: 9999,
        },
      }}
    />
  );
}
