import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/lib/sessao";
import { tutorialInicial, tutorialPorId } from "./passos";
import type { ModoTutorial, PassoTutorial, Tutorial } from "./tipos";

const CHAVE = "elite:tutorial:v1";

/** Cache local por conta — evita piscar o convite enquanto o perfil carrega. */
function chaveDe(usuarioId?: string) {
  return usuarioId ? `${CHAVE}:${usuarioId}` : CHAVE;
}

interface Preferencias {
  /** Usuário já viu (ou pulou) a apresentação de primeiro acesso. */
  apresentado?: boolean;
  concluidos?: string[];
  /** Onde parou, por tutorial. */
  progresso?: Record<string, number>;
}

function ler(usuarioId?: string): Preferencias {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(chaveDe(usuarioId)) || "{}") as Preferencias;
  } catch {
    return {};
  }
}

function gravar(p: Preferencias, usuarioId?: string) {
  try {
    window.localStorage.setItem(chaveDe(usuarioId), JSON.stringify(p));
  } catch {
    /* armazenamento indisponível: o tutorial continua funcionando sem memória */
  }
}

interface Ctx {
  tutorial?: Tutorial;
  passo?: PassoTutorial;
  indice: number;
  total: number;
  modo: ModoTutorial;
  ativo: boolean;
  centralAberta: boolean;
  boasVindasAberta: boolean;
  progressoDe: (id: string) => number;
  concluido: (id: string) => boolean;
  abrirCentral: () => void;
  fecharCentral: () => void;
  iniciar: (id: string, opcoes?: { retomar?: boolean; modo?: ModoTutorial }) => void;
  proximo: () => void;
  anterior: () => void;
  irPara: (i: number) => void;
  sair: () => void;
  dispensarBoasVindas: () => void;
}

const TutorialCtx = createContext<Ctx | null>(null);

export function useTutorialOpcional() {
  return useContext(TutorialCtx);
}

export function useTutorial() {
  const ctx = useContext(TutorialCtx);
  if (!ctx) throw new Error("useTutorial precisa do ProvedorTutorial");
  return ctx;
}

