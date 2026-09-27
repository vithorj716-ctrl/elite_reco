/**
 * Central de notificações — sino com contador, painel em tempo real,
 * som de alerta e permissão nativa de push.
 */
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  CheckCheck,
  Package,
  PencilLine,
  Trash2,
  Truck,
} from "lucide-react";
import { EASE } from "@/lib/animacao";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { NotificacoesService } from "@/services/notificacoes.service";
import {
  ativarPush,
  desativarPush,
  estadoPush,
  inscricaoAtiva,
  sincronizarPush,
  tocarAlerta,
  vibrar,
  type EstadoPush,
} from "@/lib/push";
import type { Notificacao, TipoNotificacao } from "@/domain/types";
import { cn } from "@/lib/utils";

const ICONE: Record<TipoNotificacao, typeof Bell> = {
  nova_ordem: Package,
  alteracao: PencilLine,
  cancelamento: AlertTriangle,
  status: Truck,
  financeiro: CheckCheck,
  operacional: Bell,
};

const COR: Record<TipoNotificacao, string> = {
  nova_ordem: "text-primary",
  alteracao: "text-warning",
  cancelamento: "text-destructive",
  status: "text-success",
  financeiro: "text-success",
  operacional: "text-muted-foreground",
};

function quando(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "agora";
  }
}

