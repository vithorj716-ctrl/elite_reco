import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Camada visual de fundo — discreta, decorativa e sem interação.
 * Toda a configuração de quantidade, velocidade e opacidade vive aqui:
 * nenhuma tela deve espalhar números de animação pelo próprio código.
 */

export type VarianteFundo = "financeiro" | "operacional" | "dashboard" | "minimal";
export type IntensidadeFundo = "low" | "medium";

type Config = {
  cifroes: number;
  particulas: number;
  raios: number;
  linhas: number;
  opacidade: number;
  duracaoBase: number;
};

const BASE: Record<VarianteFundo, Config> = {
  financeiro: { cifroes: 9, particulas: 14, raios: 1, linhas: 0, opacidade: 0.1, duracaoBase: 46 },
  operacional: { cifroes: 0, particulas: 20, raios: 3, linhas: 3, opacidade: 0.09, duracaoBase: 38 },
  dashboard: { cifroes: 4, particulas: 16, raios: 2, linhas: 2, opacidade: 0.085, duracaoBase: 44 },
  minimal: { cifroes: 0, particulas: 8, raios: 0, linhas: 1, opacidade: 0.06, duracaoBase: 54 },
};

const FATOR_INTENSIDADE: Record<IntensidadeFundo, number> = { low: 0.55, medium: 1 };
/** Android/telas pequenas: menos elementos, menos blur, mesma sensação. */
const FATOR_MOVEL = 0.45;

/** PRNG estável: mesma semente ⇒ mesmo desenho em SSR e no cliente. */
function aleatorio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

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

/** Parallax de mouse muito leve — desktop apenas, alguns pixels. */
function useParallax(ativo: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ativo) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const mover = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 14;
        const y = (e.clientY / window.innerHeight - 0.5) * 10;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };
    window.addEventListener("mousemove", mover, { passive: true });
    return () => {
      window.removeEventListener("mousemove", mover);
      cancelAnimationFrame(raf);
    };
  }, [ativo]);
  return ref;
}

export function FundoAnimado({
  variante = "minimal",
  intensidade = "medium",
  ativo = true,
  className,
}: {
  variante?: VarianteFundo;
  intensidade?: IntensidadeFundo;
  ativo?: boolean;
  className?: string;
}) {
  const reduzir = useReducedMotion();
  const movel = useMovel();
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const fator =
    FATOR_INTENSIDADE[intensidade] * (movel ? FATOR_MOVEL : 1) * (reduzir ? 0 : 1);
  const cfg = BASE[variante];

  const elementos = useMemo(() => {
    const r = aleatorio(variante.length * 7919 + Math.round(fator * 1000));
    const qtd = (n: number) => Math.max(0, Math.round(n * fator));

    const cifroes = Array.from({ length: qtd(cfg.cifroes) }, (_, i) => ({
      id: `c${i}`,
      x: r() * 100,
      y: r() * 100,
      tamanho: 14 + r() * 34,
      duracao: cfg.duracaoBase * (0.7 + r() * 0.9),
      atraso: -r() * 40,
      giro: (r() - 0.5) * 14,
      desloc: 40 + r() * 90,
      profundidade: r(),
    }));

    const particulas = Array.from({ length: qtd(cfg.particulas) }, (_, i) => ({
      id: `p${i}`,
      x: r() * 100,
      y: r() * 100,
      tamanho: 1.5 + r() * 2.5,
      duracao: cfg.duracaoBase * (0.6 + r() * 1.1),
      atraso: -r() * 30,
      dx: (r() - 0.5) * 120,
      dy: -(30 + r() * 120),
      profundidade: r(),
    }));

    const raios = Array.from({ length: qtd(cfg.raios) }, (_, i) => ({
      id: `r${i}`,
      x: 8 + r() * 84,
      y: 8 + r() * 84,
      tamanho: 16 + r() * 20,
      duracao: 9 + r() * 8,
      atraso: -r() * 12,
      giro: (r() - 0.5) * 24,
    }));

    const linhas = Array.from({ length: qtd(cfg.linhas) }, (_, i) => ({
      id: `l${i}`,
      y: 12 + r() * 76,
      largura: 90 + r() * 160,
      duracao: cfg.duracaoBase * (0.8 + r() * 0.6),
      atraso: -r() * 25,
    }));

    return { cifroes, particulas, raios, linhas };
  }, [variante, fator, cfg]);

  const refParallax = useParallax(montado && !movel && !reduzir && ativo);

  if (!ativo || !montado || fator === 0) return null;

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}
      style={{
        opacity: cfg.opacidade * (intensidade === "low" ? 0.75 : 1),
        maskImage:
          "radial-gradient(120% 90% at 50% 20%, oklch(0 0 0 / 100%) 0%, oklch(0 0 0 / 55%) 55%, oklch(0 0 0 / 15%) 100%)",
        WebkitMaskImage:
          "radial-gradient(120% 90% at 50% 20%, oklch(0 0 0 / 100%) 0%, oklch(0 0 0 / 55%) 55%, oklch(0 0 0 / 15%) 100%)",
      }}
    >
      <div ref={refParallax} className="absolute inset-0 will-change-transform">
        {elementos.linhas.map((l) => (
          <motion.span
            key={l.id}
            className="absolute h-px"
            style={{
              top: `${l.y}%`,
              width: l.largura,
              backgroundImage:
                "linear-gradient(90deg, transparent, var(--cromo) 45%, var(--primary) 60%, transparent)",
            }}
            initial={{ x: "-30vw", opacity: 0 }}
            animate={{ x: "115vw", opacity: [0, 0.55, 0.55, 0] }}
            transition={{
              duration: l.duracao,
              delay: l.atraso,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        ))}

        {elementos.particulas.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full bg-cromo"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.tamanho,
              height: p.tamanho,
              filter: movel ? undefined : `blur(${p.profundidade > 0.6 ? 1.4 : 0}px)`,
              opacity: 0.35 + p.profundidade * 0.5,
            }}
            animate={{
              x: [0, p.dx * 0.5, p.dx],
              y: [0, p.dy * 0.55, p.dy],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: p.duracao,
              delay: p.atraso,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

        {elementos.cifroes.map((c) => (
          <motion.span
            key={c.id}
            className="absolute select-none font-display leading-none text-cromo"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              fontSize: c.tamanho,
              filter: movel ? undefined : `blur(${c.profundidade > 0.5 ? 2.2 : 0.6}px)`,
              opacity: 0.3 + c.profundidade * 0.45,
            }}
            animate={{
              y: [0, -c.desloc * 0.5, -c.desloc],
              x: [0, c.desloc * 0.12, -c.desloc * 0.08],
              rotate: [0, c.giro, 0],
              opacity: [0, 0.9, 0],
            }}
            transition={{
              duration: c.duracao,
              delay: c.atraso,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            $
          </motion.span>
        ))}

        {elementos.raios.map((z) => (
          <motion.svg
            key={z.id}
            viewBox="0 0 24 24"
            className="absolute text-primary"
            style={{ left: `${z.x}%`, top: `${z.y}%`, width: z.tamanho, height: z.tamanho }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.9, 1.05, 0.95], rotate: [0, z.giro, 0] }}
            transition={{
              duration: z.duracao,
              delay: z.atraso,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.25, 1],
            }}
          >
            <path
              d="M13 2 4.5 13.5H11L9.5 22 19 10.5h-6.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </motion.svg>
        ))}
      </div>
    </div>
  );
}
