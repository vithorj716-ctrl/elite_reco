/**
 * Fonte única de dados da aplicação: carrega o estado da operação do banco e
 * mantém tudo sincronizado em tempo real para todos os usuários conectados.
 *
 * Pontos críticos de confiabilidade tratados aqui:
 * - o canal Realtime é reaberto automaticamente quando cai (erro, timeout,
 *   suspensão do aparelho ou troca de rede) — antes disso, o app parava de
 *   receber eventos em silêncio até alguém recarregar a página;
 * - o token do socket é renovado quando a sessão renova, senão o servidor
 *   passa a descartar os eventos protegidos por RLS;
 * - invalidação granular: quando uma tabela muda, só revalidamos a entidade
 *   correspondente, não o snapshot inteiro, reduzindo o tráfego em ambiente
 *   multiusuário. O snapshot ["banco"] ainda é refeito para manter consistência.
 *
 * Fluxo de dados:
 *
 * ```text
 * ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 * │   Tela /    │────▶│   Service   │────▶│  Supabase   │
 * │   Service   │     │  (escrita)  │     │  (Postgres) │
 * └─────────────┘     └─────────────┘     └──────┬──────┘
 *       ▲                                        │
 *       │                                        │ Realtime
 *       │                                   ┌────▼──────┐
 *       │                                   │ Provedor  │
 *       │        invalidateQueries          │  Dados    │
 *       └───────────────────────────────────│ (TanStack)│
 *                                           └───────────┘
 * ```
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { BANCO_VAZIO, TABELAS_REALTIME, carregarBanco } from "@/domain/repositories/banco.repo";
import { paraFoto } from "@/domain/entities/mapeadores";
import type { Banco, Foto } from "@/domain/types";

export const CHAVE_BANCO = ["banco"] as const;

/** Chaves de cache para cada entidade monitorada. */
export const CHAVE_ENTIDADE: Record<(typeof TABELAS_REALTIME)[number], readonly string[]> = {
  locadoras: ["locadoras"],
  agentes: ["agentes"],
  profiles: ["usuarios"],
  user_roles: ["usuarios"],
  ordens: ["ordens"],
  ordem_fotos: ["fotos"],
  ordem_historico: ["historico"],
  importacoes: ["importacoes"],
  servicos: ["servicos"],
  agente_documentos: ["documentos"],
  pagamentos_agente: ["pagamentos"],
  ordem_evidencias: ["evidencias"],
  ordem_cobrancas: ["cobrancas"],
  locadora_apelidos: ["apelidos"],
  tabelas_remuneracao: ["tabelas"],
  itens_remuneracao: ["itens"],
  lancamentos_agente: ["lancamentos"],
  configuracoes: ["configuracoes"],
  auditoria: ["auditoria"],
  notificacoes: ["notificacoes"],
  cancelamentos_ordem: ["cancelamentos"],
  motos: ["motos"],
  vistorias: ["vistorias"],
  vistoria_evidencias: ["evidenciasVistoria"],
  vistoria_historico: ["historicoVistoria"],
  vistoria_checklist_itens: ["catalogoChecklist"],
  vistoria_itens: ["itensVistoria"],
  vistoria_avarias: ["avariasVistoria"],
  distribuicoes: ["distribuicoes"],
  distribuicao_eventos: ["eventosDistribuicao"],
};

interface EstadoDados {
  banco: Banco;
  carregando: boolean;
  erro: string | null;
  /** Verdadeiro quando o canal de tempo real está ativo. */
  aoVivo: boolean;
  /** Revalida todo o snapshot ou uma entidade específica. */
  sincronizar: (entidade?: EntidadeSincronizavel | EntidadeSincronizavel[]) => void;
}

/** Entidades que podem ser revalidadas individualmente. */
export type EntidadeSincronizavel = keyof typeof CHAVE_ENTIDADE;

const Ctx = createContext<EstadoDados | null>(null);