export function SinoNotificacoes() {
  const { usuario } = useSessao();
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [permissao, setPermissao] = useState<EstadoPush>("indisponivel");
  const vistos = useRef<Set<string> | null>(null);

  const { refs, floatingStyles, context } = useFloating({
    open: aberto,
    onOpenChange: setAberto,
    placement: "bottom-end",
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useDismiss(context, { outsidePress: true }),
    useRole(context, { role: "menu" }),
  ]);

  /* Estado real do aparelho: permissão + inscrição válida no PushManager.
     Revalida a inscrição a cada abertura (o endpoint pode ter sido renovado). */
  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    void (async () => {
      const base = estadoPush();
      if (base === "concedida") {
        await sincronizarPush(usuario.id, usuario.agenteId);
        if (vivo && (await inscricaoAtiva())) {
          setPermissao("inscrito");
          return;
        }
      }
      if (vivo) setPermissao(base);
    })();

    const ouvir = (evento: MessageEvent) => {
      const dado = evento.data as
        | { tipo?: string; aviso?: { titulo?: string; mensagem?: string; url?: string } }
        | undefined;
      if (dado?.tipo === "push-reinscrever") {
        void sincronizarPush(usuario.id, usuario.agenteId);
        return;
      }
      if (dado?.tipo === "push-recebido" && dado.aviso) {
        tocarAlerta();
        vibrar();
        toast(dado.aviso.titulo ?? "Recolhe", {
          description: dado.aviso.mensagem ?? "Você tem uma novidade na operação.",
          action: dado.aviso.url
            ? {
                label: "Abrir",
                onClick: () => {
                  window.location.assign(dado.aviso?.url ?? "/");
                },
              }
            : undefined,
        });
      }
    };
    navigator.serviceWorker?.addEventListener?.("message", ouvir);
    return () => {
      vivo = false;
      navigator.serviceWorker?.removeEventListener?.("message", ouvir);
    };
  }, [usuario?.id, usuario?.agenteId]);


  const lista = useMemo(
    () =>
      banco.notificacoes
        .filter((n) => n.usuarioId === usuario?.id)
        .slice()
        .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)),
    [banco.notificacoes, usuario?.id],
  );

  const naoLidas = lista.filter((n) => !n.lida);

  /** Alerta sonoro + toast quando chega algo novo com o app aberto. */
  useEffect(() => {
    if (!usuario) return;
    if (vistos.current === null) {
      vistos.current = new Set(lista.map((n) => n.id));
      return;
    }
    const novas = lista.filter((n) => !vistos.current!.has(n.id));
    for (const n of novas) vistos.current.add(n.id);
    const relevantes = novas.filter((n) => !n.lida);
    if (relevantes.length === 0) return;
    tocarAlerta();
    vibrar();
    for (const n of relevantes.slice(0, 3)) {
      toast(n.titulo, {
        description: n.mensagem,
        action: n.ordemId
          ? {
              label: "Abrir",
              onClick: () => void abrirOrdem(n),
            }
          : undefined,
      });
    }
  }, [lista, usuario]);

  if (!usuario) return null;

  async function abrirOrdem(n: Notificacao) {
    setAberto(false);
    if (!n.lida) {
      await NotificacoesService.marcarLida(n.id).catch(() => {});
      sincronizar("notificacoes");
    }
    if (!n.ordemId) return;
    const rota = usuario!.papel === "agente" ? "/agente/$id" : "/ordens/$id";
    void navigate({ to: rota, params: { id: n.ordemId } });
  }

  async function marcarTodas() {
    try {
      await NotificacoesService.marcarTodasLidas(naoLidas.map((n) => n.id));
      sincronizar("notificacoes");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function limpar() {
    try {
      await NotificacoesService.limparLidas(usuario!.id);
      sincronizar("notificacoes");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function pedirPermissao() {
    const estado = await ativarPush(usuario!.id, usuario!.agenteId);
    setPermissao(estado);
    if (estado === "inscrito") toast.success("Avisos ativados neste aparelho, mesmo com o app fechado.");
    if (estado === "concedida")
      toast.success("Avisos ativados. Instale o app na tela inicial para receber com ele fechado.");
    if (estado === "negada")
      toast.error("Permissão negada. Libere as notificações nas configurações do navegador.");
  }

  async function desligarAvisos() {
    await desativarPush();
    setPermissao(estadoPush());
    toast.success("Avisos desligados neste aparelho.");
  }


  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${naoLidas.length ? ` (${naoLidas.length} não lidas)` : ""}`}
        className="press relative grid size-9 place-items-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <motion.span
          key={naoLidas.length}
          animate={naoLidas.length > 0 ? { rotate: [0, -14, 12, -8, 0] } : { rotate: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="grid place-items-center"
        >
          {naoLidas.length > 0 ? (
            <BellRing className="size-[18px] text-primary" />
          ) : (
            <Bell className="size-[18px]" />
          )}
        </motion.span>
        <AnimatePresence>
          {naoLidas.length > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className="absolute right-0.5 top-0.5 grid min-w-[16px] place-items-center bg-primary px-1 font-mono text-[10px] leading-4 text-primary-foreground"
            >
              {naoLidas.length > 99 ? "99+" : naoLidas.length}
            </motion.span>
          )}
        </AnimatePresence>
        {naoLidas.length > 0 && (
          <span className="absolute inset-0 -z-10 animate-ping bg-primary/10" aria-hidden />
        )}
      </button>

      <FloatingPortal>
        <AnimatePresence>
          {aberto && (
            <div ref={refs.setFloating} style={floatingStyles} className="z-50">
            <motion.div
              {...getFloatingProps()}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16, ease: EASE }}
              className="z-50 w-[min(92vw,380px)] border border-border bg-surface shadow-2xl"
            >
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                <span className="label-caps">Notificações</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {naoLidas.length} não lidas
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {naoLidas.length > 0 && (
                    <button
                      onClick={() => void marcarTodas()}
                      className="press font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-primary"
                    >
                      marcar lidas
                    </button>
                  )}
                  <button
                    onClick={() => void limpar()}
                    aria-label="Limpar notificações lidas"
                    className="press text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {permissao === "inscrito" ? (
                <div className="flex items-center gap-2 border-b border-border bg-surface-raised px-4 py-2.5 text-[12px] text-muted-foreground">
                  <BellRing className="size-3.5 text-success" />
                  Avisos ativos neste aparelho, mesmo com o app fechado.
                  <button
                    onClick={() => void desligarAvisos()}
                    className="press ml-auto font-mono text-[10px] uppercase tracking-[0.14em] hover:text-destructive"
                  >
                    desligar
                  </button>
                </div>
              ) : (
                permissao !== "indisponivel" && (
                  <button
                    onClick={() => void pedirPermissao()}
                    className="press flex w-full items-center gap-2 border-b border-border bg-surface-raised px-4 py-2.5 text-left text-[12px] text-foreground"
                  >
                    <BellOff className="size-3.5 text-primary" />
                    {permissao === "negada"
                      ? "Notificações bloqueadas — libere no navegador para receber avisos."
                      : "Ativar avisos no celular mesmo com o app fechado"}
                  </button>
                )
              )}


              <ul className="max-h-[62vh] overflow-y-auto">
                {lista.length === 0 && (
                  <li className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">
                    Nenhuma notificação por aqui.
                  </li>
                )}
                {lista.map((n, i) => {
                  const Icone = ICONE[n.tipo] ?? Bell;
                  return (
                    <motion.li
                      key={n.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, ease: EASE, delay: Math.min(i * 0.02, 0.2) }}
                      className={cn(
                        "border-b border-border/60 last:border-b-0",
                        !n.lida && "bg-primary/[0.04]",
                      )}
                    >
                      <div className="flex items-start gap-3 px-4 py-3">
                        <Icone className={cn("mt-0.5 size-4 shrink-0", COR[n.tipo])} />
                        <button
                          onClick={() => void abrirOrdem(n)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-[13px] font-medium text-foreground">
                            {n.titulo}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted-foreground">{n.mensagem}</p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                            {quando(n.criadaEm)}
                          </p>
                        </button>
                        {!n.lida && <span className="mt-1.5 size-1.5 shrink-0 bg-primary" />}
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>
            </div>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </>
  );
}
