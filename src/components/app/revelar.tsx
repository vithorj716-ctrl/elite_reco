import { motion, useReducedMotion } from "motion/react";
import { useInView } from "react-intersection-observer";
import type { ReactNode } from "react";
import { transicao } from "@/lib/animacao";

/**
 * Revela conteúdo ao entrar na viewport e reverte ao sair (scroll de volta).
 */
export function Revelar({
  children,
  atraso = 0,
  y = 14,
  className,
}: {
  children: ReactNode;
  atraso?: number;
  y?: number;
  className?: string;
}) {
  const reduzir = useReducedMotion();
  const { ref, inView } = useInView({ threshold: 0.15, rootMargin: "-4% 0px -8% 0px" });

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={
        reduzir
          ? { opacity: 1, y: 0 }
          : inView
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y }
      }
      transition={{ ...transicao.suave, delay: inView ? atraso : 0 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
