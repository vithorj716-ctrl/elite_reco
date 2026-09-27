import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart3,
  Bike,
  Brain,
  ChevronRight,
  Command as CommandIcon,
  FileSpreadsheet,
  Gauge,
  Building2,
  KeyRound,
  ListChecks,
  ClipboardCheck,
  LogOut,
  Menu,
  Radio,
  Route as RouteIcon,
  ShieldCheck,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Dica } from "@/components/app/dica";
import { Logo, MarcaCompleta } from "@/components/app/marca";
import { Paleta, type AcaoPaleta } from "@/components/app/paleta";
import { BotaoInstalar } from "@/components/app/instalar-app";
import { SinoNotificacoes } from "@/components/app/notificacoes";
import { ProvedorTutorial } from "@/lib/tutorial/contexto";
import {
  BoasVindasTutorial,
  BotaoTutorial,
  CentralTutoriais,
} from "@/components/app/tutorial/central";
import { PalcoTutorial } from "@/components/app/tutorial/palco";
import { AvatarAgente } from "@/components/negocio/foto-agente";
import { ProvedorPresenca } from "@/lib/presenca";
import { EASE, transicao, varItem, varLista } from "@/lib/animacao";
import { useBanco, useSessao } from "@/lib/sessao";
import type { Papel } from "@/domain/types";
import { cn } from "@/lib/utils";

interface ItemMenu {
  para: string;
  rotulo: string;
  icone: typeof Gauge;
  papeis: Papel[];
  grupo: "Operação" | "Vistorias" | "Cadastros" | "Gestão";
}

const MENU: ItemMenu[] = [
  {
    para: "/operacao",
    rotulo: "Operação do dia",
    icone: Radio,
    papeis: ["super_admin", "operador"],
    grupo: "Operação",
  },
  {
    para: "/dashboard",
    rotulo: "Painel",
    icone: Gauge,
    papeis: ["super_admin", "operador"],
    grupo: "Operação",
  },
  {
    para: "/distribuicao",
    rotulo: "Distribuição automática",
    icone: Radio,
    papeis: ["super_admin", "operador"],
    grupo: "Operação",
  },
  {
    para: "/ordens",
    rotulo: "Fila de recolhimentos",
    icone: ListChecks,
    papeis: ["super_admin", "operador"],
    grupo: "Operação",
  },
  {
    para: "/importador",
    rotulo: "Importador inteligente",
    icone: Brain,
    papeis: ["super_admin", "operador", "cliente"],
    grupo: "Operação",
  },
  {
    para: "/importacoes",
    rotulo: "Importações",
    icone: FileSpreadsheet,
    papeis: ["super_admin", "operador", "cliente"],
    grupo: "Operação",
  },
  {
    para: "/agente",
    rotulo: "Minhas capturas",
    icone: RouteIcon,
    papeis: ["agente"],
    grupo: "Operação",
  },
  {
    para: "/agente/financeiro",
    rotulo: "Meu financeiro",
    icone: Wallet,
    papeis: ["agente"],
    grupo: "Operação",
  },

  {
    para: "/vistorias",
    rotulo: "Fila de vistorias",
    icone: ClipboardCheck,
    papeis: ["super_admin", "operador"],
    grupo: "Vistorias",
  },
  {
    para: "/vistorias/motos",
    rotulo: "Motos e prazos",
    icone: Bike,
    papeis: ["super_admin", "operador", "cliente"],
    grupo: "Vistorias",
  },
  {
    para: "/vistorias/checklist",
    rotulo: "Itens do checklist",
    icone: ListChecks,
    papeis: ["super_admin", "operador"],
    grupo: "Vistorias",
  },
  {
    para: "/agente/vistorias",
    rotulo: "Minhas vistorias",
    icone: ClipboardCheck,
    papeis: ["agente"],
    grupo: "Vistorias",
  },

  {
    para: "/portal",
    rotulo: "Minhas solicitações",
    icone: Bike,
    papeis: ["cliente"],
    grupo: "Operação",
  },
  {
    para: "/locadoras",
    rotulo: "Locadoras",
    icone: Building2,
    papeis: ["super_admin"],
    grupo: "Cadastros",
  },
  {
    para: "/agentes",
    rotulo: "Agentes",
    icone: UsersRound,
    papeis: ["super_admin", "operador"],
    grupo: "Cadastros",
  },
  {
    para: "/usuarios",
    rotulo: "Usuários e acessos",
    icone: KeyRound,
    papeis: ["super_admin"],
    grupo: "Cadastros",
  },
  {
    para: "/financeiro",
    rotulo: "Financeiro",
    icone: Wallet,
    papeis: ["super_admin"],
    grupo: "Gestão",
  },
  {
    para: "/relatorios",
    rotulo: "Relatórios",
    icone: BarChart3,
    papeis: ["super_admin", "operador"],
    grupo: "Gestão",
  },
];