export function ProvedorTutorial({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useSessao();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [prefs, setPrefs] = useState<Preferencias>({});
  const [tutorial, setTutorial] = useState<Tutorial | undefined>();
  const [indice, setIndice] = useState(0);
  const [modo, setModo] = useState<ModoTutorial>("interativo");
  const [centralAberta, setCentral] = useState(false);
  const [boasVindasAberta, setBoasVindas] = useState(false);
  const hidratado = useRef(false);
  const usuarioId = usuario?.id;

  /** Hidrata o cache local da conta e confirma no servidor se já foi apresentado. */
  useEffect(() => {
    hidratado.current = false;
    if (!usuarioId) {
      setPrefs({});
      return;
    }
    let vivo = true;
    const local = ler(usuarioId);
    setPrefs(local);
    void supabase
      .from("profiles")
      .select("tutorial_apresentado_em")
      .eq("id", usuarioId)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        if (data?.tutorial_apresentado_em) {
          setPrefs((p) => {
            const novo = { ...p, apresentado: true };
            gravar(novo, usuarioId);
            return novo;
          });
        }
        hidratado.current = true;
      });
    return () => {
      vivo = false;
    };
  }, [usuarioId]);

  const marcarApresentadoNoServidor = useCallback(() => {
    if (!usuarioId) return;
    void supabase
      .from("profiles")
      .update({ tutorial_apresentado_em: new Date().toISOString() })
      .eq("id", usuarioId)
      .then(() => undefined);
  }, [usuarioId]);

  const salvar = useCallback(
    (mudanca: (p: Preferencias) => Preferencias) => {
      setPrefs((atual) => {
        const novo = mudanca(atual);
        gravar(novo, usuarioId);
        return novo;
      });
    },
    [usuarioId],
  );

  /** Primeiro acesso: convite curto, uma única vez por conta. */
  useEffect(() => {
    if (!hidratado.current || carregando || !usuario) return;
    if (prefs.apresentado) return;
    if (pathname === "/entrar" || pathname === "/") return;
    const t = setTimeout(() => setBoasVindas(true), 900);
    return () => clearTimeout(t);
  }, [carregando, usuario, prefs.apresentado, pathname]);

  const passo = tutorial?.passos[indice];
  const total = tutorial?.passos.length ?? 0;

  /** Navegação automática: o passo manda, a rota obedece. */
  useEffect(() => {
    if (!tutorial || !passo?.rota) return;
    if (pathname === passo.rota) return;
    void navigate({ to: passo.rota });
  }, [tutorial, passo, pathname, navigate]);

  const iniciar = useCallback<Ctx["iniciar"]>(
    (id, opcoes) => {
      const alvo = tutorialPorId(id);
      if (!alvo) return;
      setCentral(false);
      setBoasVindas(false);
      setModo(opcoes?.modo ?? "interativo");
      const salvo = opcoes?.retomar ? (prefs.progresso?.[id] ?? 0) : 0;
      setIndice(Math.min(salvo, alvo.passos.length - 1));
      setTutorial(alvo);
      salvar((p) => ({ ...p, apresentado: true }));
      marcarApresentadoNoServidor();
    },
    [prefs.progresso, salvar, marcarApresentadoNoServidor],
  );

  const guardarProgresso = useCallback(
    (id: string, i: number) => salvar((p) => ({ ...p, progresso: { ...p.progresso, [id]: i } })),
    [salvar],
  );

  const sair = useCallback(() => {
    if (tutorial) guardarProgresso(tutorial.id, indice);
    setTutorial(undefined);
    setModo("interativo");
  }, [tutorial, indice, guardarProgresso]);

  const proximo = useCallback(() => {
    if (!tutorial) return;
    if (indice >= tutorial.passos.length - 1) {
      salvar((p) => ({
        ...p,
        apresentado: true,
        concluidos: Array.from(new Set([...(p.concluidos ?? []), tutorial.id])),
        progresso: { ...p.progresso, [tutorial.id]: 0 },
      }));
      setTutorial(undefined);
      setModo("interativo");
      return;
    }
    const i = indice + 1;
    setIndice(i);
    guardarProgresso(tutorial.id, i);
  }, [tutorial, indice, guardarProgresso, salvar]);

  const anterior = useCallback(() => {
    if (!tutorial || indice === 0) return;
    const i = indice - 1;
    setIndice(i);
    guardarProgresso(tutorial.id, i);
  }, [tutorial, indice, guardarProgresso]);

  const irPara = useCallback(
    (i: number) => {
      if (!tutorial) return;
      const alvo = Math.max(0, Math.min(i, tutorial.passos.length - 1));
      setIndice(alvo);
      guardarProgresso(tutorial.id, alvo);
    },
    [tutorial, guardarProgresso],
  );

  /** Modo demonstração: avança sozinho, sem tocar em dado real. */
  useEffect(() => {
    if (!tutorial || modo !== "demonstracao") return;
    const t = setTimeout(proximo, 4200);
    return () => clearTimeout(t);
  }, [tutorial, modo, indice, proximo]);

  /** Teclado: ESC sai, setas navegam. */
  useEffect(() => {
    if (!tutorial) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        sair();
      } else if (e.key === "ArrowRight") {
        proximo();
      } else if (e.key === "ArrowLeft") {
        anterior();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [tutorial, sair, proximo, anterior]);

  const valor = useMemo<Ctx>(
    () => ({
      ...(tutorial ? { tutorial } : {}),
      ...(passo ? { passo } : {}),
      indice,
      total,
      modo,
      ativo: Boolean(tutorial),
      centralAberta,
      boasVindasAberta,
      progressoDe: (id) => prefs.progresso?.[id] ?? 0,
      concluido: (id) => Boolean(prefs.concluidos?.includes(id)),
      abrirCentral: () => {
        setBoasVindas(false);
        setCentral(true);
      },
      fecharCentral: () => setCentral(false),
      iniciar,
      proximo,
      anterior,
      irPara,
      sair,
      dispensarBoasVindas: () => {
        setBoasVindas(false);
        salvar((p) => ({ ...p, apresentado: true }));
        marcarApresentadoNoServidor();
      },
    }),
    [
      tutorial,
      passo,
      indice,
      total,
      modo,
      centralAberta,
      boasVindasAberta,
      prefs,
      iniciar,
      proximo,
      anterior,
      irPara,
      sair,
      salvar,
      marcarApresentadoNoServidor,
    ],
  );

  return <TutorialCtx.Provider value={valor}>{children}</TutorialCtx.Provider>;
}

export { tutorialInicial };
