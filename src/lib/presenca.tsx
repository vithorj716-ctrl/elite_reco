/**
 * Presença do agente: duas informações independentes.
 *
 *  • ONLINE/OFFLINE — decisão manual do agente, persistida no banco. Só muda
 *    quando ele toca no botão. Fechar o app, trocar de aplicativo, bloquear a
 *    tela ou perder a internet NÃO alteram essa decisão.
 *  • CONEXÃO — último instante em que o aparelho conseguiu falar com o
 *    servidor (`visto_em`). Serve apenas de informação para a central e nunca
 *    derruba a disponibilidade.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AgentesService } from "@/services/agentes.service";
import { INTERVALO_HEARTBEAT_MS } from "@/domain/services/presenca";

export interface Presenca {
  /** Intenção do agente (botão), espelhada do banco. */
  online: boolean;
  /** O navegador enxerga rede? */
  conectado: boolean;
  /** O servidor confirmou o último sinal do aparelho? */
  confirmado: boolean;
  /** Carimbo devolvido pelo servidor no último sinal. */
  ultimaComunicacao: string | null;
  ocupado: boolean;
  alternar: (ligar: boolean) => Promise<void>;
}

export function usePresencaAgente(agenteId: string | undefined, onlineNoBanco: boolean): Presenca {
  const [online, setOnline] = useState(onlineNoBanco);
  const [conectado, setConectado] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [confirmado, setConfirmado] = useState(false);
  const [ultimaComunicacao, setUltimaComunicacao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // A fonte da verdade é o banco: mudanças vindas do realtime refletem no botão.
  useEffect(() => setOnline(onlineNoBanco), [onlineNoBanco]);

  /** Sinal de conexão — nunca altera ONLINE/OFFLINE. */
  const bater = useCallback(async () => {
    if (!agenteId) return;
    try {
      const quando = await AgentesService.tocarPresenca();
      setUltimaComunicacao(quando);
      setConfirmado(true);
    } catch {
      // Sem rede o sinal simplesmente não chega: a decisão manual continua valendo.
      setConfirmado(false);
    }
  }, [agenteId]);

  /** Decisão manual do agente, persistida no servidor. */
  const alternar = useCallback(
    async (ligar: boolean) => {
      setOcupado(true);
      try {
        const quando = await AgentesService.registrarPresenca(ligar);
        setOnline(ligar);
        setUltimaComunicacao(quando ?? new Date().toISOString());
        setConfirmado(true);
      } finally {
        setOcupado(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!agenteId) return;
    let vivo = true;
    // O sinal é enviado esteja o agente online ou offline: ele informa apenas
    // a saúde da comunicação. Navegador em segundo plano estrangula o timer,
    // então cada retorno de foco, cada volta de rede e cada tique disparam um
    // novo carimbo.
    const pulsar = () => {
      if (!vivo) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setConfirmado(false);
        return;
      }
      void bater();
    };
    pulsar();
    const timer = window.setInterval(pulsar, INTERVALO_HEARTBEAT_MS);

    const aoVoltar = () => {
      setConectado(true);
      pulsar();
    };
    const aoCair = () => {
      setConectado(false);
      setConfirmado(false);
    };
    window.addEventListener("online", aoVoltar);
    window.addEventListener("offline", aoCair);
    window.addEventListener("focus", pulsar);
    window.addEventListener("pageshow", pulsar);
    document.addEventListener("visibilitychange", pulsar);
    document.addEventListener("resume", pulsar);

    return () => {
      vivo = false;
      window.clearInterval(timer);
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("offline", aoCair);
      window.removeEventListener("focus", pulsar);
      window.removeEventListener("pageshow", pulsar);
      document.removeEventListener("visibilitychange", pulsar);
      document.removeEventListener("resume", pulsar);
    };
  }, [agenteId, bater]);

  return { online, conectado, confirmado, ultimaComunicacao, ocupado, alternar };
}

/* ─────────── Provedor único: um heartbeat por sessão ─────────── */

const CtxPresenca = createContext<Presenca | null>(null);

export function ProvedorPresenca({
  agenteId,
  online,
  children,
}: {
  agenteId: string | undefined;
  online: boolean;
  children: ReactNode;
}) {
  const presenca = usePresencaAgente(agenteId, online);
  return <CtxPresenca.Provider value={presenca}>{children}</CtxPresenca.Provider>;
}

/** Presença compartilhada — nulo quando o usuário não é agente. */
export function usePresenca() {
  return useContext(CtxPresenca);
}
