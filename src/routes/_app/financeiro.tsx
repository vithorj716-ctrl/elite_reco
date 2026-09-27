import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Botao, Metrica, Pagina, Vazio, suave } from "@/components/app/ui";
import { toast } from "sonner";
import { FinanceiroService } from "@/services/financeiro.service";
import { Movimentacoes } from "@/components/negocio/movimentacoes";
import { TabelasRemuneracao } from "@/components/negocio/tabelas-remuneracao";
import { ConfiguracoesRecibo } from "@/components/negocio/configuracoes-recibo";
import { ConfiguracoesOperacao } from "@/components/negocio/configuracoes-operacao";
import {
  adiantamentoEmAberto,
  contasAPagar,
  contasAReceber,
  dinheiro,
  inconsistenciasFinanceiras,
  resumoFinanceiro,
  ROTULO_OPERACAO,
  type Inconsistencia,
  type LinhaFinanceira,
  type OperacaoFinanceira,
} from "@/domain/services/financeiro";
import type { Banco } from "@/domain/types";
import { useBanco, useSincronizar } from "@/lib/sessao";



export const Route = createFileRoute("/_app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Recolhe" },
      {
        name: "description",
        content: "Contas a receber das locadoras, contas a pagar dos agentes e tabelas de preço.",
      },
      { property: "og:title", content: "Financeiro — Recolhe" },
      {
        property: "og:description",
        content: "Receita, despesa e lucro calculados automaticamente por ordem concluída.",
      },
    ],
  }),
  component: Financeiro,
});

type Aba = "receber" | "pagar" | "movimentacoes" | "tabelas" | "auditoria" | "configuracoes";

