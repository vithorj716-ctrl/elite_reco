/**
 * Meu Financeiro — visão pessoal do agente de campo.
 *
 * Nada é recalculado aqui: tudo vem das mesmas regras usadas pela central
 * (`@/domain/services/financeiro`), garantindo que o agente veja exatamente os
 * mesmos números do administrativo, inclusive os valores congelados da ordem.
 * O RLS já limita ordens, pagamentos e lançamentos ao próprio agente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import {
  Metrica,
  Modal,
  Pagina,
  Selo,
  Abas,
  BarraFiltros,
  Vazio,
  suave,
} from "@/components/app/ui";
import { AvatarAgente } from "@/components/negocio/foto-agente";
import { useBanco, useSessao } from "@/lib/sessao";
import {
  dinheiroExato,
  extratoAgente,
  participaDaOrdem,
  saldoAgente,
  valorPagarAgente,
  type LinhaExtrato,
} from "@/domain/services/financeiro";
import { ROTULO_LANCAMENTO } from "@/domain/types";
import { varLista } from "@/lib/animacao";

export const Route = createFileRoute("/_app/agente/financeiro")({
  head: () => ({
    meta: [
      { title: "Meu financeiro — Recolhe" },
      {
        name: "description",
        content:
          "Valores a receber, pagamentos, adiantamentos e extrato pessoal do agente de campo.",
      },
      { property: "og:title", content: "Meu financeiro — Recolhe" },
      {
        property: "og:description",
        content: "Saldo, adiantamentos e extrato do agente, atualizados em tempo real.",
      },
    ],
  }),
  component: MeuFinanceiro,
});

type Filtro = "todos" | "receber" | "pago" | "adiantamento" | "estorno";

const PERIODOS = [
  { valor: "30", rotulo: "30 dias" },
  { valor: "90", rotulo: "90 dias" },
  { valor: "0", rotulo: "Tudo" },
] as const;

const data = (v: string) => new Date(v).toLocaleDateString("pt-BR");
const dataHora = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

function MeuFinanceiro() {
  const banco = useBanco();
  const { usuario } = useSessao();
  const meuId = usuario?.agenteId ?? "";
  const agente = banco.agentes.find((a) => a.id === meuId);

  const [aba, setAba] = useState<Filtro>("todos");
  const [dias, setDias] = useState<(typeof PERIODOS)[number]["valor"]>("30");
  const [detalhe, setDetalhe] = useState<LinhaExtrato | null>(null);

  const saldo = useMemo(() => saldoAgente(banco, meuId), [banco, meuId]);

  const periodo = useMemo(() => {
    if (dias === "0") return undefined;
    const de = new Date();
    de.setDate(de.getDate() - Number(dias));
    de.setHours(0, 0, 0, 0);
    return { de: de.toISOString() };
  }, [dias]);

  const extrato = useMemo(
    () => (meuId ? extratoAgente(banco, meuId, periodo) : []),
    [banco, meuId, periodo],
  );

  /** Ordens que geraram valor para este agente, com a função exercida. */
  const aReceber = useMemo(
    () =>
      banco.ordens
        .filter((o) => o.status === "concluida" && participaDaOrdem(o, meuId) && !o.pagamentoPago)
        .map((o) => ({
          ordem: o,
          auxiliar: o.agenteAuxiliarId === meuId && o.agenteId !== meuId,
          valor: valorPagarAgente(banco, o, meuId),
        }))
        .sort((a, b) => (b.ordem.concluidaEm ?? "").localeCompare(a.ordem.concluidaEm ?? "")),
    [banco, meuId],
  );

  const adiantamentos = useMemo(
    () =>
      saldo.lancamentos
        .filter((l) => l.tipo === "adiantamento")
        .slice()
        .reverse(),
    [saldo.lancamentos],
  );

  /** Compensações apontam para o adiantamento liquidado via referenciaId. */
  const liquidacao = (adiantamentoId: string) =>
    saldo.lancamentos.find(
      (l) => l.tipo === "compensacao" && l.referenciaId === adiantamentoId && l.situacao === "ativo",
    );

  const situacaoAdiantamento = (id: string, situacao: string) => {
    if (situacao === "estornado") return { rotulo: "Estornado", tom: "perigo" as const };
    if (situacao === "cancelado") return { rotulo: "Cancelado", tom: "neutro" as const };
    if (liquidacao(id)) return { rotulo: "Liquidado", tom: "sucesso" as const };
    return { rotulo: "Em aberto", tom: "alerta" as const };
  };

  const filtrado = useMemo(() => {
    if (aba === "todos") return extrato;
    if (aba === "receber") return extrato.filter((l) => l.tipo === "producao");
    if (aba === "pago") return extrato.filter((l) => l.tipo === "pagamento");
    if (aba === "adiantamento") return extrato.filter((l) => l.tipo === "adiantamento");
    return extrato.filter((l) => l.descricao.includes("estornado"));
  }, [aba, extrato]);

  if (!meuId || !agente) {
    return (
      <Pagina titulo="Meu financeiro">
        <Vazio
          titulo="Cadastro de agente não vinculado"
          texto="Seu usuário ainda não está ligado a um cadastro de agente. Fale com a central."
        />
      </Pagina>
    );
  }

  return (
    <Pagina titulo="Meu financeiro" descricao="Seus valores, adiantamentos e extrato pessoal." fundo="financeiro">
      <section className="flex items-center gap-3 border border-border bg-surface p-4">
        <AvatarAgente foto={agente.foto} nome={agente.nome} tamanho={52} />
        <div className="min-w-0">
          <p className="truncate text-[15px] text-foreground">{agente.nome}</p>
          <p className="label-caps mt-0.5 flex items-center gap-1.5">
            <Wallet className="size-3 text-primary" aria-hidden /> Meu financeiro
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Período: {dias === "0" ? "todo o histórico" : `últimos ${dias} dias`}
          </p>
        </div>
      </section>

      <motion.div
        variants={varLista(0.05)}
        initial="inicial"
        animate="animar"
        className="mt-4 grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metrica rotulo="A receber" valor={dinheiroExato(Math.max(saldo.pendente, 0))} destaque />
        <Metrica rotulo="Já recebido" valor={dinheiroExato(saldo.pago)} />
        <Metrica
          rotulo="Adiantamentos"
          valor={dinheiroExato(saldo.adiantamentos)}
          nota={`${dinheiroExato(saldo.adiantamentoAberto)} em aberto`}
        />
        <Metrica rotulo="Saldo" valor={dinheiroExato(saldo.pendente)} />
      </motion.div>

      <BarraFiltros>
        <span className="label-caps">Período</span>
        {PERIODOS.map((p) => (
          <button
            key={p.valor}
            onClick={() => setDias(p.valor)}
            className={
              dias === p.valor
                ? "press border border-primary/50 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary"
                : "press border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            }
          >
            {p.rotulo}
          </button>
        ))}
      </BarraFiltros>

      {/* Valores a receber por ordem */}
      <section className="mt-6 border border-border">
        <p className="label-caps border-b border-border px-4 py-2.5">
          A receber por ordem · {aReceber.length}
        </p>
        {aReceber.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">
            Nenhum valor pendente no momento.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {aReceber.map(({ ordem, auxiliar, valor }, i) => (
              <motion.li
                key={ordem.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...suave, delay: Math.min(i, 8) * 0.03 }}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="font-mono text-[13px] text-foreground">{ordem.codigo}</span>
                <span className="font-mono text-[13px] text-muted-foreground">{ordem.placa}</span>
                <Selo tom={auxiliar ? "info" : "primario"}>
                  {auxiliar ? "Auxiliar" : "Principal"}
                </Selo>
                <span className="ml-auto font-mono text-[14px] tabular-nums text-success">
                  {dinheiroExato(valor)}
                </span>
                <Selo tom="alerta">Pendente</Selo>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      {/* Adiantamentos */}
      <section className="mt-6 border border-border">
        <p className="label-caps border-b border-border px-4 py-2.5">
          Adiantamentos · {adiantamentos.length}
        </p>
        {adiantamentos.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">
            Você não possui adiantamentos registrados.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {adiantamentos.map((l) => {
              const s = situacaoAdiantamento(l.id, l.situacao);
              const baixa = liquidacao(l.id);
              return (
                <li key={l.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-mono text-[14px] tabular-nums text-foreground">
                      {dinheiroExato(l.valor)}
                    </span>
                    <span className="text-[12px] text-muted-foreground">{data(l.data)}</span>
                    <span className="ml-auto">
                      <Selo tom={s.tom}>{s.rotulo}</Selo>
                    </span>
                  </div>
                  {l.observacao && (
                    <p className="mt-1 text-[12px] text-muted-foreground">{l.observacao}</p>
                  )}
                  {baixa && (
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Liquidado em {data(baixa.data)}
                    </p>
                  )}
                  {l.situacao === "estornado" && (
                    <p className="mt-1 text-[12px] text-destructive">
                      Estornado{l.motivo ? ` · ${l.motivo}` : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Extrato */}
      <section className="mt-6 border border-border">
        <p className="label-caps border-b border-border px-4 py-2.5">Extrato</p>
        <Abas
          id="extrato-agente"
          valor={aba}
          aoTrocar={setAba}
          itens={[
            { valor: "todos", rotulo: "Todos" },
            { valor: "receber", rotulo: "A receber" },
            { valor: "pago", rotulo: "Pago" },
            { valor: "adiantamento", rotulo: "Adiantamento" },
            { valor: "estorno", rotulo: "Estorno" },
          ]}
        />
        {filtrado.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">
            Nenhuma movimentação neste período.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtrado.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => setDetalhe(l)}
                  className="press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-raised"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {new Date(l.data).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {l.descricao}
                  </span>
                  <span
                    className={
                      l.movimento >= 0
                        ? "flex items-center gap-1 font-mono text-[13px] tabular-nums text-success"
                        : "flex items-center gap-1 font-mono text-[13px] tabular-nums text-destructive"
                    }
                  >
                    {l.movimento >= 0 ? (
                      <ArrowUpRight className="size-3" aria-hidden />
                    ) : (
                      <ArrowDownRight className="size-3" aria-hidden />
                    )}
                    {dinheiroExato(Math.abs(l.movimento))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        aberto={Boolean(detalhe)}
        aoFechar={() => setDetalhe(null)}
        titulo={detalhe ? ROTULO_LANCAMENTO[detalhe.tipo] : "Lançamento"}
      >
        {detalhe && (
          <dl className="space-y-2 text-[13px]">
            <Linha rotulo="Descrição" valor={detalhe.descricao} />
            <Linha rotulo="Origem" valor={detalhe.locadora} />
            {detalhe.servico && <Linha rotulo="Serviço" valor={detalhe.servico} />}
            <Linha
              rotulo={detalhe.movimento >= 0 ? "Entrada" : "Saída"}
              valor={dinheiroExato(Math.abs(detalhe.movimento))}
            />
            <Linha rotulo="Data" valor={dataHora(detalhe.data)} />
            <Linha rotulo="Saldo após" valor={dinheiroExato(detalhe.saldo)} />
          </dl>
        )}
      </Modal>
    </Pagina>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2">
      <dt className="label-caps">{rotulo}</dt>
      <dd className="text-right text-foreground">{valor}</dd>
    </div>
  );
}