const ROTULO_PAPEL: Record<Papel, string> = {
  super_admin: "Super administrador",
  operador: "Operador",
  cliente: "Locadora",
  agente: "Agente de campo",
};

const GRUPOS = ["Operação", "Vistorias", "Cadastros", "Gestão"] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { usuario, sair } = useSessao();
  const banco = useBanco();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [aberto, setAberto] = useState(false);
  const [perfil, setPerfil] = useState(false);
  const fotoAgente = usuario?.agenteId
    ? banco.agentes.find((a) => a.id === usuario.agenteId)?.foto || undefined
    : undefined;

  const itens = useMemo(
    () => (usuario ? MENU.filter((i) => i.papeis.includes(usuario.papel)) : []),
    [usuario],
  );

  const acoes: AcaoPaleta[] = useMemo(
    () => itens.map((i) => ({ para: i.para, rotulo: i.rotulo, grupo: i.grupo })),
    [itens],
  );

  if (!usuario) return null;

  const encerrar = async () => {
    await sair();
    void navigate({ to: "/entrar", replace: true });
  };

  /** Contadores discretos que dão leitura da fila sem abrir a tela. */
  function contador(para: string): number | null {
    if (para === "/operacao")
      return (
        banco.ordens.filter(
          (o) =>
            o.status === "pendente_definicao" ||
            o.status === "liberada" ||
            o.status === "em_andamento",
        ).length ||
        null
      );
    if (para === "/ordens")
      return (
        banco.ordens.filter(
          (o) => o.status === "pendente_definicao" || o.status === "liberada",
        ).length || null
      );
    if (para === "/agente")
      return (
        banco.ordens.filter(
          (o) =>
            o.agenteId === usuario!.agenteId &&
            (o.status === "distribuida" || o.status === "em_andamento"),
        ).length || null
      );
    return null;
  }

  const nav = (
    <motion.nav
      variants={varLista(0.03)}
      initial="inicial"
      animate="animar"
      aria-label="Navegação principal"
      className="flex flex-col gap-4"
    >
      {GRUPOS.map((grupo) => {
        const doGrupo = itens.filter((i) => i.grupo === grupo);
        if (doGrupo.length === 0) return null;
        return (
          <div key={grupo}>
            <p className="label-caps px-3 pb-1.5">{grupo}</p>
            <div className="flex flex-col gap-0.5">
              {doGrupo.map((item) => {
                // Um item filho (ex.: /agente/financeiro) não pode deixar o pai aceso.
                const maisEspecifico = itens.some(
                  (outro) =>
                    outro.para !== item.para &&
                    outro.para.startsWith(item.para + "/") &&
                    (pathname === outro.para || pathname.startsWith(outro.para + "/")),
                );
                const ativo =
                  !maisEspecifico &&
                  (pathname === item.para || pathname.startsWith(item.para + "/"));

                const n = contador(item.para);
                return (
                  <motion.div key={item.para} variants={varItem}>
                    <Link
                      to={item.para}
                      onClick={() => setAberto(false)}
                      data-tour={`menu-${item.para}`}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(
                        "press risco-marca group relative flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium",
                        ativo
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      {ativo && (
                        <motion.span
                          layoutId="marcador-menu"
                          transition={transicao.padrao}
                          className="barra-ouro absolute left-0 top-0 h-full w-[2px]"
                        />
                      )}
                      <item.icone
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          ativo ? "text-primary" : "opacity-75 group-hover:text-cromo",
                        )}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="truncate">{item.rotulo}</span>
                      {n ? (
                        <span className="ml-auto min-w-5 border border-primary/40 px-1 text-center font-mono text-[10px] leading-4 text-primary">
                          {n}
                        </span>
                      ) : (
                        <ChevronRight
                          className="ml-auto size-3.5 opacity-0 transition-opacity group-hover:opacity-40"
                          aria-hidden
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </motion.nav>
  );

  const meuAgente = banco.agentes.find((a) => a.id === usuario.agenteId);

  return (
    <ProvedorPresenca agenteId={meuAgente?.id} online={meuAgente?.online ?? false}>
    <ProvedorTutorial>
    <div className="flex min-h-dvh">
      <a
        href="#conteudo"
        className="press sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:border focus:border-primary focus:bg-surface focus:px-3 focus:py-2 focus:text-[13px]"
      >
        Pular para o conteúdo
      </a>

      <Paleta acoes={acoes} />

      <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-5">
          <MarcaCompleta />
        </div>
        <div className="rolagem-y min-h-0 flex-1 px-3 pb-2 pt-4">{nav}</div>
        <Rodape
          usuario={{ nome: usuario.nome, papel: ROTULO_PAPEL[usuario.papel] }}
          foto={fotoAgente}
          aoSair={encerrar}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="app-topo sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:px-6">
          <motion.button
            onClick={() => setAberto((v) => !v)}
            whileTap={{ scale: 0.94 }}
            transition={transicao.rapida}
            className="press flex size-9 items-center justify-center border border-border text-muted-foreground hover:border-border-strong hover:text-foreground lg:hidden"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            aria-expanded={aberto}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={aberto ? "x" : "menu"}
                initial={{ opacity: 0, rotate: -60 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 60 }}
                transition={transicao.rapida}
                className="flex"
              >
                {aberto ? <X className="size-4" /> : <Menu className="size-4" />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
          <span className="lg:hidden">
            <Logo tamanho={22} />
          </span>
          <div className="hidden items-center gap-2 text-[13px] text-muted-foreground sm:flex">
            <ShieldCheck className="size-3.5 text-primary" aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              {ROTULO_PAPEL[usuario.papel]}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <BotaoTutorial />
            <SinoNotificacoes />
            <Dica texto="Navegação rápida (Ctrl+K)" posicao="bottom">
              <span className="hidden items-center gap-1.5 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:flex">
                <CommandIcon className="size-3" aria-hidden /> K
              </span>
            </Dica>
            <div className="relative">
              <AvatarAgente
                foto={fotoAgente}
                nome={usuario.nome}
                tamanho={34}
                aoClicar={() => setPerfil((v) => !v)}
              />
              <AnimatePresence>
                {perfil && (
                  <>
                    <button
                      aria-label="Fechar menu do perfil"
                      onClick={() => setPerfil(false)}
                      className="fixed inset-0 z-40 cursor-default"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={transicao.rapida}
                      className="absolute right-0 z-50 mt-2 w-60 border border-border-strong bg-surface p-3 shadow-cromo"
                    >
                      <div className="flex items-center gap-3">
                        <AvatarAgente foto={fotoAgente} nome={usuario.nome} tamanho={40} />
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[13px]">{usuario.nome}</p>
                          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {ROTULO_PAPEL[usuario.papel]}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-1 border-t border-border pt-2">
                        {itens.slice(0, 3).map((i) => (
                          <Link
                            key={i.para}
                            to={i.para}
                            onClick={() => setPerfil(false)}
                            className="press flex items-center gap-2 px-2 py-1.5 text-[13px] text-muted-foreground hover:text-foreground"
                          >
                            <i.icone className="size-3.5" aria-hidden /> {i.rotulo}
                          </Link>
                        ))}
                        <button
                          onClick={encerrar}
                          className="press flex items-center gap-2 px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:text-foreground"
                        >
                          <LogOut className="size-3.5" aria-hidden /> Sair
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <Dica texto="Encerrar sessão" posicao="bottom">
              <motion.button
                onClick={encerrar}
                whileTap={{ scale: 0.97 }}
                transition={transicao.rapida}
                className="press flex min-h-9 items-center gap-1.5 border border-border px-2.5 text-[12px] text-muted-foreground hover:border-primary/60 hover:text-foreground"
              >
                <LogOut className="size-3.5" aria-hidden />{" "}
                <span className="hidden sm:inline">Sair</span>
              </motion.button>
            </Dica>
          </div>
        </header>

        <AnimatePresence initial={false}>
          {aberto && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: EASE }}
              className="overflow-hidden border-b border-border bg-sidebar/90 backdrop-blur-md lg:hidden"
            >
              <div className="rolagem-y max-h-[60dvh] px-3 py-3">{nav}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <main id="conteudo" className="min-w-0 flex-1">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <BoasVindasTutorial />
      <CentralTutoriais />
      <AnimatePresence>{<PalcoTutorial />}</AnimatePresence>
    </div>
    </ProvedorTutorial>
    </ProvedorPresenca>
  );
}

function Rodape({
  usuario,
  foto,
  aoSair,
}: {
  usuario: { nome: string; papel: string };
  foto?: string | undefined;
  aoSair: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-sidebar-border p-3">
      <BotaoInstalar compacto className="mb-2" />
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <AvatarAgente foto={foto} nome={usuario.nome} tamanho={28} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[12px] text-foreground">{usuario.nome}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {usuario.papel}
          </p>
        </div>
        <button
          onClick={aoSair}
          className="press ml-auto text-muted-foreground hover:text-foreground"
          aria-label="Encerrar sessão"
        >
          <LogOut className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
