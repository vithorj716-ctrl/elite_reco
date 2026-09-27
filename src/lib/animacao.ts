import type { Transition, Variants } from "motion/react";

/**
 * Curvas e durações padrão do sistema (200ms – 700ms).
 * Nunca usar animações chamativas: tudo é discreto e reversível.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;
export const EASE_ENTRADA = [0.16, 1, 0.3, 1] as const;

export const transicao = {
  rapida: { duration: 0.2, ease: EASE } satisfies Transition,
  padrao: { duration: 0.32, ease: EASE } satisfies Transition,
  suave: { duration: 0.48, ease: EASE_ENTRADA } satisfies Transition,
  lenta: { duration: 0.68, ease: EASE_ENTRADA } satisfies Transition,
};

/** Transição entre páginas — entrada e saída. */
export const varPagina: Variants = {
  inicial: { opacity: 0, y: 10 },
  animar: { opacity: 1, y: 0, transition: transicao.suave },
  sair: { opacity: 0, y: -6, transition: transicao.rapida },
};

/** Container com stagger para listas e grades. */
export const varLista = (intervalo = 0.045): Variants => ({
  inicial: {},
  animar: { transition: { staggerChildren: intervalo, delayChildren: 0.04 } },
  sair: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
});

/** Item de lista com stagger. */
export const varItem: Variants = {
  inicial: { opacity: 0, y: 8 },
  animar: { opacity: 1, y: 0, transition: transicao.padrao },
  sair: { opacity: 0, y: -4, transition: transicao.rapida },
};

/** Modais e sheets. */
export const varModal: Variants = {
  inicial: { opacity: 0, y: 12, scale: 0.985 },
  animar: { opacity: 1, y: 0, scale: 1, transition: transicao.padrao },
  sair: { opacity: 0, y: 8, scale: 0.99, transition: transicao.rapida },
};

export const varFundo: Variants = {
  inicial: { opacity: 0 },
  animar: { opacity: 1, transition: transicao.rapida },
  sair: { opacity: 0, transition: transicao.rapida },
};

/** Feedback tátil padrão para elementos clicáveis. */
export const toque = {
  whileHover: { y: -1 },
  whileTap: { y: 1, scale: 0.985 },
  transition: transicao.rapida,
} as const;