function Financeiro() {
  const banco = useBanco();
  const [aba, setAba] = useState<Aba>("receber");
  const resumo = resumoFinanceiro(banco);
  const receber = contasAReceber(banco);
  const pagar = contasAPagar(banco);
  const problemas = inconsistenciasFinanceiras(banco);

  return (
    <Pagina titulo="Financeiro" descricao="Cada valor abaixo é um lançamento rastreável até a ordem que o gerou." fundo="financeiro" intensidadeFundo="low">
      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          rotulo="A receber"
          valor={dinheiro(resumo.receita)}
          nota="serviços + taxas + adicionais"
          destaque
        />
        <Metrica rotulo="Serviços" valor={dinheiro(resumo.servicos)} nota="recolhimentos concluídos" />
        <Metrica
          rotulo="Taxas de cancelamento"
          valor={dinheiro(resumo.taxas)}
          nota={`${dinheiro(resumo.taxasPendentes)} ainda não faturados`}
        />
        <Metrica rotulo="Cobranças adicionais" valor={dinheiro(resumo.adicionais)} nota="lançadas na ficha" />
      </div>

      <div className="mt-px grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="Já recebido" valor={dinheiro(resumo.faturado)} nota="liquidado pelas locadoras" />
        <Metrica rotulo="Pendente" valor={dinheiro(resumo.pendente)} nota="em aberto com locadoras" />
        <Metrica rotulo="A pagar a agentes" valor={dinheiro(resumo.aPagarAgentes)} nota={`${dinheiro(adiantamentoEmAberto(banco))} adiantados`} />
        <Metrica
          rotulo="Lucro"
          valor={dinheiro(resumo.lucro)}
          nota={`margem ${(resumo.margem * 100).toFixed(1)}%`}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-px bg-border">
        {(
          [
            ["receber", "Contas a receber"],
            ["pagar", "Contas a pagar"],
            ["movimentacoes", "Adiantamentos e pagamentos"],
            ["tabelas", "Tabelas de remuneração"],
            ["auditoria", problemas.length ? `Auditoria (${problemas.length})` : "Auditoria"],
            ["configuracoes", "Configurações"],
          ] as [Aba, string][]
        ).map(([chave, rotulo]) => (

          <button
            key={chave}
            onClick={() => setAba(chave)}
            className={`press relative flex-1 bg-surface px-4 py-2.5 text-left text-[12px] uppercase tracking-[0.12em] transition-colors ${
              aba === chave ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {aba === chave && (
              <motion.span
                layoutId="aba-fin"
                transition={suave}
                className="absolute inset-x-0 bottom-0 h-[2px] bg-primary"
              />
            )}
            {rotulo}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={aba}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={suave}
          className="mt-6"
        >
          {aba === "receber" && (
            <Contas
              banco={banco}
              linhas={receber}
              tipo="receber"
              vazio="Nenhuma ordem concluída ainda — o faturamento é gerado quando o agente finaliza o recolhimento."
            />
          )}
          {aba === "pagar" && (
            <Contas
              banco={banco}
              linhas={pagar}
              tipo="pagar"
              vazio="Nenhum repasse pendente — os valores aparecem quando as ordens dos agentes são concluídas."
            />
          )}
          {aba === "movimentacoes" && <Movimentacoes banco={banco} />}
          {aba === "tabelas" && <TabelasRemuneracao banco={banco} />}
          {aba === "auditoria" && <Auditoria problemas={problemas} />}
          {aba === "configuracoes" && (
            <div className="space-y-6">
              <ConfiguracoesOperacao banco={banco} />
              <ConfiguracoesRecibo banco={banco} />
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </Pagina>
  );
}

type Filtro = "todos" | "vistoria" | "recolhimento" | "aberto" | "liquidado";

const FILTROS: [Filtro, string][] = [
  ["todos", "Todos"],
  ["vistoria", "Vistorias"],
  ["recolhimento", "Recolhimentos"],
  ["aberto", "Em aberto"],
  ["liquidado", "Liquidado"],
];

function Contas({
  linhas,
  tipo,
  vazio,
}: {
  banco: Banco;
  linhas: LinhaFinanceira[];
  tipo: "receber" | "pagar";
  vazio: string;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [ocupado, setOcupado] = useState(false);
  const sincronizar = useSincronizar();

  const valorDe = (op: OperacaoFinanceira) => (tipo === "receber" ? op.receber : op.pagar);
  const liquidado = (op: OperacaoFinanceira) =>
    tipo === "receber" ? op.recebimentoPago : op.pagamentoPago;

  const aplicar = (itens: OperacaoFinanceira[]) =>
    itens.filter((op) => {
      if (filtro === "vistoria" || filtro === "recolhimento") return op.tipo === filtro;
      if (filtro === "aberto") return !liquidado(op);
      if (filtro === "liquidado") return liquidado(op);
      return true;
    });

  /**
   * Liquidação: cada operação é confirmada individualmente pelo banco. O que
   * falhar é informado com o motivo real, sem contaminar o restante.
   */
  const liquidar = async (itens: OperacaoFinanceira[], pago: boolean) => {
    if (itens.length === 0) return;
    setOcupado(true);
    try {
      const r = await FinanceiroService.liquidar(itens, tipo, pago);
      await sincronizar(["ordens", "vistorias"] as never);
      if (r.liquidadas.length > 0) {
        toast.success(
          `${r.liquidadas.length} ${r.liquidadas.length > 1 ? "operações" : "operação"} ${
            pago ? "liquidada(s)" : "estornada(s)"
          } · ${dinheiro(r.valor)}`,
        );
      }
      if (r.liquidadas.length === 0 && r.falhas.length === 0) {
        toast.info("Nada a fazer: as operações selecionadas já estavam nessa situação.");
      }
      for (const f of r.falhas) {
        toast.error(`${f.operacao.codigo}: ${f.motivo}`, { duration: 8000 });
      }
    } catch (e) {
      toast.error((e as Error).message, { duration: 8000 });
    } finally {
      setOcupado(false);
    }
  };

  if (linhas.length === 0) {
    return <Vazio titulo="Sem lançamentos" texto={vazio} />;
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-px bg-border">
        {FILTROS.map(([chave, rotulo]) => (
          <button
            key={chave}
            onClick={() => setFiltro(chave)}
            className={`press bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
              filtro === chave ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="border border-border">
        <div className="hidden grid-cols-[1.6fr_repeat(4,minmax(0,1fr))_auto] gap-4 border-b border-border px-4 py-2.5 md:grid">
          <span className="label-caps">{tipo === "receber" ? "Locadora" : "Agente"}</span>
          <span className="label-caps text-right">Qtd.</span>
          <span className="label-caps text-right">Total</span>
          <span className="label-caps text-right">Liquidado</span>
          <span className="label-caps text-right">Em aberto</span>
          <span className="w-24" />
        </div>
        <ul className="divide-y divide-border">
          {linhas.map((l, i) => {
            const itens = aplicar(l.itens);
            if (itens.length === 0) return null;
            const expandido = aberto === l.id;
            const total = itens.reduce((s, op) => s + valorDe(op), 0);
            const pago = itens.filter(liquidado).reduce((s, op) => s + valorDe(op), 0);
            const pendentes = itens.filter((op) => !liquidado(op));
            const porTipo = (["vistoria", "recolhimento"] as const)
              .map((t) => ({ t, lista: itens.filter((op) => op.tipo === t) }))
              .filter((x) => x.lista.length > 0);

            return (
              <motion.li
                key={l.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...suave, delay: Math.min(i, 8) * 0.035 }}
              >
                <div className="grid gap-2 px-4 py-3 md:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))_auto] md:items-center md:gap-4">
                  <button
                    onClick={() => setAberto(expandido ? null : l.id)}
                    className="press text-left text-[13px] text-foreground hover:text-primary"
                  >
                    {l.nome}
                    <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                      {expandido ? "fechar" : "detalhar"}
                    </span>
                  </button>
                  <span className="font-mono text-[13px] text-muted-foreground md:text-right">
                    {itens.length}
                  </span>
                  <span className="font-mono text-[13px] text-foreground md:text-right">
                    {dinheiro(total)}
                  </span>
                  <span className="font-mono text-[13px] text-success md:text-right">
                    {dinheiro(pago)}
                  </span>
                  <span className="font-mono text-[13px] text-warning md:text-right">
                    {dinheiro(total - pago)}
                  </span>
                  <div className="flex items-center gap-2 justify-self-start md:justify-self-end">
                    <Link
                      to="/documentos/$tipo/$id"
                      params={{ tipo: tipo === "receber" ? "fatura" : "recibo", id: l.id }}
                      className="press border border-border-strong px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      {tipo === "receber" ? "Fatura" : "Recibo"}
                    </Link>
                    <Botao
                      variante="linha"
                      carregando={ocupado}
                      disabled={pendentes.length === 0}
                      onClick={() => liquidar(pendentes, true)}
                    >
                      Liquidar
                    </Botao>
                  </div>
                </div>

                {/* Resumo por tipo de operação — vistoria e recolhimento lado a lado */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 pb-3 text-[12px] text-muted-foreground">
                  {porTipo.map(({ t, lista }) => {
                    const soma = lista.reduce((s, op) => s + valorDe(op), 0);
                    return (
                      <span key={t} className="font-mono">
                        {ROTULO_OPERACAO[t]}: {lista.length} ·{" "}
                        {dinheiro(lista.length > 0 ? soma / lista.length : 0)} un. ·{" "}
                        <span className="text-foreground">{dinheiro(soma)}</span>
                      </span>
                    );
                  })}
                </div>

                <AnimatePresence initial={false}>
                  {expandido && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden bg-surface"
                    >
                      <ul className="divide-y divide-border border-t border-border">
                        {itens.map((op) => (
                          <li
                            key={op.id}
                            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-2.5"
                          >
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {new Date(op.data).toLocaleDateString("pt-BR")}
                            </span>
                            <span className="font-mono text-[12px] text-primary">{op.codigo}</span>
                            <span className="font-mono text-[12px] text-muted-foreground">
                              {op.placa}
                            </span>
                            <span
                              className={`border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                                op.tipo === "vistoria"
                                  ? "border-info/50 text-info"
                                  : "border-border-strong text-muted-foreground"
                              }`}
                            >
                              {ROTULO_OPERACAO[op.tipo]}
                            </span>
                            <span className="text-[12px] text-muted-foreground">
                              {op.descricao}
                            </span>
                            <span className="font-mono text-[12px] text-foreground">
                              {dinheiro(valorDe(op))}
                            </span>
                            {valorDe(op) === 0 && (
                              <span className="text-[11px] text-warning">
                                sem preço na tabela de {tipo === "receber" ? "cobrança" : "pagamento"}
                              </span>
                            )}
                            <button
                              disabled={ocupado}
                              onClick={() => liquidar([op], !liquidado(op))}
                              className={`press ml-auto border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                                liquidado(op)
                                  ? "border-success/40 text-success"
                                  : "border-border-strong text-muted-foreground"
                              }`}
                            >
                              {liquidado(op) ? "liquidado" : "em aberto"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}


/**
 * Relatório de inconsistências: expõe dinheiro que ficou pelo caminho.
 * Nada é corrigido automaticamente — a decisão é sempre humana.
 */
function Auditoria({ problemas }: { problemas: Inconsistencia[] }) {
  if (problemas.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma inconsistência financeira"
        texto="Toda ordem que gerou dinheiro possui lançamento correspondente, sem duplicidade e sem valor órfão."
      />
    );
  }
  return (
    <div className="border border-border">
      <div className="border-b border-border px-4 py-2.5">
        <p className="label-caps">
          {problemas.length} ponto{problemas.length > 1 ? "s" : ""} para conferência
        </p>
      </div>
      <ul className="divide-y divide-border">
        {problemas.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-4 py-3">
            <span
              className={`mt-1 size-1.5 shrink-0 rounded-full ${
                p.gravidade === "alta" ? "bg-destructive" : "bg-warning"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-foreground">{p.titulo}</p>
              <p className="text-[12px] text-muted-foreground">{p.detalhe}</p>
            </div>
            {p.ordemId && (
              <Link
                to="/ordens/$id"
                params={{ id: p.ordemId }}
                className="press font-mono text-[10px] uppercase tracking-[0.12em] text-primary hover:underline"
              >
                abrir ordem
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
