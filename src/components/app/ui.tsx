import { cva, type VariantProps } from "class-variance-authority";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, type ComponentType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BotaoTutorialDaTela } from "@/components/app/tutorial/central";
import {
  FundoAnimado,
  type IntensidadeFundo,
  type VarianteFundo,
} from "@/components/app/fundo-animado";
import { useFundoVideo } from "@/components/app/fundo-video";
import { transicao, varItem, varLista } from "@/lib/animacao";
import type { Prioridade, StatusOrdem } from "@/domain/types";
import { ROTULO_PRIORIDADE, ROTULO_STATUS } from "@/domain/types";

export const suave = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

export function Pagina({
  titulo,
  descricao,
  acoes,
  fundo,
  intensidadeFundo = "medium",
  children,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  /** Camada decorativa de fundo (opcional) — só nas telas onde faz sentido. */
  fundo?: VarianteFundo;
  intensidadeFundo?: IntensidadeFundo;
  children: ReactNode;
}) {
  // Telas com muitas tabelas/formulários (sem `fundo`) deixam o vídeo mais discreto.
  useFundoVideo(!fundo ? "baixa" : intensidadeFundo === "low" ? "baixa" : "media");

  return (
    <div
      data-tour="pagina"
      className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pb-12 pt-5 sm:px-6 lg:px-8"
    >
      {fundo && <FundoAnimado variante={fundo} intensidade={intensidadeFundo} />}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transicao.suave}
        className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-4"
      >
        <div className="relative min-w-0">
          <span className="barra-ouro absolute -left-4 top-1 hidden h-[26px] w-[2px] lg:block" />
          <h1 className="truncate font-display text-xl uppercase tracking-[0.06em] text-cromo sm:text-2xl">
            {titulo}
          </h1>
          {descricao && <p className="mt-1 max-w-xl text-[13px] text-muted-foreground">{descricao}</p>}
        </div>
        <div data-tour="acoes-pagina" className="flex flex-wrap items-center gap-2 sm:justify-end">
          {acoes}
          <BotaoTutorialDaTela />
        </div>
      </motion.div>
      {children}
    </div>
  );
}

/** Painel/seção com cabeçalho — substitui "cards" genéricos. */
export function Secao({
  titulo,
  acao,
  children,
  className,
  padding = true,
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <section className={cn("border border-border bg-surface", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="label-caps truncate">{titulo}</p>
        {acao}
      </div>
      <div className={padding ? "p-4" : undefined}>{children}</div>
    </section>
  );
}

/** Campo de formulário rotulado, com foco e erro padronizados. */
export function Campo({
  rotulo,
  dica,
  erro,
  children,
  className,
}: {
  rotulo: string;
  dica?: string;
  erro?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label-caps">{rotulo}</span>
      <div className="mt-1.5">{children}</div>
      {erro ? (
        <motion.span
          initial={{ opacity: 0, y: -3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transicao.rapida}
          className="mt-1 block text-[11.5px] text-destructive"
        >
          {erro}
        </motion.span>
      ) : dica ? (
        <span className="mt-1 block text-[11.5px] text-muted-foreground">{dica}</span>
      ) : null}
    </label>
  );
}


/** Container com stagger — envolva listas/grades para entrada escalonada. */
export function Lista({
  children,
  intervalo = 0.045,
  className,
}: {
  children: ReactNode;
  intervalo?: number;
  className?: string;
}) {
  return (
    <motion.div variants={varLista(intervalo)} initial="inicial" animate="animar" className={className}>
      {children}
    </motion.div>
  );
}

export function ItemLista({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={varItem} className={className}>
      {children}
    </motion.div>
  );
}

const botao = cva(
  "press inline-flex items-center justify-center gap-2 text-[13px] font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
  {
    variants: {
      variante: {
        solido: "bg-primary text-primary-foreground hover:bg-primary/88 hover:shadow-ouro",
        linha: "border border-border-strong text-foreground hover:border-primary hover:text-primary",
        cromo: "barra-cromo font-semibold text-background hover:brightness-110",
        fantasma: "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
        perigo: "border border-destructive/50 text-destructive hover:bg-destructive/10",
      },
      tamanho: {
        sm: "min-h-8 px-2.5 py-1.5 text-[12px]",
        md: "min-h-9 px-3.5 py-2",
        lg: "min-h-11 px-5 py-2.5",
        icone: "size-9 shrink-0 p-0",
      },
    },
    defaultVariants: { variante: "solido", tamanho: "md" },
  },
);

export type PropsBotao = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof botao> & { carregando?: boolean };

export function Botao({ variante, tamanho, className, children, carregando, disabled, ...props }: PropsBotao) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(botao({ variante, tamanho }), carregando && "relative overflow-hidden", className)}
    >
      {carregando && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-current/20">
          <motion.span
            className="absolute inset-y-0 w-1/3 bg-current"
            animate={{ x: ["-110%", "320%"] }}
            transition={{ duration: 0.9, ease: "easeInOut", repeat: Infinity }}
          />
        </span>
      )}
      {children}
    </button>
  );
}

