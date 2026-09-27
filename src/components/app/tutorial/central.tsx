import { AnimatePresence, motion } from "motion/react";
import { CircleHelp, PlayCircle, RotateCcw, Sparkles, X } from "lucide-react";
import { transicao, varFundo, varItem, varLista, varModal } from "@/lib/animacao";
import { useSessao } from "@/lib/sessao";
import { useTutorial, useTutorialOpcional } from "@/lib/tutorial/contexto";
import { tutoriaisDoPapel, tutorialInicial, tutorialDaRota } from "@/lib/tutorial/passos";
import { useRouterState } from "@tanstack/react-router";

/** Botão do topo — porta de entrada do instrutor virtual. */
export function BotaoTutorial() {
  const { abrirCentral } = useTutorial();
  return (
    <motion.button
      onClick={abrirCentral}
      whileTap={{ scale: 0.97 }}
      transition={transicao.rapida}
      data-tour="tutorial"
      aria-label="Abrir tutorial — como usar o sistema"
      className="press flex min-h-9 items-center gap-1.5 border border-primary/50 px-2.5 text-[12px] text-foreground hover:border-primary hover:bg-primary/10"
    >
      <CircleHelp className="size-3.5 text-primary" aria-hidden />
      <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-[0.12em]">Como usar</span>
    </motion.button>
  );
}

/** Botão contextual "aprender esta tela", exibido no cabeçalho das páginas. */
export function BotaoTutorialDaTela() {
  const { usuario } = useSessao();
  const ctx = useTutorialOpcional();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tutorial = tutorialDaRota(pathname, usuario?.papel);
  if (!ctx || !tutorial) return null;
  const { iniciar } = ctx;
  return (
    <button
      onClick={() => iniciar(tutorial.id)}
      className="press flex min-h-9 items-center gap-1.5 border border-border px-2.5 text-[12px] text-muted-foreground hover:border-primary/60 hover:text-foreground"
    >
      <CircleHelp className="size-3.5 text-primary" aria-hidden />
      Aprender esta tela
    </button>
  );
}

/** Convite de primeiro acesso. */
export function BoasVindasTutorial() {
  const { boasVindasAberta, dispensarBoasVindas, iniciar } = useTutorial();
  const { usuario } = useSessao();
  const sugerido = tutorialInicial(usuario?.papel);

  return (
    <AnimatePresence>
      {boasVindasAberta && sugerido && (
        <motion.div
          variants={varFundo}
          initial="inicial"
          animate="animar"
          exit="sair"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Boas-vindas"
        >
          <motion.div
            variants={varModal}
            initial="inicial"
            animate="animar"
            exit="sair"
            className="w-full max-w-md border border-border-strong bg-surface p-6 shadow-cromo"
          >
            <Sparkles className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-display text-xl uppercase tracking-[0.06em] text-cromo">
              Bem-vindo à Elite
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Vamos te mostrar rapidamente como o sistema funciona — onde clicar, como criar uma
              operação e como acompanhar tudo até a liquidação.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => iniciar(sugerido.id)}
                className="press bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"
              >
                Começar tour
              </button>
              <button
                onClick={dispensarBoasVindas}
                className="press border border-border px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground"
              >
                Pular
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Central de tutoriais: guia completo + guias por módulo. */
export function CentralTutoriais() {
  const { centralAberta, fecharCentral, iniciar, progressoDe, concluido } = useTutorial();
  const { usuario } = useSessao();
  const lista = tutoriaisDoPapel(usuario?.papel);

  return (
    <AnimatePresence>
      {centralAberta && (
        <motion.div
          variants={varFundo}
          initial="inicial"
          animate="animar"
          exit="sair"
          onClick={fecharCentral}
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Central de tutoriais"
        >
          <motion.div
            variants={varModal}
            initial="inicial"
            animate="animar"
            exit="sair"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl border border-border-strong bg-surface shadow-cromo"
          >
            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <CircleHelp className="size-4 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="label-caps text-primary">Instrutor virtual</p>
                <h2 className="font-display text-[15px] uppercase tracking-[0.06em] text-cromo">
                  Como usar o sistema
                </h2>
              </div>
              <button
                onClick={fecharCentral}
                aria-label="Fechar central de tutoriais"
                className="press ml-auto flex size-8 items-center justify-center border border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <motion.div
              variants={varLista(0.03)}
              initial="inicial"
              animate="animar"
              className="max-h-[70dvh] overflow-y-auto rolagem-y p-4"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {lista.map((t) => {
                  const parou = progressoDe(t.id);
                  return (
                    <motion.div
                      key={t.id}
                      variants={varItem}
                      className="border border-border bg-surface-raised/40 p-3"
                    >
                      <div className="flex items-start gap-2">
                        <PlayCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] text-foreground">{t.titulo}</p>
                          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                            {t.resumo}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => iniciar(t.id)}
                          className="press bg-primary px-2.5 py-1 text-[12px] font-medium text-primary-foreground"
                        >
                          {parou > 0 || concluido(t.id) ? "Começar do início" : "Iniciar"}
                        </button>
                        {parou > 0 && (
                          <button
                            onClick={() => iniciar(t.id, { retomar: true })}
                            className="press flex items-center gap-1 border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground"
                          >
                            <RotateCcw className="size-3" aria-hidden /> Continuar de onde parei
                          </button>
                        )}
                        <button
                          onClick={() => iniciar(t.id, { modo: "demonstracao" })}
                          className="press px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                        >
                          Demonstração
                        </button>
                      </div>
                      <span className="sr-only">
                        {t.passos.length} passos{concluido(t.id) ? ", já concluído" : ""}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                ESC sai do tutorial a qualquer momento · setas do teclado navegam
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
