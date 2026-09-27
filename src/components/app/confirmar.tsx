/**
 * Confirmação obrigatória antes de qualquer exclusão ou ação destrutiva.
 * Uso: const { pedir, dialogo } = useConfirmacao(); ... {dialogo}
 * Quando a decisão precisa ficar registrada (cancelar, reabrir, estornar),
 * use `pedirMotivo`, que devolve o texto justificando a ação.
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Botao } from "@/components/app/ui";
import { varFundo, varModal } from "@/lib/animacao";

interface Pedido {
  titulo: string;
  texto?: string;
  confirmar?: string;
  destrutivo?: boolean;
  /** Rótulo do campo de justificativa. Presente = motivo obrigatório. */
  motivo?: string;
}

export function useConfirmacao() {
  const [pedido, setPedido] = useState<
    (Pedido & { resolver: (v: string | false) => void }) | null
  >(null);
  const [texto, setTexto] = useState("");

  const abrir = useCallback(
    (p: Pedido) =>
      new Promise<string | false>((resolver) => {
        setTexto("");
        setPedido({ ...p, resolver });
      }),
    [],
  );

  const pedir = useCallback(async (p: Pedido) => (await abrir(p)) !== false, [abrir]);

  /** Devolve o motivo informado, ou null quando o operador desiste. */
  const pedirMotivo = useCallback(
    async (p: Pedido & { motivo: string }) => {
      const r = await abrir(p);
      return r === false ? null : r;
    },
    [abrir],
  );

  const responder = (valor: string | false) => {
    pedido?.resolver(valor);
    setPedido(null);
    setTexto("");
  };

  useEffect(() => {
    if (!pedido) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        pedido.resolver(false);
        setPedido(null);
        setTexto("");
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [pedido]);

  const faltaMotivo = Boolean(pedido?.motivo) && texto.trim().length < 3;

  const dialogo: ReactNode = (
    <AnimatePresence>
      {pedido && (
        <motion.div
          variants={varFundo}
          initial="inicial"
          animate="animar"
          exit="sair"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => responder(false)}
        >
          <motion.div
            variants={varModal}
            initial="inicial"
            animate="animar"
            exit="sair"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm border border-border-strong bg-surface"
          >
            <div className="flex items-start gap-3 border-b border-border px-4 py-3">
              <AlertTriangle
                className={pedido.destrutivo === false ? "size-4 text-primary" : "size-4 text-destructive"}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[14px] font-medium tracking-tight text-foreground">{pedido.titulo}</p>
                {pedido.texto && (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{pedido.texto}</p>
                )}
              </div>
            </div>
            {pedido.motivo && (
              <div className="grid gap-1.5 border-b border-border px-4 py-3">
                <label htmlFor="motivo-confirmacao" className="label-caps">
                  {pedido.motivo}
                </label>
                <textarea
                  id="motivo-confirmacao"
                  value={texto}
                  autoFocus
                  rows={2}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Registrado no histórico da ordem"
                  className="campo resize-none text-[13px]"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 px-4 py-3">
              <Botao variante="fantasma" tamanho="sm" onClick={() => responder(false)}>
                Cancelar
              </Botao>
              <Botao
                variante={pedido.destrutivo === false ? "solido" : "perigo"}
                tamanho="sm"
                autoFocus={!pedido.motivo}
                disabled={faltaMotivo}
                onClick={() => responder(pedido.motivo ? texto.trim() : "")}
              >
                {pedido.confirmar ?? "Excluir"}
              </Botao>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { pedir, pedirMotivo, dialogo };
}
