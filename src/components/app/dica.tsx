import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
  type Placement,
} from "@floating-ui/react";
import { AnimatePresence, motion } from "motion/react";
import { cloneElement, useState, type ReactElement, type ReactNode } from "react";
import { transicao } from "@/lib/animacao";

/**
 * Tooltip inteligente (Floating UI) com posicionamento automático.
 */
export function Dica({
  texto,
  posicao = "right",
  children,
}: {
  texto: ReactNode;
  posicao?: Placement;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: ReactElement<any>;
}) {
  const [aberto, setAberto] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: aberto,
    onOpenChange: setAberto,
    placement: posicao,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useHover(context, { move: false, delay: { open: 140, close: 40 } }),
    useFocus(context),
    useDismiss(context),
    useRole(context, { role: "tooltip" }),
  ]);

  return (
    <>
      {cloneElement(children, getReferenceProps({ ref: refs.setReference, ...children.props }))}
      <FloatingPortal>
        <AnimatePresence>
          {aberto && (
            <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()} className="z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={transicao.rapida}
                className="border border-border-strong bg-popover px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-popover-foreground shadow-cromo"
              >
                {texto}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}
