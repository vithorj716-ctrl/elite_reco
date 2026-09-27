import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Bike, Phone, SquarePen } from "lucide-react";
import { dinheiro } from "@/domain/services/financeiro";
import { ROTULO_SITUACAO_AGENTE, type Agente, type SituacaoAgente } from "@/domain/types";
import { AvatarAgente } from "@/components/negocio/foto-agente";
import { SeloDisponibilidade } from "@/components/negocio/disponibilidade";
import { transicao, varItem } from "@/lib/animacao";
import { cn } from "@/lib/utils";

const CORES: Record<SituacaoAgente, string> = {
  ativo: "text-success border-success/40",
  inativo: "text-muted-foreground border-border-strong",
  bloqueado: "text-destructive border-destructive/40",
};

export function SeloSituacao({ valor }: { valor: SituacaoAgente }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.12em]",
        CORES[valor],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {ROTULO_SITUACAO_AGENTE[valor]}
    </span>
  );
}

export interface ResumoAgente {
  abertas: number;
  concluidas: number;
  pendente: number;
  produzido: number;
}

/** Cartão de agente — leitura rápida de disponibilidade e saldo. */
export function CardAgente({
  agente,
  resumo,
  aoEditar,
}: {
  agente: Agente;
  resumo: ResumoAgente;
  aoEditar?: () => void;
}) {
  return (
    <motion.li
      variants={varItem}
      whileHover={{ y: -2 }}
      transition={transicao.rapida}
      className="relative list-none"
    >
      {aoEditar && (
        <button
          type="button"
          onClick={aoEditar}
          aria-label={`Editar cadastro de ${agente.nome}`}
          className="press absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center border border-border bg-surface text-muted-foreground hover:border-primary hover:text-primary"
        >
          <SquarePen className="size-3.5" aria-hidden />
        </button>
      )}
      <Link
        to="/agentes/$id"
        params={{ id: agente.id }}
        className={cn(
          "block h-full bg-surface p-5 transition-colors hover:bg-surface-raised",
          aoEditar && "pr-14",
        )}
      >
        <div className="flex items-start gap-3">
          <AvatarAgente foto={agente.foto} nome={agente.nome} tamanho={36} />
          <div className="min-w-0">
            <p className="truncate font-display text-[16px] uppercase tracking-[0.04em]">
              {agente.nome}
            </p>
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Phone className="size-3" />
              {agente.telefone || "sem telefone"}
            </p>
          </div>
          <span className="ml-auto flex flex-col items-end gap-1.5">
            <SeloSituacao valor={agente.situacao} />
            <SeloDisponibilidade agente={agente} />
          </span>
        </div>

        <p className="mt-3 flex items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground">
          <Bike className="size-3" />
          {agente.motoPlaca || "sem moto"} ·{" "}
          {agente.regiao || agente.cidade || "praça não definida"}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
          <div>
            <dt className="label-caps">Campo</dt>
            <dd className="font-display text-[18px] text-primary">{resumo.abertas}</dd>
          </div>
          <div>
            <dt className="label-caps">Feitas</dt>
            <dd className="font-display text-[18px]">{resumo.concluidas}</dd>
          </div>
          <div>
            <dt className="label-caps">Produzido</dt>
            <dd className="font-display text-[15px] leading-6">{dinheiro(resumo.produzido)}</dd>
          </div>
          <div>
            <dt className="label-caps">A pagar</dt>
            <dd
              className={cn(
                "font-display text-[15px] leading-6",
                resumo.pendente > 0 && "text-warning",
              )}
            >
              {dinheiro(resumo.pendente)}
            </dd>
          </div>
        </dl>
      </Link>
    </motion.li>
  );
}
