/**
 * Kit de formulário do sistema — mesma linguagem visual em todos os cadastros.
 * Campos densos, sem cara de template: grade de 1px, rótulos em caixa alta.
 */
import { AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { transicao } from "@/lib/animacao";
import { ATRIBUTO_INVALIDO } from "@/lib/validacao";
import { cn } from "@/lib/utils";

const base =
  "w-full border-b border-border bg-transparent pb-1 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary disabled:opacity-60";

const baseErro = "border-destructive text-destructive focus:border-destructive";

export function Grade({
  colunas = 3,
  children,
  className,
}: {
  colunas?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}) {
  const cols =
    colunas === 2
      ? "sm:grid-cols-2"
      : colunas === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3";
  return <div className={cn("grid gap-px bg-border", cols, className)}>{children}</div>;
}

function Envolucro({
  rotulo,
  dica,
  erro,
  className,
  children,
}: {
  rotulo: string;
  dica?: string;
  erro?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.label
      {...(erro ? { [ATRIBUTO_INVALIDO]: "1" } : {})}
      animate={erro ? { x: [0, -4, 4, -2, 0] } : { x: 0 }}
      transition={transicao.rapida}
      className={cn(
        "relative block bg-surface px-4 py-3 transition-colors",
        erro && "bg-destructive/10 ring-1 ring-inset ring-destructive/60",
        className,
      )}
    >
      <span className={cn("label-caps", erro && "text-destructive")}>
        {rotulo}
        {erro && <span className="ml-1 text-destructive">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {erro ? (
        <span className="mt-1 flex items-start gap-1 text-[11px] font-medium text-destructive">
          <AlertCircle className="mt-[1px] size-3 shrink-0" />
          {erro}
        </span>
      ) : (
        dica && <span className="mt-1 block text-[11px] text-muted-foreground">{dica}</span>
      )}
    </motion.label>
  );
}

type PropsEntrada = InputHTMLAttributes<HTMLInputElement> & {
  rotulo: string;
  dica?: string;
  erro?: string;
  areaClassName?: string;
};

export function Entrada({ rotulo, dica, erro, areaClassName, className, ...props }: PropsEntrada) {
  return (
    <Envolucro
      rotulo={rotulo}
      {...(dica ? { dica } : {})}
      {...(erro ? { erro } : {})}
      {...(areaClassName ? { className: areaClassName } : {})}
    >
      <input
        {...props}
        aria-invalid={erro ? true : undefined}
        className={cn(base, className, erro && baseErro)}
      />
    </Envolucro>
  );
}

type PropsSelecao = SelectHTMLAttributes<HTMLSelectElement> & {
  rotulo: string;
  dica?: string;
  erro?: string;
  opcoes: Array<{ valor: string; rotulo: string }>;
  areaClassName?: string;
};

export function Selecao({
  rotulo,
  dica,
  erro,
  opcoes,
  areaClassName,
  className,
  ...props
}: PropsSelecao) {
  return (
    <Envolucro
      rotulo={rotulo}
      {...(dica ? { dica } : {})}
      {...(erro ? { erro } : {})}
      {...(areaClassName ? { className: areaClassName } : {})}
    >
      <select
        {...props}
        aria-invalid={erro ? true : undefined}
        className={cn(base, "cursor-pointer", className, erro && baseErro)}
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor} className="bg-surface text-foreground">
            {o.rotulo}
          </option>
        ))}
      </select>
    </Envolucro>
  );
}

type PropsArea = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  rotulo: string;
  dica?: string;
  erro?: string;
  areaClassName?: string;
};

export function AreaTexto({ rotulo, dica, erro, areaClassName, className, ...props }: PropsArea) {
  return (
    <Envolucro
      rotulo={rotulo}
      {...(dica ? { dica } : {})}
      {...(erro ? { erro } : {})}
      {...(areaClassName ? { className: areaClassName } : {})}
    >
      <textarea
        rows={3}
        {...props}
        aria-invalid={erro ? true : undefined}
        className={cn(base, "resize-y", className, erro && baseErro)}
      />
    </Envolucro>
  );
}


/** Bloco de campos com título — organiza fichas longas em seções legíveis. */
export function BlocoCampos({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: string;
  children: ReactNode;
}) {
  return (
    <motion.fieldset
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transicao.suave}
      className="border border-border bg-surface"
    >
      <legend className="sr-only">{titulo}</legend>
      <div className="flex items-baseline gap-3 border-b border-border px-4 py-2.5">
        <span className="barra-ouro h-[10px] w-[2px]" />
        <p className="label-caps">{titulo}</p>
        {descricao && <p className="truncate text-[11.5px] text-muted-foreground">{descricao}</p>}
      </div>
      {children}
    </motion.fieldset>
  );
}

/** Campo somente leitura — dados obtidos automaticamente e não digitáveis. */
export function Leitura({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <span className="label-caps">{rotulo}</span>
      <p className="mt-1.5 truncate border-b border-transparent pb-1 text-[13px] text-cromo">
        {valor || "—"}
      </p>
    </div>
  );
}

/**
 * Abas horizontais reutilizáveis.
 * Delegam ao componente do design system para manter um único dialeto visual.
 */
export { Abas } from "@/components/app/ui";
