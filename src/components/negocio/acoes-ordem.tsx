/**
 * Menu contextual de ações rápidas da ordem — editar, duplicar, cancelar,
 * reabrir e excluir sem sair da tela em que o operador está.
 */
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Copy,
  MoreHorizontal,
  RotateCcw,
  Slash,
  SquarePen,
  Trash2,
} from "lucide-react";
import {
  ModalTransferirAgente,
  podeTransferirAgente,
} from "@/components/negocio/transferir-agente";
import { useConfirmacao } from "@/components/app/confirmar";
import { ModalCancelamentoLocadora } from "@/components/negocio/cancelar-locadora";
import { EASE } from "@/lib/animacao";
import { useSessao, useSincronizar } from "@/lib/sessao";
import { OrdensService } from "@/services/ordens.service";
import type { Ordem } from "@/domain/types";
import { cn } from "@/lib/utils";

interface Acao {
  rotulo: string;
  icone: typeof Copy;
  ao: () => void | Promise<void>;
  perigo?: boolean;
}

export function AcoesOrdem({
  ordem,
  aoEditar,
  className,
}: {
  ordem: Ordem;
  aoEditar?: () => void;
  className?: string;
}) {
  const { usuario } = useSessao();
  const sincronizar = useSincronizar();
  const navigate = useNavigate();
  const { pedir, pedirMotivo, dialogo } = useConfirmacao();
  const [aberto, setAberto] = useState(false);
  const [cancelandoLocadora, setCancelandoLocadora] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: aberto,
    onOpenChange: setAberto,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 12 }), shift({ padding: 12 })],
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: true }),
    useRole(context, { role: "menu" }),
  ]);

  const equipe = usuario?.papel === "super_admin" || usuario?.papel === "operador";
  const cliente = usuario?.papel === "cliente" && usuario.locadoraId === ordem.locadoraId;
  if (!equipe && !cliente) return null;

  async function executar(rotulo: string, fn: () => Promise<void>) {
    try {
      await fn();
      await sincronizar("ordens");
      toast.success(rotulo);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const liquidada = Boolean(ordem.recebimentoPago || ordem.pagamentoPago);

  const cancelar: Acao = {
    rotulo: "Cancelar ordem",
    icone: Slash,
    ao: async () => {
      const motivo = await pedirMotivo({
        titulo: "Cancelar esta ordem?",
        texto: `${ordem.codigo} • ${ordem.placa} sairá da operação do dia.`,
        confirmar: "Cancelar ordem",
        motivo: "Motivo do cancelamento",
      });
      if (motivo !== null)
        await executar("Ordem cancelada.", () => OrdensService.cancelar(ordem, motivo));
    },
  };

  const excluir: Acao = {
    rotulo: "Excluir",
    icone: Trash2,
    perigo: true,
    ao: async () => {
      const ok = await pedir({
        titulo: "Excluir definitivamente?",
        texto: liquidada
          ? `${ordem.codigo} • ${ordem.placa} está liquidada. A liquidação será estornada e todos os registros vinculados serão apagados.`
          : `${ordem.codigo} • ${ordem.placa} e todos os registros vinculados serão apagados.`,
      });
      if (ok)
        await executar("Ordem excluída.", () =>
          OrdensService.excluir(ordem, { estornarAntes: true }),
        );
    },
  };

  const cancelarLocadora: Acao = {
    rotulo: ordem.status === "em_andamento" ? "Cancelar (taxa de 50%)" : "Cancelar solicitação",
    icone: Slash,
    ao: () => setCancelandoLocadora(true),
  };

  // A locadora resolve apenas a própria solicitação, antes da execução em campo
  const acoes: Acao[] = cliente
    ? [
        {
          rotulo: "Abrir ficha",
          icone: SquarePen,
          ao: () => void navigate({ to: "/ordens/$id", params: { id: ordem.id } }),
        },
        ...(liquidada
          ? []
          : [
              // Após o início do deslocamento o cancelamento passa pelo aceite
              // da taxa de 50% — a regra é validada no banco.
              ...(ordem.status === "pendente_definicao" ||
              ordem.status === "liberada" ||
              ordem.status === "distribuida" ||
              ordem.status === "em_andamento"
                ? [cancelarLocadora]
                : []),
              ...(ordem.status === "pendente_definicao" ||
              ordem.status === "liberada" ||
              ordem.status === "cancelada"
                ? [excluir]
                : []),
            ]),
      ]
    : [
        ...(aoEditar
          ? [{ rotulo: "Editar", icone: SquarePen, ao: aoEditar }]
          : [
              {
                rotulo: "Abrir ficha",
                icone: SquarePen,
                ao: () => void navigate({ to: "/ordens/$id", params: { id: ordem.id } }),
              },
            ]),
        // Troca do responsável: permitida até em rota já iniciada, e validada no banco
        ...(podeTransferirAgente(ordem)
          ? [
              {
                rotulo: ordem.agenteId ? "Transferir agente" : "Atribuir agente",
                icone: ArrowLeftRight,
                ao: () => setTransferindo(true),
              },
            ]
          : []),
        {
          rotulo: "Duplicar",
          icone: Copy,
          ao: () =>
            executar("Ordem duplicada.", () => OrdensService.duplicar(ordem).then(() => {})),
        },
        // Ordem faturada ou paga só volta a ser editável depois do estorno no Financeiro
        ...(liquidada
          ? []
          : ordem.status === "cancelada" || ordem.status === "concluida"
            ? [
                {
                  rotulo: "Reabrir",
                  icone: RotateCcw,
                  ao: async () => {
                    const motivo = await pedirMotivo({
                      titulo: "Reabrir esta ordem?",
                      texto: "Ela volta para a fila como pendente e perde a distribuição atual.",
                      confirmar: "Reabrir",
                      destrutivo: false,
                      motivo: "Motivo da reabertura",
                    });
                    if (motivo !== null)
                      await executar("Ordem reaberta.", () => OrdensService.reabrir(ordem, motivo));
                  },
                },
              ]
            : [cancelar]),
        // a equipe pode excluir mesmo liquidada — o estorno é feito na hora
        excluir,
      ];

  return (
    <div className={cn("relative", className)}>
      {dialogo}
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            setAberto((v) => !v);
          },
        })}
        aria-label={`Ações da ordem ${ordem.codigo}`}
        aria-expanded={aberto}
        className="press inline-flex size-9 items-center justify-center border border-border text-muted-foreground hover:border-primary hover:text-primary"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>

      <AnimatePresence>
        {aberto && (
          <FloatingPortal>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="z-[70]"
              {...getFloatingProps()}
            >
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: EASE }}
                className="z-[70] w-52 border border-border-strong bg-surface shadow-cromo"
              >
                {acoes.map((a) => (
                  <button
                    key={a.rotulo}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAberto(false);
                      void a.ao();
                    }}
                    className={cn(
                      "press flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors",
                      a.perigo
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
                    )}
                  >
                    <a.icone className="size-3.5 shrink-0" aria-hidden />
                    {a.rotulo}
                  </button>
                ))}
              </motion.div>
            </div>
          </FloatingPortal>
        )}
      </AnimatePresence>

      <ModalCancelamentoLocadora
        ordem={cancelandoLocadora ? ordem : null}
        aberto={cancelandoLocadora}
        aoFechar={() => setCancelandoLocadora(false)}
      />

      {equipe && (
        <ModalTransferirAgente
          ordem={ordem}
          aberto={transferindo}
          aoFechar={() => setTransferindo(false)}
        />
      )}
    </div>
  );
}