/** Abas horizontais padrão do sistema — indicador animado e contadores. */
export function Abas<T extends string>({
  valor,
  aoTrocar,
  itens,
  id = "abas",
  className,
}: {
  valor: T;
  aoTrocar: (v: T) => void;
  itens: Array<{ valor: T; rotulo: string; contador?: number }>;
  id?: string;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("rolagem-x flex items-center gap-1 border-b border-border", className)}>
      {itens.map((i) => {
        const ativa = valor === i.valor;
        return (
          <button
            key={i.valor}
            role="tab"
            aria-selected={ativa}
            onClick={() => aoTrocar(i.valor)}
            className={cn(
              "press relative whitespace-nowrap px-3 py-2 text-[13px]",
              ativa ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i.rotulo}
            {typeof i.contador === "number" && (
              <span
                className={cn(
                  "ml-1.5 font-mono text-[10px] tabular-nums",
                  ativa ? "text-primary" : "text-muted-foreground",
                )}
              >
                {i.contador}
              </span>
            )}
            {ativa && (
              <motion.span
                layoutId={`${id}-ativa`}
                transition={transicao.padrao}
                className="barra-ouro absolute inset-x-0 -bottom-px h-[2px]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Barra de filtros — mesma altura, mesmo espaçamento em todas as telas. */
export function BarraFiltros({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-tour="filtros"
      className={cn(
        "mt-4 flex flex-wrap items-center gap-2 border-l-2 border-l-border-strong bg-surface/40 py-2 pl-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Etiqueta neutra reutilizável (contagens, categorias, marcadores). */
export function Selo({
  children,
  tom = "neutro",
  className,
}: {
  children: ReactNode;
  tom?: "neutro" | "primario" | "sucesso" | "alerta" | "perigo" | "info";
  className?: string;
}) {
  const tons = {
    neutro: "text-muted-foreground border-border-strong",
    primario: "text-primary border-primary/50",
    sucesso: "text-success border-success/40",
    alerta: "text-warning border-warning/40",
    perigo: "text-destructive border-destructive/40",
    info: "text-info border-info/40",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.12em]",
        tons[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}



const CORES_STATUS: Record<StatusOrdem, string> = {
  pendente_definicao: "text-warning border-warning/40",
  liberada: "text-muted-foreground border-border-strong",
  distribuida: "text-info border-info/40",
  em_andamento: "text-primary border-primary/50",
  concluida: "text-success border-success/40",
  cancelada: "text-destructive border-destructive/40",
};

export function Status({ valor }: { valor: StatusOrdem }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.12em]",
        CORES_STATUS[valor],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ROTULO_STATUS[valor]}
    </span>
  );
}

const CORES_PRIORIDADE: Record<Prioridade, string> = {
  baixa: "text-muted-foreground",
  normal: "text-foreground",
  alta: "text-warning",
  urgente: "text-destructive",
};

export function Prioridade_({ valor }: { valor: Prioridade }) {
  return (
    <span className={cn("font-mono text-[11px] uppercase tracking-[0.1em]", CORES_PRIORIDADE[valor])}>
      {valor === "urgente" ? "▲ " : ""}
      {ROTULO_PRIORIDADE[valor]}
    </span>
  );
}

export function Vazio({
  titulo,
  texto,
  acao,
  icone: Icone,
  compacto,
}: {
  titulo: string;
  texto: string;
  acao?: ReactNode;
  icone?: ComponentType<{ className?: string }>;
  compacto?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transicao.lenta}
      className={cn(
        "grid-lines relative flex flex-col items-start gap-3 overflow-hidden border border-dashed border-border",
        compacto ? "px-5 py-8" : "px-8 py-14",
      )}
    >
      <span className="barra-ouro absolute left-0 top-0 h-[2px] w-16" />
      {Icone ? (
        <span className="flex size-11 items-center justify-center border border-border-strong text-border-strong">
          <Icone className="size-5" />
        </span>
      ) : (
        <p className="font-mono text-[52px] leading-none text-border-strong">∅</p>
      )}
      <h3 className={cn("font-display uppercase tracking-[0.08em] text-cromo", compacto ? "text-base" : "text-lg")}>
        {titulo}
      </h3>
      <p className="max-w-md text-[13px] text-muted-foreground">{texto}</p>
      {acao}
    </motion.div>
  );
}

/** Skeleton em grade — para blocos de métricas e painéis. */
export function EsqueletoBlocos({ blocos = 4, altura = 86 }: { blocos?: number; altura?: number }) {
  return (
    <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: blocos }).map((_, i) => (
        <div key={i} className="bg-surface p-4" style={{ height: altura }}>
          <div className="shimmer h-2.5 w-20" style={{ animationDelay: `${i * 90}ms` }} />
          <div className="shimmer mt-3 h-6 w-16" style={{ animationDelay: `${i * 120}ms` }} />
        </div>
      ))}
    </div>
  );
}


export function Esqueleto({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="divide-y divide-border border border-border" aria-hidden>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="shimmer h-3 w-20" style={{ animationDelay: `${i * 70}ms` }} />
          <div className="shimmer h-3 w-40" style={{ animationDelay: `${i * 100}ms` }} />
          <div className="shimmer ml-auto h-3 w-24" style={{ animationDelay: `${i * 130}ms` }} />
        </div>
      ))}
    </div>
  );
}

/** Skeleton com formato de tabela — mantém a coluna estável durante a carga. */
export function EsqueletoTabela({ linhas = 8, colunas = 6 }: { linhas?: number; colunas?: number }) {
  const larguras = ["w-16", "w-32", "w-24", "w-20", "w-28", "w-14", "w-24", "w-20"];
  return (
    <div className="border border-border bg-surface/40" aria-hidden>
      <div className="flex gap-4 border-b border-border px-3 py-2.5">
        {Array.from({ length: colunas }).map((_, c) => (
          <div key={c} className={cn("shimmer h-2.5", larguras[c % larguras.length])} />
        ))}
      </div>
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-border px-3 py-3 last:border-0">
          {Array.from({ length: colunas }).map((_, c) => (
            <div
              key={c}
              className={cn("shimmer h-3", larguras[(c + i) % larguras.length])}
              style={{ animationDelay: `${(i * colunas + c) * 35}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}


/** Indicador de carregamento discreto, no tom da marca. */
export function Carregando({ texto = "carregando" }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-[2px] w-24 overflow-hidden bg-border">
        <motion.span
          className="barra-ouro absolute inset-y-0 w-1/3"
          animate={{ x: ["-120%", "320%"] }}
          transition={{ duration: 1.1, ease: "easeInOut", repeat: Infinity }}
        />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{texto}</span>
    </div>
  );
}

export function Metrica({
  rotulo,
  valor,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: string | number;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <motion.div
      variants={varItem}
      whileHover={{ y: -2 }}
      transition={transicao.rapida}
      className={cn(
        "relative overflow-hidden border border-border bg-surface px-4 py-4 transition-colors hover:border-border-strong",
        destaque && "border-l-2 border-l-primary",
      )}
    >
      {destaque && <span className="barra-ouro absolute inset-y-0 left-0 w-[2px]" />}
      <p className="label-caps">{rotulo}</p>
      <p className="mt-2 font-display text-[30px] leading-none text-cromo">{valor}</p>
      {nota && <p className="mt-1.5 text-[12px] text-muted-foreground">{nota}</p>}
    </motion.div>
  );
}

/**
 * Tabela padrão do sistema.
 * Rola apenas na horizontal (sem barra vertical fantasma) e mantém
 * cabeçalho fixo ao rolar a página em listas longas.
 */
export function Tabela({
  children,
  minLargura = 880,
  className,
}: {
  children: ReactNode;
  minLargura?: number;
  className?: string;
}) {
  return (
    <div data-tour="tabela" className={cn("rolagem-x border border-border bg-surface/40", className)}>
      <table
        className="w-full border-collapse text-left align-middle"
        style={{ minWidth: minLargura }}
      >
        {children}
      </table>
    </div>
  );
}

/** Cabeçalho de tabela padronizado (rótulos, alinhamento e padding iguais). */
export function CabecalhoTabela({
  colunas,
  extra,
}: {
  colunas: (string | { rotulo: string; alinhar?: "esquerda" | "direita"; largura?: string })[];
  extra?: ReactNode;
}) {
  return (
    <thead className="bg-surface">
      <tr className="border-b border-border">
        {extra}
        {colunas.map((c, i) => {
          const col = typeof c === "string" ? { rotulo: c } : c;
          return (
            <th
              key={`${col.rotulo}-${i}`}
              scope="col"
              className={cn(
                "label-caps whitespace-nowrap px-3 py-2.5 font-normal",
                col.alinhar === "direita" && "text-right",
              )}
              style={col.largura ? { width: col.largura } : undefined}
            >
              {col.rotulo}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/**
 * Modal padrão: overlay consistente, fecha no Esc e no clique fora,
 * nunca ultrapassa a viewport e rola apenas internamente.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  largura = "max-w-md",
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  largura?: string;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = anterior;
    };
  }, [aberto, aoFechar]);

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transicao.rapida}
          onClick={aoFechar}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={transicao.padrao}
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "flex max-h-[85dvh] w-full flex-col border border-border-strong bg-surface shadow-cromo",
              largura,
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] uppercase tracking-[0.08em] text-cromo">
                  {titulo}
                </p>
                {descricao && (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{descricao}</p>
                )}
              </div>
              <button
                onClick={aoFechar}
                aria-label="Fechar"
                className="press -mr-1 flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="rolagem-y min-h-0 flex-1">{children}</div>
            {rodape && (
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                {rodape}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Corpo de tabela com entrada escalonada das linhas. */
export function CorpoTabela({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.tbody variants={varLista(0.025)} initial="inicial" animate="animar" className={className}>
      {children}
    </motion.tbody>
  );
}

/** Linha de tabela padrão — hover com risco âmbar, sem fundo genérico. */
export function LinhaTabela({
  children,
  ativa,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { ativa?: boolean }) {
  return (
    <motion.tr
      variants={varItem}
      {...(props as object)}
      className={cn(
        "linha-tabela border-b border-border last:border-0",
        ativa && "bg-primary/[0.06] text-foreground",
        className,
      )}
    >
      {children}
    </motion.tr>
  );
}
