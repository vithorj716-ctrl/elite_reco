import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { transicao } from "@/lib/animacao";
import { useTutorial } from "@/lib/tutorial/contexto";
import { cn } from "@/lib/utils";

interface Caixa {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MARGEM = 8;
const LARGURA_BALAO = 360;

function medir(el: Element): Caixa {
  const r = el.getBoundingClientRect();
  return {
    top: r.top - MARGEM,
    left: r.left - MARGEM,
    width: r.width + MARGEM * 2,
    height: r.height + MARGEM * 2,
  };
}

function visivel(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Palco do instrutor virtual: escurece a interface, ilumina o elemento do
 * passo atual, aponta a seta e explica o que fazer. O alvo é sempre resolvido
 * pelo DOM (data-tour), nunca por coordenadas fixas.
 */
export function PalcoTutorial() {
  const { ativo, passo, indice, total, proximo, anterior, sair, modo } = useTutorial();
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [procurando, setProcurando] = useState(false);
  const alvoRef = useRef<Element | null>(null);

  // Procura o elemento do passo (espera inteligente) e o mantém medido.
  useEffect(() => {
    if (!ativo || !passo) return;
    alvoRef.current = null;
    setCaixa(null);

    if (passo.centralizado || !passo.alvo) {
      setProcurando(false);
      return;
    }

    setProcurando(true);
    let vivo = true;
    let quadro = 0;
    const limite = Date.now() + 6000;
    const seletores = [passo.alvo, ...(passo.alternativos ?? [])];

    const acompanhar = () => {
      if (!vivo) return;
      const el = alvoRef.current;
      if (el && el.isConnected && visivel(el)) setCaixa(medir(el));
      quadro = requestAnimationFrame(acompanhar);
    };

    const procurar = () => {
      if (!vivo) return;
      const el = seletores
        .map((s) => document.querySelector(s))
        .find((e): e is Element => Boolean(e && visivel(e)));
      if (el) {
        alvoRef.current = el;
        setProcurando(false);
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        setTimeout(() => vivo && setCaixa(medir(el)), 220);
        quadro = requestAnimationFrame(acompanhar);
        return;
      }
      if (Date.now() > limite) {
        // Elemento indisponível nesta tela: o passo segue como explicação central.
        setProcurando(false);
        return;
      }
      setTimeout(procurar, 160);
    };

    procurar();
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
    };
  }, [ativo, passo]);

  if (!ativo || !passo) return null;

  const ultimo = indice === total - 1;
  const centralizado = !caixa;
  const abaixo = caixa ? caixa.top + caixa.height + 190 < window.innerHeight : false;
  const estreito = typeof window !== "undefined" && window.innerWidth < 640;

  const posBalao = caixa
    ? {
        top: abaixo ? caixa.top + caixa.height + 16 : Math.max(12, caixa.top - 16),
        left: estreito
          ? 12
          : Math.min(
              Math.max(12, caixa.left + caixa.width / 2 - LARGURA_BALAO / 2),
              window.innerWidth - LARGURA_BALAO - 12,
            ),
        translateY: abaixo ? 0 : "-100%",
        width: estreito ? window.innerWidth - 24 : LARGURA_BALAO,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-label={`Tutorial — passo ${indice + 1} de ${total}: ${passo.titulo}`}
    >
      {/* Escurecimento com recorte iluminado no elemento atual. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={transicao.padrao}
        className="pointer-events-none absolute inset-0"
      >
        {caixa ? (
          <motion.div
            initial={false}
            animate={{ top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height }}
            transition={transicao.padrao}
            className="absolute rounded-[2px] ring-1 ring-primary/70"
            style={{ boxShadow: "0 0 0 9999px rgba(4,4,6,0.82), 0 0 42px 6px hsl(var(--primary)/0.28)" }}
          >
            <motion.span
              className="absolute inset-0 rounded-[2px] border border-primary/50"
              animate={{ opacity: [0.25, 0.8, 0.25] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        ) : (
          <div className="absolute inset-0 bg-[rgba(4,4,6,0.82)]" />
        )}
      </motion.div>

      {/* Bloqueio de interação fora do elemento destacado. */}
      {caixa ? (
        <>
          <div className="absolute inset-x-0 top-0" style={{ height: Math.max(0, caixa.top) }} />
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ height: Math.max(0, window.innerHeight - caixa.top - caixa.height) }}
          />
          <div className="absolute left-0" style={{ top: caixa.top, height: caixa.height, width: Math.max(0, caixa.left) }} />
          <div
            className="absolute right-0"
            style={{ top: caixa.top, height: caixa.height, width: Math.max(0, window.innerWidth - caixa.left - caixa.width) }}
          />
        </>
      ) : (
        <div className="absolute inset-0" />
      )}

      {/* Seta animada apontando para o elemento. */}
      <AnimatePresence>
        {caixa && !estreito && (
          <motion.div
            key={abaixo ? "seta-baixo" : "seta-cima"}
            initial={{ opacity: 0, y: abaixo ? -8 : 8 }}
            animate={{ opacity: 1, y: abaixo ? [0, 6, 0] : [0, -6, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute text-primary"
            style={{
              top: abaixo ? caixa.top + caixa.height + 2 : caixa.top - 26,
              left: Math.min(Math.max(16, caixa.left + caixa.width / 2 - 10), window.innerWidth - 40),
            }}
            aria-hidden
          >
            {abaixo ? <ArrowUp className="size-5" /> : <ArrowDown className="size-5" />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Balão de explicação. */}
      <motion.div
        key={passo.id}
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={transicao.padrao}
        className={cn(
          "absolute border border-border-strong bg-surface p-4 shadow-cromo",
          centralizado && "left-1/2 top-1/2 w-[min(440px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2",
        )}
        style={
          posBalao
            ? {
                top: posBalao.top,
                left: posBalao.left,
                width: posBalao.width,
                transform: posBalao.translateY === 0 ? "translateY(0px)" : "translateY(-100%)",
              }
            : {}
        }
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="label-caps text-primary">
              Passo {indice + 1} de {total}
              {modo === "demonstracao" && " · demonstração"}
            </p>
            <h2 className="mt-1 font-display text-[15px] uppercase tracking-[0.06em] text-cromo">
              {passo.titulo}
            </h2>
          </div>
          <button
            onClick={sair}
            aria-label="Sair do tutorial"
            className="press flex size-7 shrink-0 items-center justify-center border border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>

        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{passo.texto}</p>
        {passo.acao && (
          <p className="mt-2 border-l-2 border-l-primary/70 pl-2 text-[12px] text-foreground">{passo.acao}</p>
        )}
        {procurando && (
          <p className="mt-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden /> localizando elemento…
          </p>
        )}

        <div className="mt-3 h-[3px] w-full bg-border">
          <motion.div
            className="h-full bg-primary"
            initial={false}
            animate={{ width: `${((indice + 1) / total) * 100}%` }}
            transition={transicao.padrao}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={anterior}
            disabled={indice === 0}
            className="press border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Voltar
          </button>
          <button
            onClick={proximo}
            className="press bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
          >
            {ultimo ? "Concluir" : "Próximo"}
          </button>
          <button
            onClick={sair}
            className="press ml-auto px-2 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
          >
            {ultimo ? "Fechar" : "Pular"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
