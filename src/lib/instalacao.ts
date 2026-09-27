import { useCallback, useEffect, useState } from "react";

/** Evento oficial do padrão PWA (Chromium). */
export interface EventoInstalacao extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt: () => Promise<void>;
}

export type Navegador = "chrome" | "edge" | "samsung" | "brave" | "firefox" | "opera" | "outro";
export type SistemaOperacional = "android" | "ios" | "windows" | "macos" | "linux" | "outro";

export const INSTRUCOES: Record<Navegador, string> = {
  chrome: "Toque no menu ⋮ e depois em “Instalar aplicativo”.",
  edge: "Abra o menu e escolha “Instalar este aplicativo”.",
  samsung: "Abra o menu e escolha “Adicionar à tela inicial”.",
  brave: "Toque no menu ⋮ e depois em “Instalar aplicativo”.",
  opera: "Abra o menu e escolha “Adicionar à tela inicial”.",
  firefox: "Abra o menu ⋮ e escolha “Adicionar à tela inicial”.",
  outro: "Abra o menu do navegador e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.",
};

const ROTULO_NAVEGADOR: Record<Navegador, string> = {
  chrome: "Chrome",
  edge: "Edge",
  samsung: "Samsung Internet",
  brave: "Brave",
  opera: "Opera",
  firefox: "Firefox",
  outro: "navegador",
};

function detectarSO(ua: string): SistemaOperacional {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/mac os x/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";
  return "outro";
}

function detectarNavegador(ua: string): Navegador {
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/edg[ea]?\//i.test(ua)) return "edge";
  if (/opr\/|opera/i.test(ua)) return "opera";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  // Brave expõe navigator.brave; o UA é idêntico ao do Chrome.
  if (typeof navigator !== "undefined" && (navigator as { brave?: unknown }).brave) return "brave";
  if (/chrome|crios|chromium/i.test(ua)) return "chrome";
  return "outro";
}

function emModoApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    (navigator as { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith("android-app://")
  );
}

export interface EstadoInstalacao {
  pronto: boolean;
  so: SistemaOperacional;
  navegador: Navegador;
  rotuloNavegador: string;
  android: boolean;
  instalado: boolean;
  suportaPrompt: boolean;
  /** Mostrar o botão de instalação (Android, não instalado). */
  podeMostrar: boolean;
  instrucao: string;
  instalar: () => Promise<"accepted" | "dismissed" | "indisponivel">;
}

export function useInstalacaoPwa(): EstadoInstalacao {
  const [pronto, setPronto] = useState(false);
  const [evento, setEvento] = useState<EventoInstalacao | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [so, setSo] = useState<SistemaOperacional>("outro");
  const [navegador, setNavegador] = useState<Navegador>("outro");

  useEffect(() => {
    const ua = navigator.userAgent;
    setSo(detectarSO(ua));
    setNavegador(detectarNavegador(ua));
    setInstalado(emModoApp());
    setPronto(true);

    const aoPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalacao);
    };
    const aoInstalar = () => {
      setInstalado(true);
      setEvento(null);
    };
    const mq = window.matchMedia("(display-mode: standalone)");
    const aoMudarModo = () => setInstalado(emModoApp());

    window.addEventListener("beforeinstallprompt", aoPrompt);
    window.addEventListener("appinstalled", aoInstalar);
    mq.addEventListener("change", aoMudarModo);

    // Alguns navegadores já dispararam o evento antes da montagem.
    void (navigator as { getInstalledRelatedApps?: () => Promise<unknown[]> })
      .getInstalledRelatedApps?.()
      .then((apps) => {
        if (apps.length > 0) setInstalado(true);
      })
      .catch(() => undefined);

    return () => {
      window.removeEventListener("beforeinstallprompt", aoPrompt);
      window.removeEventListener("appinstalled", aoInstalar);
      mq.removeEventListener("change", aoMudarModo);
    };
  }, []);

  const instalar = useCallback(async () => {
    if (!evento) return "indisponivel" as const;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    setEvento(null);
    return outcome;
  }, [evento]);

  const android = so === "android";

  return {
    pronto,
    so,
    navegador,
    rotuloNavegador: ROTULO_NAVEGADOR[navegador],
    android,
    instalado,
    suportaPrompt: !!evento,
    podeMostrar: pronto && android && !instalado,
    instrucao: INSTRUCOES[navegador],
    instalar,
  };
}