export function ProvedorDados({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [aoVivo, setAoVivo] = useState(false);

  const consulta = useQuery({
    queryKey: CHAVE_BANCO,
    queryFn: carregarBanco,
    enabled: ativo,
    // As atualizações são orientadas por eventos do Realtime; não há polling.
    staleTime: 10_000,
    gcTime: 10 * 60_000,
    retry: 3,
    retryDelay: (t) => Math.min(4000, 400 * 2 ** t),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: false,
  });

  useEffect(() => {
    if (!ativo) {
      setAoVivo(false);
      return;
    }

    let ativoEfeito = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let pendente: ReturnType<typeof setTimeout> | null = null;
    let religar: ReturnType<typeof setTimeout> | null = null;
    let tentativas = 0;

    const revalidar = (tabela?: (typeof TABELAS_REALTIME)[number], imediato = false) => {
      if (pendente) clearTimeout(pendente);
      pendente = setTimeout(
        () => {
          if (tabela) {
            // Invalidação cirúrgica: só a entidade que mudou é marcada como stale.
            void queryClient.invalidateQueries({ queryKey: CHAVE_ENTIDADE[tabela] });
          }
          // Sempre invalida o snapshot global para manter useBanco() consistente.
          void queryClient.invalidateQueries({ queryKey: CHAVE_BANCO });
        },
        imediato ? 0 : 200,
      );
    };

    const abrir = () => {
      if (!ativoEfeito) return;
      canal = supabase.channel(`operacao-${Math.random().toString(36).slice(2)}`, {
        config: { broadcast: { ack: false } },
      });
      for (const tabela of TABELAS_REALTIME) {
        canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, () =>
          revalidar(tabela),
        );
      }
      canal.subscribe((status) => {
        if (!ativoEfeito) return;
        if (status === "SUBSCRIBED") {
          tentativas = 0;
          setAoVivo(true);
          // Qualquer alteração ocorrida enquanto o canal estava fora do ar.
          revalidar(undefined, true);
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setAoVivo(false);
          if (religar) clearTimeout(religar);
          const espera = Math.min(10_000, 700 * 2 ** tentativas);
          tentativas += 1;
          religar = setTimeout(() => {
            if (canal) void supabase.removeChannel(canal);
            canal = null;
            abrir();
          }, espera);
        }
      });
    };

    abrir();

    // Sessão renovada: o socket precisa do token novo, senão o servidor deixa
    // de entregar as linhas protegidas por RLS.
    const { data: inscricao } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "TOKEN_REFRESHED" || evento === "SIGNED_IN") {
        void supabase.realtime.setAuth(sessao?.access_token ?? null);
      }
    });

    // Aparelho voltou do bolso / aba reativada: confere o estado na hora.
    const aoVoltar = () => {
      if (document.visibilityState === "visible") revalidar(undefined, true);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", aoVoltar);

    return () => {
      ativoEfeito = false;
      if (pendente) clearTimeout(pendente);
      if (religar) clearTimeout(religar);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
      inscricao.subscription.unsubscribe();
      if (canal) void supabase.removeChannel(canal);
      setAoVivo(false);
    };
  }, [ativo, queryClient]);

  const valor = useMemo<EstadoDados>(
    () => ({
      banco: { ...BANCO_VAZIO, ...(consulta.data ?? {}) },
      carregando: consulta.isPending && ativo,
      erro: consulta.error ? (consulta.error as Error).message : null,
      aoVivo,
      sincronizar: (entidades) => {
        const lista = entidades ? (Array.isArray(entidades) ? entidades : [entidades]) : [];
        for (const entidade of lista) {
          void queryClient.invalidateQueries({ queryKey: CHAVE_ENTIDADE[entidade] });
        }
        void queryClient.invalidateQueries({ queryKey: CHAVE_BANCO });
      },
    }),
    [consulta.data, consulta.isPending, consulta.error, ativo, aoVivo, queryClient],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDados(): EstadoDados {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDados precisa estar dentro de ProvedorDados");
  return ctx;
}

/** Estado completo da operação, já sincronizado entre todos os usuários. */
export function useBanco(): Banco {
  return useDados().banco;
}

/**
 * Revalida o estado após uma escrita.
 * Sem argumento, refaz o snapshot global. Com uma ou mais entidades,
 * invalida apenas essas entidades e o snapshot, mantendo outros caches quentes.
 */
export function useSincronizar() {
  const queryClient = useQueryClient();
  return (entidades?: EntidadeSincronizavel | EntidadeSincronizavel[]) => {
    const lista = entidades ? (Array.isArray(entidades) ? entidades : [entidades]) : [];
    for (const entidade of lista) {
      void queryClient.invalidateQueries({ queryKey: CHAVE_ENTIDADE[entidade] });
    }
    void queryClient.invalidateQueries({ queryKey: CHAVE_BANCO });
  };
}

const VAZIO: Foto[] = [];

/**
 * Fotos (com a imagem) apenas da ordem aberta. Carregar todas as imagens do
 * sistema de uma vez travava a sincronização inteira.
 */
export function useFotosDaOrdem(ordemId: string | undefined) {
  const banco = useBanco();
  // A lista de metadados vem do estado global em tempo real; quando ela muda,
  // esta consulta é refeita e traz a imagem nova.
  const assinatura = useMemo(
    () =>
      banco.fotos
        .filter((f) => f.ordemId === ordemId)
        .map((f) => f.id)
        .join(","),
    [banco.fotos, ordemId],
  );

  const consulta = useQuery({
    queryKey: ["fotos-ordem", ordemId, assinatura],
    enabled: Boolean(ordemId) && assinatura.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 15 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordem_fotos")
        .select("*")
        .eq("ordem_id", ordemId!)
        .order("criada_em");
      conferirErro(error, "sincronização");
      return (data ?? []).map(paraFoto);
    },
  });

  const anterior = useRef<Foto[]>(VAZIO);
  if (consulta.data) anterior.current = consulta.data;
  if (assinatura.length === 0) anterior.current = VAZIO;
  return { fotos: consulta.data ?? anterior.current, carregando: consulta.isPending && !!ordemId };
}
