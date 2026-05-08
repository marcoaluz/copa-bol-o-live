import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./pt-BR.json";
import enUS from "./en-US.json";
import esES from "./es-ES.json";

let initialized = false;

export function ensureI18n() {
  if (initialized || typeof window === "undefined") return i18n;
  initialized = true;

  let lng = "pt-BR";
  try {
    const saved = localStorage.getItem("lang");
    if (saved) lng = saved;
  } catch {
    /* ignore */
  }

  void i18n.use(initReactI18next).init({
    resources: {
      "pt-BR": { translation: ptBR },
      "en-US": { translation: enUS },
      "es-ES": { translation: esES },
    },
    lng,
    fallbackLng: "pt-BR",
    interpolation: { escapeValue: false },
    returnNull: false,
  });

  return i18n;
}

export default i18n;