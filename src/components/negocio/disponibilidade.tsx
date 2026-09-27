/**
 * Disponibilidade do agente.
 *
 * `ControleDisponibilidade` é o botão ONLINE/OFFLINE do app de campo, com o
 * heartbeat que confirma presença no servidor. `SeloDisponibilidade` mostra o
 * estado real para a central. Nada aqui decide distribuição: quem decide é o
 * banco, que só sorteia agentes com presença confirmada.
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Radio, WifiOff } from "lucide-react";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { usePresenca, usePresencaAgente } from "@/lib/presenca";
import {
  COR_ESTADO_AGENTE,
  ROTULO_ESTADO_AGENTE,
  desde,
  estadoAgente,
  type EstadoAgente,
} from "@/domain/services/presenca";
import type { Agente } from "@/domain/types";
import { cn } from "@/lib/utils";

/** Relógio leve: mantém "há X segundos" e a expiração de presença vivos na tela. */
export function useAgora(intervaloMs = 15_000) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => window.clearInterval(t);
  }, [intervaloMs]);
  return agora;
}

export function SeloEstado({ estado }: { estado: EstadoAgente }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.12em]",
        COR_ESTADO_AGENTE[estado],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ROTULO_ESTADO_AGENTE[estado]}
    </span>
  );
}

/** Selo com estado real + última conexão — usado nas telas da central. */
export function SeloDisponibilidade({ agente, compacto }: { agente: Agente; compacto?: boolean }) {
  const banco = useBanco();
  const agora = useAgora();
  const estado = estadoAgente(banco, agente, agora);
  if (compacto) return <SeloEstado estado={estado} />;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <SeloEstado estado={estado} />
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        última conexão {desde(agente.vistoEm, agora)}
      </span>
    </span>
  );
}

/** Botão de disponibilidade do agente, no topo do app de campo. */
export function ControleDisponibilidade() {
  const { usuario } = useSessao();
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const agora = useAgora(10_000);
  const agente = banco.agentes.find((a) => a.id === usuario?.agenteId);
  const compartilhada = usePresenca();
  const local = usePresencaAgente(compartilhada ? undefined : agente?.id, agente?.online ?? false);
  const presenca = compartilhada ?? local;

  // O carimbo do servidor muda a cada sinal: mantém a tela alinhada ao banco.
  useEffect(() => {
    if (!presenca.confirmado) return;
    const t = window.setTimeout(() => sincronizar("agentes"), 1200);
    return () => window.clearTimeout(t);
  }, [presenca.confirmado, sincronizar]);

  if (!agente) return null;

  const estado = estadoAgente(banco, agente, agora);
  const semRede = !presenca.conectado;

  return (
    <section className="mb-4 border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={presenca.ocupado}
          onClick={() => void presenca.alternar(!presenca.online)}
          aria-pressed={presenca.online}
          className={cn(
            "press flex items-center gap-2 border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.14em]",
            presenca.online
              ? "border-success/50 text-success"
              : "border-border-strong text-muted-foreground",
          )}
        >
          {presenca.online ? <Radio className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {presenca.online ? "Ficar offline" : "Ficar online"}
        </motion.button>

        <div className="min-w-0">
          <SeloEstado estado={estado} />
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            última comunicação {desde(agente.vistoEm, agora)}
          </p>
        </div>
      </div>

      {semRede && (
        <p className="border-t border-warning/40 bg-warning/10 px-4 py-2.5 text-[12px] leading-relaxed text-warning">
          Sem internet neste momento. Você continua ONLINE — nada é cancelado e as novas
          solicitações chegam por notificação assim que a conexão voltar.
        </p>
      )}
      {presenca.online ? (
        <p className="border-t border-border px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
          Você permanece online mesmo com o app fechado, em segundo plano ou com a tela bloqueada.
          Só sai de online tocando em “Ficar offline”.
        </p>
      ) : (
        estado !== "em_rota" && (
          <p className="border-t border-border px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
            Enquanto estiver offline você não recebe novas ordens.
          </p>
        )
      )}

    </section>
  );
}
