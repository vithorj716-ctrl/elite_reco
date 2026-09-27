import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

import mp4Desktop from "@/assets/video/bg-desktop.mp4.asset.json";
import webmDesktop from "@/assets/video/bg-desktop.webm.asset.json";
import mp4Mobile from "@/assets/video/bg-mobile.mp4.asset.json";
import poster from "@/assets/video/bg-poster.webp.asset.json";

/**
 * Camada de vídeo cinematográfico do sistema inteiro.
 * O elemento <video> é montado UMA única vez (na raiz) e nunca reinicia
 * durante a navegação: as telas apenas ajustam a intensidade percebida.
 */

export type IntensidadeVideo = "alta" | "media" | "baixa" | "off";

/** Quanto do vídeo aparece (0–1) e quanto o overlay escurece (0–1). */
const NIVEL: Record<Exclude<IntensidadeVideo, "off">, { video: number; overlay: number }> = {
  alta: { video: 1, overlay: 0.42 },
  media: { video: 0.72, overlay: 0.62 },
  baixa: { video: 0.4, overlay: 0.8 },
};

/* ----------------------------- store mínima ----------------------------- */

let intensidadeAtual: IntensidadeVideo = "media";
const ouvintes = new Set<() => void>();
const pilha: { id: number; valor: IntensidadeVideo }[] = [];
let seq = 0;

function emitir() {
  intensidadeAtual = pilha.at(-1)?.valor ?? "media";
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

function ler() {
  return intensidadeAtual;
}

/** Cada tela declara sua intensidade; ao sair, volta para a anterior. */
export function useFundoVideo(valor: IntensidadeVideo) {
  useEffect(() => {
    const id = ++seq;
    pilha.push({ id, valor });
    emitir();
    return () => {
      const i = pilha.findIndex((p) => p.id === id);
      if (i >= 0) pilha.splice(i, 1);
      emitir();
    };
  }, [valor]);
}

/* ------------------------------- componente ------------------------------ */

function useMovel() {
  const [movel, setMovel] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const ler = () => setMovel(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);
  return movel;
}

function useReduzirMovimento() {
  const [reduzir, setReduzir] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ler = () => setReduzir(mq.matches);
    ler();
    mq.addEventListener("change", ler);
    return () => mq.removeEventListener("change", ler);
  }, []);
  return reduzir;
}

export function AnimatedVideoBackground({
  enabled = true,
  className,
}: {
  enabled?: boolean;
  className?: string;
}) {
  const intensidade = useSyncExternalStore(assinar, ler, () => "media" as IntensidadeVideo);
  const movel = useMovel();
  const reduzir = useReduzirMovimento();
  const [montado, setMontado] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => setMontado(true), []);

  // Autoplay pode ser bloqueado: tentamos de novo no primeiro toque/clique.
  useEffect(() => {
    if (!montado || reduzir) return;
    const v = ref.current;
    if (!v) return;
    const tocar = () => {
      void v.play().catch(() => undefined);
    };
    tocar();
    window.addEventListener("pointerdown", tocar, { once: true, passive: true });
    document.addEventListener("visibilitychange", tocar);
    return () => {
      window.removeEventListener("pointerdown", tocar);
      document.removeEventListener("visibilitychange", tocar);
    };
  }, [montado, reduzir]);

  if (!enabled || intensidade === "off") return null;

  const nivel = NIVEL[intensidade];
  const src = movel ? mp4Mobile.url : mp4Desktop.url;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background", className)}
    >
      {/* Cena em movimento */}
      {montado && !reduzir ? (
        <video
          ref={ref}
          key={src}
          className="absolute inset-0 size-full object-cover"
          style={{ opacity: nivel.video, transition: "opacity 600ms ease" }}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster={poster.url}
          disablePictureInPicture
          disableRemotePlayback
        >
          {!movel && <source src={webmDesktop.url} type="video/webm" />}
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <img
          src={poster.url}
          alt=""
          className="absolute inset-0 size-full object-cover"
          style={{ opacity: nivel.video }}
        />
      )}

      {/* Overlay de contraste: escurece e puxa a cena para o grafite do tema */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `color-mix(in oklab, var(--color-background) ${nivel.overlay * 100}%, transparent)`,
          transition: "background-color 600ms ease",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(120% 90% at 50% 0%, transparent 0%, color-mix(in oklab, var(--color-background) 65%, transparent) 60%, var(--color-background) 100%)",
        }}
      />
    </div>
  );
}
