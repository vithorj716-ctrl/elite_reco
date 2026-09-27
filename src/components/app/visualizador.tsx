/**
 * Visualizador profissional de evidências: zoom, arrastar, tela cheia,
 * navegação entre imagens e download. Nunca abrir evidência como miniatura.
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { EASE } from "@/lib/animacao";
import { cn } from "@/lib/utils";

export interface ItemVisual {
  id: string;
  url: string;
  titulo: string;
  legenda?: string;
  video?: boolean;
}

const MIN = 1;
const MAX = 6;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function Visualizador({
  itens,
  indice,
  aoFechar,
  aoTrocar,
  permitirDownload = true,
}: {
  itens: ItemVisual[];
  indice: number;
  aoFechar: () => void;
  aoTrocar: (i: number) => void;
  permitirDownload?: boolean;
}) {
  const raiz = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arrasto = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const estado = useRef({ zoom: 1, pos: { x: 0, y: 0 } });
  estado.current = { zoom, pos };

  const item = itens[indice];

  const reiniciar = useCallback(() => {
    setZoom(1);
    setPos({ x: 0, y: 0 });
  }, []);

  const irPara = useCallback(
    (i: number) => {
      if (itens.length === 0) return;
      const proximo = (i + itens.length) % itens.length;
      reiniciar();
      aoTrocar(proximo);
    },
    [itens.length, aoTrocar, reiniciar],
  );

  const ampliar = useCallback((fator: number, px?: number, py?: number) => {
    const atual = estado.current;
    const alvo = clamp(atual.zoom * fator, MIN, MAX);
    if (alvo === atual.zoom) return;
    const caixa = palco.current?.getBoundingClientRect();
    const cx = px ?? (caixa ? caixa.width / 2 : 0);
    const cy = py ?? (caixa ? caixa.height / 2 : 0);
    const k = alvo / atual.zoom;
    setZoom(alvo);
    setPos(
      alvo === 1
        ? { x: 0, y: 0 }
        : { x: cx - (cx - atual.pos.x) * k, y: cy - (cy - atual.pos.y) * k },
    );
  }, []);

  /* Roda do mouse / pinça do trackpad — listener não-passivo. */
  useEffect(() => {
    const el = palco.current;
    if (!el) return;
    const naRoda = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const caixa = el.getBoundingClientRect();
      ampliar(Math.exp(-dy * 0.0018), e.clientX - caixa.left, e.clientY - caixa.top);
    };
    el.addEventListener("wheel", naRoda, { passive: false });
    return () => el.removeEventListener("wheel", naRoda);
  }, [ampliar]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
      if (e.key === "ArrowRight") irPara(indice + 1);
      if (e.key === "ArrowLeft") irPara(indice - 1);
      if (e.key === "0") reiniciar();
      if (e.key === "+" || e.key === "=") ampliar(1.3);
      if (e.key === "-") ampliar(1 / 1.3);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar, irPara, indice, ampliar, reiniciar]);

  /** Tela cheia sempre no overlay inteiro — os controles (inclusive o X) continuam visíveis. */
  async function telaCheia() {
    const alvo = raiz.current;
    if (!alvo) return;
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    else await alvo.requestFullscreen().catch(() => undefined);
  }

  /** Fechar sai da tela cheia antes de desmontar, para não travar o navegador. */
  async function fechar() {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
    aoFechar();
  }

  if (!item) return null;

  const acao =
    "press inline-flex size-9 items-center justify-center border border-border-strong/70 bg-surface/80 text-muted-foreground backdrop-blur hover:border-primary hover:text-primary";

  return (
    <AnimatePresence>
      <motion.div
        ref={raiz}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: EASE }}
        className="fixed inset-0 z-[80] flex flex-col bg-background/96 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={item.titulo}
      >

        <header className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] text-foreground">{item.titulo}</p>
            {item.legenda && (
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {item.legenda}
              </p>
            )}
          </div>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {indice + 1} / {itens.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button className={acao} onClick={() => ampliar(1 / 1.35)} aria-label="Reduzir">
              <Minus className="size-4" />
            </button>
            <button className={acao} onClick={() => ampliar(1.35)} aria-label="Ampliar">
              <Plus className="size-4" />
            </button>
            <button className={acao} onClick={reiniciar} aria-label="Restaurar zoom">
              <RotateCcw className="size-4" />
            </button>
            <button className={acao} onClick={() => void telaCheia()} aria-label="Tela cheia">
              <Maximize2 className="size-4" />
            </button>
            {permitirDownload && (
              <a
                className={acao}
                href={item.url}
                download
                target="_blank"
                rel="noreferrer"
                aria-label="Baixar evidência"
              >
                <Download className="size-4" />
              </a>
            )}
            <button className={acao} onClick={() => void fechar()} aria-label="Fechar">
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div
            ref={palco}
            className={cn(
              "absolute inset-0 flex items-center justify-center overflow-hidden select-none",
              zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
            )}
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              if (zoom <= 1) return;
              (e.target as Element).setPointerCapture?.(e.pointerId);
              arrasto.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
            }}
            onPointerMove={(e) => {
              const a = arrasto.current;
              if (!a) return;
              setPos({ x: a.ox + (e.clientX - a.x), y: a.oy + (e.clientY - a.y) });
            }}
            onPointerUp={() => (arrasto.current = null)}
            onPointerCancel={() => (arrasto.current = null)}
            onDoubleClick={(e) => {
              const caixa = palco.current?.getBoundingClientRect();
              if (zoom > 1) reiniciar();
              else ampliar(2.4, e.clientX - (caixa?.left ?? 0), e.clientY - (caixa?.top ?? 0));
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.985 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                style={{
                  transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
                className="max-h-full max-w-full"
              >
                {item.video ? (
                  <video src={item.url} controls className="max-h-[80vh] max-w-[92vw]" />
                ) : (
                  <img
                    src={item.url}
                    alt={item.titulo}
                    draggable={false}
                    className="max-h-[80vh] max-w-[92vw] object-contain"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {itens.length > 1 && (
            <>
              <button
                className={cn(acao, "absolute left-3 top-1/2 -translate-y-1/2")}
                onClick={() => irPara(indice - 1)}
                aria-label="Evidência anterior"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                className={cn(acao, "absolute right-3 top-1/2 -translate-y-1/2")}
                onClick={() => irPara(indice + 1)}
                aria-label="Próxima evidência"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
        </div>

        {itens.length > 1 && (
          <div className="flex gap-px rolagem-x border-t border-border bg-border">
            {itens.map((t, i) => (
              <button
                key={t.id}
                onClick={() => irPara(i)}
                aria-label={t.titulo}
                className={cn(
                  "relative h-16 w-24 shrink-0 bg-surface transition-opacity",
                  i === indice ? "opacity-100" : "opacity-45 hover:opacity-80",
                )}
              >
                {t.video ? (
                  <span className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    vídeo
                  </span>
                ) : (
                  <img src={t.url} alt="" className="h-full w-full object-cover" />
                )}
                {i === indice && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Estado pronto para telas que exibem galerias de evidência. */
export function useGaleria() {
  const [indice, setIndice] = useState<number | null>(null);
  return {
    indice,
    abrir: (i: number) => setIndice(i),
    fechar: () => setIndice(null),
    trocar: (i: number) => setIndice(i),
  };
}
