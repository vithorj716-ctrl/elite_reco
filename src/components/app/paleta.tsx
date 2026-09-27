import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { transicao, varFundo, varModal } from "@/lib/animacao";

export interface AcaoPaleta {
  para: string;
  rotulo: string;
  grupo: string;
}

/** Paleta de comandos (⌘K / Ctrl+K) para navegar sem tirar as mãos do teclado. */
export function Paleta({ acoes }: { acoes: AcaoPaleta[] }) {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    function atalho(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAberto((v) => !v);
      }
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", atalho);
    return () => window.removeEventListener("keydown", atalho);
  }, []);

  const grupos = [...new Set(acoes.map((a) => a.grupo))];

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          variants={varFundo}
          initial="inicial"
          animate="animar"
          exit="sair"
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/75 px-4 pt-[14vh] backdrop-blur-sm"
          onClick={() => setAberto(false)}
        >
          <motion.div
            variants={varModal}
            initial="inicial"
            animate="animar"
            exit="sair"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg border border-border-strong bg-surface shadow-cromo"
          >
            <span className="barra-ouro block h-[2px] w-full" />
            <Command label="Navegação rápida" className="outline-none">
              <div className="border-b border-border px-4">
                <Command.Input
                  autoFocus
                  placeholder="Ir para…"
                  className="w-full bg-transparent py-3.5 text-[14px] outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Command.List className="rolagem-y max-h-[min(50dvh,320px)] p-1.5">
                <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                  Nada encontrado.
                </Command.Empty>
                {grupos.map((grupo) => (
                  <Command.Group
                    key={grupo}
                    heading={grupo}
                    className="[&_[cmdk-group-heading]]:label-caps [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-2"
                  >
                    {acoes
                      .filter((a) => a.grupo === grupo)
                      .map((a) => (
                        <Command.Item
                          key={a.para}
                          value={`${a.rotulo} ${a.para}`}
                          onSelect={() => {
                            setAberto(false);
                            void navigate({ to: a.para });
                          }}
                          className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[13px] text-foreground transition-colors data-[selected=true]:bg-surface-raised data-[selected=true]:text-primary"
                        >
                          {a.rotulo}
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{a.para}</span>
                        </Command.Item>
                      ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={transicao.rapida}
              className="border-t border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              ↑↓ navegar • enter abrir • esc fechar
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
