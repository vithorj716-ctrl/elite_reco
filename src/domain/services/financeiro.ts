/**
 * Regras financeiras da operação.
 *
 * FONTE ÚNICA DE VERDADE: toda receita da empresa é representada por
 * `LancamentoLocadora`. Nenhuma tela pode somar dinheiro de outra forma —
 * financeiro, faturamento, contas a receber, relatórios, dashboard e a fatura
 * impressa consomem exatamente a mesma lista.
 *
 * Um lançamento nasce de duas origens, e só dessas duas:
 *   1. SERVIÇO   — a ordem concluída, com valor congelado em `valorCobranca`
 *                  (snapshot) ou, na ausência dele, a tabela de preços vigente.
 *   2. COBRANÇA  — cada linha de `ordem_cobrancas`: taxa de cancelamento,
 *                  quilometragem, adicionais lançados pela central etc.
 *
 * Lançamento estornado permanece na lista (histórico), mas sai de todos os
 * somatórios. Nada é apagado para os totais "baterem".
 */
import {
  ROTULO_LANCAMENTO,
  ROTULO_TIPO_COBRANCA,
  type Banco,
  type Ordem,
  type PagamentoAgente,
  type LancamentoAgente,
  type SituacaoLancamento,
  type SituacaoCobranca,
  type TipoCobranca,
  type Vistoria,
} from "@/domain/types";
import { precoCobranca, precoPagamento } from "@/domain/services/remuneracao";
import { nomeServico } from "@/domain/services/catalogo";
import { operacaoLiberada } from "@/domain/services/liberacao";
import {
  placaDaVistoria,
  valorCobrancaVistoria,
  valorPagamentoVistoria,
} from "@/domain/services/vistorias";

export const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const dinheiroExato = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Cobranças lançadas na ficha da ordem (inclui as estornadas). */
export function cobrancasDaOrdem(banco: Banco, ordemId: string) {
  return (banco.cobrancas ?? []).filter((c) => c.ordemId === ordemId);
}

export function totalCobrancas(banco: Banco, ordemId: string) {
  return cobrancasDaOrdem(banco, ordemId)
    .filter((c) => c.situacao === "ativa")
    .reduce((s, c) => s + c.valor, 0);
}

// ─────────────────────── Lançamentos financeiros da locadora ───────────────────────

/** Estado financeiro do lançamento — independente do status operacional da ordem. */
export type EstadoFinanceiro = "pendente" | "faturada" | "estornada";

export interface LancamentoLocadora {
  /** Identidade única e estável da cobrança. */
  id: string;
  ordemId: string;
  ordemCodigo: string;
  placa: string;
  locadoraId: string;
  data: string;
  tipo: TipoCobranca;
  descricao: string;
  valor: number;
  situacao: SituacaoCobranca;
  estado: EstadoFinanceiro;
  /** Só existe para o lançamento de serviço, que vive na própria ordem. */
  origem: "ordem" | "cobranca";
}

export const rotuloTipoCobranca = (t: TipoCobranca) => ROTULO_TIPO_COBRANCA[t] ?? "Outros";

/**
 * Snapshot só vale quando é um valor real. Zero (ou nulo) significa que a ordem
 * foi concluída sem tabela aplicável — nesse caso o valor volta a ser derivado
 * da tabela cadastrada, senão a operação ficaria congelada em R$ 0,00.
 */
const congelado = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

/**
 * Valor do SERVIÇO da ordem — snapshot congelado quando existe.
 * Não inclui taxas nem cobranças adicionais.
 */
/** Nome do serviço da ordem; ordens antigas sem catálogo mostram o rótulo genérico. */
function rotuloServico(banco: Banco, o: Ordem) {
  const nome = nomeServico(banco, o);
  return !nome || nome === "—" ? "Serviço de recolhimento" : nome;
}

export function valorServico(banco: Banco, o: Ordem) {
  // Operação já definida/liberada: vale SÓ o valor congelado na própria ordem.
  // A tabela de remuneração nunca reescreve o histórico de uma operação aprovada.
  if (o.liberadoEm || operacaoLiberada(banco, { ordemId: o.id })) {
    return congelado(o.valorFinalLocadora) ?? congelado(o.valorCobranca) ?? 0;
  }
  return congelado(o.valorCobranca) ?? precoCobranca(banco, o) ?? 0;
}


/** Todos os lançamentos financeiros gerados por uma ordem. */
export function lancamentosDaOrdem(banco: Banco, o: Ordem): LancamentoLocadora[] {
  const faturada = o.recebimentoPago;
  const linhas: LancamentoLocadora[] = [];

  if (o.status === "concluida") {
    const servico = valorServico(banco, o);
    if (servico > 0) {
      linhas.push({
        id: `servico-${o.id}`,
        ordemId: o.id,
        ordemCodigo: o.codigo,
        placa: o.placa,
        locadoraId: o.locadoraId,
        data: o.concluidaEm ?? o.criadaEm,
        tipo: "servico",
        descricao: rotuloServico(banco, o),
        valor: servico,
        situacao: "ativa",
        estado: faturada ? "faturada" : "pendente",
        origem: "ordem",
      });
    }
  }

  for (const c of cobrancasDaOrdem(banco, o.id)) {
    linhas.push({
      id: c.id,
      ordemId: o.id,
      ordemCodigo: o.codigo,
      placa: o.placa,
      locadoraId: o.locadoraId,
      data: c.criadoEm,
      tipo: c.tipo,
      descricao: c.nome || rotuloTipoCobranca(c.tipo),
      valor: c.valor,
      situacao: c.situacao,
      estado: c.situacao === "estornada" ? "estornada" : faturada ? "faturada" : "pendente",
      origem: "cobranca",
    });
  }

  return linhas;
}

/**
 * Vistorias concluídas viram receita exatamente como as ordens: mesmo tipo de
 * lançamento, mesma lista, mesma fatura. Nada de financeiro paralelo.
 */
export function lancamentosDaVistoria(banco: Banco, v: Vistoria): LancamentoLocadora[] {
  if (v.status !== "concluida") return [];
  const valor = valorCobrancaVistoria(banco, v);
  if (!(valor > 0)) return [];
  return [
    {
      id: `vistoria-${v.id}`,
      ordemId: v.id,
      ordemCodigo: v.codigo,
      placa: placaDaVistoria(banco, v),
      locadoraId: v.locadoraId,
      data: v.concluidaEm ?? v.criadaEm,
      tipo: "servico",
      descricao: "Vistoria de moto",
      valor,
      situacao: "ativa",
      estado: v.recebimentoPago ? "faturada" : "pendente",
      origem: "ordem",
    },
  ];
}

/** Vistorias que geram dinheiro (concluídas com valor). */
export function vistoriasFaturaveis(banco: Banco) {
  return (banco.vistorias ?? []).filter((v) => lancamentosDaVistoria(banco, v).length > 0);
}

/** Toda a receita da operação, em uma única lista: recolhimentos + vistorias. */
export function lancamentosLocadoras(banco: Banco): LancamentoLocadora[] {
  return [
    ...banco.ordens.flatMap((o) => lancamentosDaOrdem(banco, o)),
    ...(banco.vistorias ?? []).flatMap((v) => lancamentosDaVistoria(banco, v)),
  ];
}


/** Só o que efetivamente gera dinheiro (estornos ficam de fora dos somatórios). */
export const lancamentosAtivos = (linhas: LancamentoLocadora[]) =>
  linhas.filter((l) => l.situacao === "ativa");

export const somar = (linhas: LancamentoLocadora[]) => linhas.reduce((s, l) => s + l.valor, 0);

/**
 * Valor a receber da locadora por uma ordem: serviço + taxas + adicionais.
 * Usado por telas, faturas e relatórios — nunca recalcular de outra forma.
 */
export function valorReceber(banco: Banco, o: Ordem) {
  return somar(lancamentosAtivos(lancamentosDaOrdem(banco, o)));
}

/**
 * Valor devido ao agente por uma ordem concluída.
 * Conta a pagar aos agentes é INDEPENDENTE da conta a receber da locadora.
 */
export function valorPagar(banco: Banco, o: Ordem) {
  if (!o.agenteId) return 0;
  if (o.liberadoEm || operacaoLiberada(banco, { ordemId: o.id })) {
    return congelado(o.valorFinalAgente) ?? congelado(o.valorPagamento) ?? 0;
  }
  return congelado(o.valorPagamento) ?? precoPagamento(banco, o) ?? 0;
}

/** Repasse do agente principal nesta ordem. */
export function valorPagarPrincipal(banco: Banco, o: Ordem) {
  if (!o.agenteId) return 0;
  const proprio = congelado(o.valorPagamentoPrincipal);
  if (proprio !== null) return proprio;
  const total = valorPagar(banco, o);
  const auxiliar = congelado(o.valorPagamentoAuxiliar);
  if (auxiliar !== null) return Math.max(total - auxiliar, 0);
  return o.agenteAuxiliarId ? total / 2 : total;
}

/** Repasse do agente auxiliar nesta ordem. */
export function valorPagarAuxiliar(banco: Banco, o: Ordem) {
  if (!o.agenteAuxiliarId) return 0;
  const proprio = congelado(o.valorPagamentoAuxiliar);
  if (proprio !== null) return proprio;
  const total = valorPagar(banco, o);
  const principal = congelado(o.valorPagamentoPrincipal);
  if (principal !== null) return Math.max(total - principal, 0);
  return total / 2;
}


/** Quanto um agente específico recebe por esta ordem, seja principal ou auxiliar. */
export function valorPagarAgente(banco: Banco, o: Ordem, agenteId: string) {
  if (o.agenteId === agenteId) return valorPagarPrincipal(banco, o);
  if (o.agenteAuxiliarId === agenteId) return valorPagarAuxiliar(banco, o);
  return 0;
}

/** O agente participou desta ordem, em qualquer das duas funções. */
export const participaDaOrdem = (o: Ordem, agenteId: string) =>
  o.agenteId === agenteId || o.agenteAuxiliarId === agenteId;

/**
 * Ordens que geram dinheiro: concluídas OU canceladas que deixaram cobrança
 * ativa (é o caso da taxa de 50% após o início do deslocamento).
 */
export function ordensFaturaveis(banco: Banco) {
  return banco.ordens.filter(
    (o) => o.status === "concluida" || lancamentosAtivos(lancamentosDaOrdem(banco, o)).length > 0,
  );
}

// ─────────────────── Livro operacional único (recolhimentos + vistorias) ───────────────────

export type TipoOperacao = "recolhimento" | "vistoria";

export const ROTULO_OPERACAO: Record<TipoOperacao, string> = {
  recolhimento: "Recolhimento",
  vistoria: "Vistoria",
};

/**
 * Uma linha do financeiro operacional. Recolhimento e vistoria convivem na
 * mesma lista, discriminados por `tipo` — não existe financeiro paralelo.
 */
export interface OperacaoFinanceira {
  /** Chave estável usada na interface e na liquidação. */
  id: string;
  refId: string;
  tipo: TipoOperacao;
  codigo: string;
  placa: string;
  descricao: string;
  data: string;
  locadoraId: string;
  agenteId?: string;
  agenteAuxiliarId?: string;
  /** Valor devido pela locadora (serviço + taxas + adicionais). */
  receber: number;
  /** Valor devido ao conjunto de agentes desta operação. */
  pagar: number;
  recebimentoPago: boolean;
  pagamentoPago: boolean;
}

/** Todas as operações que produzem dinheiro, de qualquer tipo. */
export function operacoesFinanceiras(banco: Banco): OperacaoFinanceira[] {
  const deOrdens = ordensFaturaveis(banco).map<OperacaoFinanceira>((o) => ({
    id: `ordem-${o.id}`,
    refId: o.id,
    tipo: "recolhimento",
    codigo: o.codigo,
    placa: o.placa,
    descricao: rotuloServico(banco, o),
    data: o.concluidaEm ?? o.canceladaEm ?? o.criadaEm,
    locadoraId: o.locadoraId,
    ...(o.agenteId ? { agenteId: o.agenteId } : {}),
    ...(o.agenteAuxiliarId ? { agenteAuxiliarId: o.agenteAuxiliarId } : {}),
    receber: valorReceber(banco, o),
    pagar: valorPagar(banco, o),
    recebimentoPago: o.recebimentoPago ?? false,
    pagamentoPago: o.pagamentoPago ?? false,
  }));

  const deVistorias = (banco.vistorias ?? [])
    .filter((v) => v.status === "concluida")
    .map<OperacaoFinanceira>((v) => ({
      id: `vistoria-${v.id}`,
      refId: v.id,
      tipo: "vistoria",
      codigo: v.codigo,
      placa: placaDaVistoria(banco, v),
      descricao: "Vistoria de moto",
      data: v.concluidaEm ?? v.criadaEm,
      locadoraId: v.locadoraId,
      ...(v.agenteId ? { agenteId: v.agenteId } : {}),
      receber: valorCobrancaVistoria(banco, v),
      pagar: valorPagamentoVistoria(banco, v),
      recebimentoPago: v.recebimentoPago ?? false,
      pagamentoPago: v.pagamentoPago ?? false,
    }));

  return [...deOrdens, ...deVistorias].sort((a, b) => b.data.localeCompare(a.data));
}

/** Quanto um agente recebe por uma operação, seja ela recolhimento ou vistoria. */
export function valorPagarOperacao(banco: Banco, op: OperacaoFinanceira, agenteId: string) {
  if (op.tipo === "vistoria") return op.agenteId === agenteId ? op.pagar : 0;
  const ordem = banco.ordens.find((o) => o.id === op.refId);
  return ordem ? valorPagarAgente(banco, ordem, agenteId) : 0;
}

export interface LinhaFinanceira {
  id: string;
  nome: string;
  quantidade: number;
  total: number;
  pago: number;
  aberto: number;
  /** Operações discriminadas por tipo — a fonte da tabela na tela. */
  itens: OperacaoFinanceira[];
  /** Detalhamento por origem do dinheiro. */
  servicos: number;
  taxas: number;
  adicionais: number;
  estornado: number;
  lancamentos: LancamentoLocadora[];
}

export function contasAReceber(banco: Banco): LinhaFinanceira[] {
  const operacoes = operacoesFinanceiras(banco);
  const vistorias = banco.vistorias ?? [];
  return banco.locadoras
    .map((l) => {
      const itens = operacoes.filter((op) => op.locadoraId === l.id);
      const ordens = banco.ordens.filter(
        (o) => o.locadoraId === l.id && itens.some((op) => op.refId === o.id),
      );
      const dela = vistorias.filter(
        (v) => v.locadoraId === l.id && itens.some((op) => op.refId === v.id),
      );
      const todos = [
        ...ordens.flatMap((o) => lancamentosDaOrdem(banco, o)),
        ...dela.flatMap((v) => lancamentosDaVistoria(banco, v)),
      ];
      const ativos = lancamentosAtivos(todos);
      const total = itens.reduce((s, op) => s + op.receber, 0);
      const pago = itens.filter((op) => op.recebimentoPago).reduce((s, op) => s + op.receber, 0);
      return {
        id: l.id,
        nome: l.nome,
        quantidade: itens.length,
        total,
        pago,
        aberto: total - pago,
        itens,
        servicos: somar(ativos.filter((x) => x.tipo === "servico")),
        taxas: somar(ativos.filter((x) => x.tipo === "taxa_cancelamento")),
        adicionais: somar(
          ativos.filter((x) => x.tipo !== "servico" && x.tipo !== "taxa_cancelamento"),
        ),
        estornado: somar(todos.filter((x) => x.situacao === "estornada")),
        lancamentos: todos,
      };
    })
    .filter((l) => l.quantidade > 0);
}

/**
 * Contas a pagar: uma linha por agente, somando recolhimentos (principal e
 * auxiliar) e vistorias. O que manda aqui é a liquidação da própria operação —
 * adiantamentos e pagamentos avulsos vivem na aba de movimentações.
 */
export function contasAPagar(banco: Banco): LinhaFinanceira[] {
  const operacoes = operacoesFinanceiras(banco);
  return banco.agentes
    .map((a) => {
      const itens = operacoes
        .filter((op) => op.agenteId === a.id || op.agenteAuxiliarId === a.id)
        .map((op) => ({ ...op, pagar: valorPagarOperacao(banco, op, a.id) }))
        .filter((op) => op.pagar > 0 || op.pagamentoPago);
      const total = itens.reduce((s, op) => s + op.pagar, 0);
      const pago = itens.filter((op) => op.pagamentoPago).reduce((s, op) => s + op.pagar, 0);
      return {
        id: a.id,
        nome: a.nome,
        quantidade: itens.length,
        total,
        pago,
        aberto: total - pago,
        itens,
        servicos: total,
        taxas: 0,
        adicionais: 0,
        estornado: 0,
        lancamentos: [] as LancamentoLocadora[],
      };
    })
    .filter((a) => a.quantidade > 0);
}


/**
 * Resumo global — a mesma fórmula usada pelo dashboard, pelo financeiro e
 * pelos relatórios. Responde: quanto tenho a receber, de onde veio, quanto já
 * foi faturado, quanto continua pendente e quanto devo aos agentes.
 */
export function resumoFinanceiro(banco: Banco) {
  const ativos = lancamentosAtivos(lancamentosLocadoras(banco));
  const receita = somar(ativos);
  const servicos = somar(ativos.filter((l) => l.tipo === "servico"));
  const taxas = somar(ativos.filter((l) => l.tipo === "taxa_cancelamento"));
  const adicionais = receita - servicos - taxas;
  const faturado = somar(ativos.filter((l) => l.estado === "faturada"));
  const pendente = receita - faturado;
  const taxasPendentes = somar(
    ativos.filter((l) => l.tipo === "taxa_cancelamento" && l.estado === "pendente"),
  );
  const estornado = somar(
    lancamentosLocadoras(banco).filter((l) => l.situacao === "estornada"),
  );
  const despesa = contasAPagar(banco).reduce((s, l) => s + l.total, 0);
  const aPagarAgentes = contasAPagar(banco).reduce((s, l) => s + l.aberto, 0);
  const lucro = receita - despesa;
  const margem = receita > 0 ? lucro / receita : 0;
  return {
    receita,
    servicos,
    taxas,
    adicionais,
    faturado,
    pendente,
    taxasPendentes,
    estornado,
    despesa,
    aPagarAgentes,
    lucro,
    margem,
  };
}

// ─────────────────────── Auditoria de integridade financeira ───────────────────────

export interface Inconsistencia {
  id: string;
  gravidade: "alta" | "media";
  titulo: string;
  detalhe: string;
  ordemId?: string;
}

/**
 * Procura dinheiro perdido ou duplicado. Nada é corrigido automaticamente:
 * o objetivo é expor a divergência para decisão humana.
 */
export function inconsistenciasFinanceiras(banco: Banco): Inconsistencia[] {
  const achados: Inconsistencia[] = [];
  const locadoras = new Set(banco.locadoras.map((l) => l.id));

  for (const o of banco.ordens) {
    const linhas = lancamentosDaOrdem(banco, o);
    const ativos = lancamentosAtivos(linhas);

    if (o.status === "concluida" && ativos.length === 0) {
      achados.push({
        id: `sem-lancamento-${o.id}`,
        gravidade: "alta",
        titulo: `Ordem ${o.codigo} concluída sem valor financeiro`,
        detalhe: "Não há preço na tabela da locadora nem cobrança lançada na ficha.",
        ordemId: o.id,
      });
    }

    if (o.status === "cancelada" && o.iniciadaEm) {
      const temTaxa = linhas.some((l) => l.tipo === "taxa_cancelamento");
      if (!temTaxa) {
        achados.push({
          id: `taxa-faltando-${o.id}`,
          gravidade: "alta",
          titulo: `Ordem ${o.codigo} cancelada após o deslocamento sem taxa`,
          detalhe: "O deslocamento já havia começado, mas nenhuma taxa foi lançada.",
          ordemId: o.id,
        });
      }
    }

    const taxas = linhas.filter((l) => l.tipo === "taxa_cancelamento");
    if (taxas.length > 1) {
      achados.push({
        id: `taxa-duplicada-${o.id}`,
        gravidade: "alta",
        titulo: `Ordem ${o.codigo} com taxa de cancelamento duplicada`,
        detalhe: `${taxas.length} taxas lançadas na mesma ordem.`,
        ordemId: o.id,
      });
    }

    if (o.recebimentoPago && ativos.length === 0) {
      achados.push({
        id: `faturada-sem-valor-${o.id}`,
        gravidade: "media",
        titulo: `Ordem ${o.codigo} marcada como recebida sem lançamento ativo`,
        detalhe: "O recebimento existe, mas não há cobrança correspondente.",
        ordemId: o.id,
      });
    }

    if (!locadoras.has(o.locadoraId) && ativos.length > 0) {
      achados.push({
        id: `sem-locadora-${o.id}`,
        gravidade: "alta",
        titulo: `Ordem ${o.codigo} com dinheiro e sem locadora válida`,
        detalhe: "O lançamento não pode ser faturado sem locadora.",
        ordemId: o.id,
      });
    }
  }

  const ordens = new Set(banco.ordens.map((o) => o.id));
  for (const c of banco.cobrancas ?? []) {
    if (!ordens.has(c.ordemId)) {
      achados.push({
        id: `cobranca-orfa-${c.id}`,
        gravidade: "alta",
        titulo: `Cobrança "${c.nome}" sem ordem correspondente`,
        detalhe: `Valor de ${dinheiroExato(c.valor)} sem origem operacional.`,
      });
    }
    if (c.valor <= 0) {
      achados.push({
        id: `cobranca-zerada-${c.id}`,
        gravidade: "media",
        titulo: `Cobrança "${c.nome}" com valor inválido`,
        detalhe: "Cobranças precisam ter valor maior que zero.",
      });
    }
  }

  // Vistorias: mesma régua dos recolhimentos — nada concluído pode ficar órfão.
  const motos = new Set(banco.motos.map((m) => m.id));
  for (const v of banco.vistorias ?? []) {
    if (v.status !== "concluida") continue;

    if (valorCobrancaVistoria(banco, v) <= 0) {
      achados.push({
        id: `vistoria-sem-cobranca-${v.id}`,
        gravidade: "alta",
        titulo: `Vistoria ${v.codigo} concluída sem valor de cobrança`,
        detalhe:
          "A tabela de cobrança desta locadora não tem preço para o serviço Vistoria de Moto — configure em Tabelas de remuneração.",
      });
    }

    if (v.agenteId && valorPagamentoVistoria(banco, v) <= 0) {
      achados.push({
        id: `vistoria-sem-pagamento-${v.id}`,
        gravidade: "media",
        titulo: `Vistoria ${v.codigo} concluída sem remuneração do agente`,
        detalhe: "Não há preço de pagamento para vistoria na tabela do agente nem na padrão.",
      });
    }

    if (v.recebimentoPago && valorCobrancaVistoria(banco, v) <= 0) {
      achados.push({
        id: `vistoria-faturada-sem-valor-${v.id}`,
        gravidade: "media",
        titulo: `Vistoria ${v.codigo} marcada como recebida sem valor`,
        detalhe: "A liquidação existe, mas o valor da vistoria é zero.",
      });
    }

    if (!locadoras.has(v.locadoraId) || !motos.has(v.motoId)) {
      achados.push({
        id: `vistoria-orfa-${v.id}`,
        gravidade: "alta",
        titulo: `Vistoria ${v.codigo} sem vínculo operacional válido`,
        detalhe: "A locadora ou a moto de origem não existe mais no cadastro.",
      });
    }
  }

  return achados;

}


// ─────────────────────────── Saldo automático do agente ───────────────────────────

const inicioDoDia = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const inicioDoMes = () => {
  const d = inicioDoDia();
  d.setDate(1);
  return d;
};
const inicioDoAno = () => {
  const d = inicioDoMes();
  d.setMonth(0);
  return d;
};

export interface SaldoAgente {
  /** Tudo que o agente produziu em ordens concluídas. */
  produzido: number;
  bonificacoes: number;
  descontos: number;
  /** Adiantamentos entregues ao agente (permanecem no histórico para sempre). */
  adiantamentos: number;
  /** Adiantamentos ainda não compensados por um pagamento. */
  adiantamentoAberto: number;
  /** Pagamentos líquidos já realizados. */
  pago: number;
  /** Produção + bonificações − descontos − pagamentos − adiantamentos. */
  pendente: number;
  hoje: number;
  mes: number;
  ano: number;
  ordens: Ordem[];
  /** Vistorias concluídas pelo agente — remuneradas pela mesma tabela. */
  vistorias: Vistoria[];
  pagamentos: PagamentoAgente[];
  lancamentos: LancamentoAgente[];
  concluidas: number;
  canceladas: number;
  abertas: number;
  /** Tempo médio entre distribuição e conclusão, em minutos. */
  tempoMedio: number;
}

/** Lançamentos cancelados ou estornados não entram em nenhum somatório. */
const somaTipo = (ls: LancamentoAgente[], tipo: LancamentoAgente["tipo"]) =>
  ls.filter((l) => l.tipo === tipo && l.situacao === "ativo").reduce((s, l) => s + l.valor, 0);

/** Saldo derivado automaticamente das ordens concluídas e do livro-caixa. */
export function saldoAgente(banco: Banco, agenteId: string): SaldoAgente {
  const doAgente = banco.ordens.filter((o) => participaDaOrdem(o, agenteId));
  const ordens = doAgente.filter((o) => o.status === "concluida");
  const vistoriasDele = (banco.vistorias ?? []).filter((v) => v.agenteId === agenteId);
  const vistorias = vistoriasDele.filter((v) => v.status === "concluida");
  const pagamentos = banco.pagamentos.filter((p) => p.agenteId === agenteId);
  const lancamentos = banco.lancamentos
    .filter((l) => l.agenteId === agenteId && l.situacao !== "cancelado")
    .sort((a, b) => a.data.localeCompare(b.data));

  const somaDesde = (data: Date) =>
    ordens
      .filter((o) => o.concluidaEm && new Date(o.concluidaEm) >= data)
      .reduce((s, o) => s + valorPagarAgente(banco, o, agenteId), 0) +
    vistorias
      .filter((v) => v.concluidaEm && new Date(v.concluidaEm) >= data)
      .reduce((s, v) => s + valorPagamentoVistoria(banco, v), 0);

  const produzido =
    ordens.reduce((s, o) => s + valorPagarAgente(banco, o, agenteId), 0) +
    vistorias.reduce((s, v) => s + valorPagamentoVistoria(banco, v), 0);
  const bonificacoes = somaTipo(lancamentos, "bonificacao");
  const descontos = somaTipo(lancamentos, "desconto");
  const adiantamentos = somaTipo(lancamentos, "adiantamento");
  const compensados = somaTipo(lancamentos, "compensacao");
  // pagamentos legados continuam contando para não gerar inconsistência histórica
  const pago = somaTipo(lancamentos, "pagamento") + pagamentos.reduce((s, p) => s + p.valor, 0);

  const duracoes = ordens
    .filter((o) => o.distribuidaEm && o.concluidaEm)
    .map((o) => (new Date(o.concluidaEm!).getTime() - new Date(o.distribuidaEm!).getTime()) / 60000)
    .filter((m) => m > 0);

  return {
    produzido,
    bonificacoes,
    descontos,
    adiantamentos,
    adiantamentoAberto: Math.max(adiantamentos - compensados, 0),
    pago,
    pendente: produzido + bonificacoes - descontos - pago - adiantamentos,
    hoje: somaDesde(inicioDoDia()),
    mes: somaDesde(inicioDoMes()),
    ano: somaDesde(inicioDoAno()),
    ordens,
    vistorias,
    pagamentos,
    lancamentos,
    concluidas: ordens.length + vistorias.length,
    canceladas: doAgente.filter((o) => o.status === "cancelada").length,
    abertas:
      doAgente.filter((o) => o.status === "distribuida" || o.status === "em_andamento").length +
      vistoriasDele.filter((v) => v.status === "distribuida" || v.status === "em_andamento").length,
    tempoMedio: duracoes.length ? duracoes.reduce((s, m) => s + m, 0) / duracoes.length : 0,
  };
}

export interface LinhaExtrato {
  id: string;
  data: string;
  descricao: string;
  tipo: LancamentoAgente["tipo"];
  locadora: string;
  servico: string | null;
  producao: number;
  adiantamento: number;
  pagamento: number;
  desconto: number;
  bonificacao: number;
  /** Efeito no saldo do agente (positivo credita, negativo debita). */
  movimento: number;
  saldo: number;
}

/**
 * Extrato bancário do agente. Nenhuma movimentação é apagada: produção,
 * adiantamentos, pagamentos, descontos e bonificações convivem na mesma linha
 * do tempo, com saldo acumulado após cada movimento.
 */
export function extratoAgente(
  banco: Banco,
  agenteId: string,
  periodo?: { de?: string; ate?: string },
): LinhaExtrato[] {
  const s = saldoAgente(banco, agenteId);
  const nomeLocadora = (id: string) => banco.locadoras.find((l) => l.id === id)?.nome ?? "—";
  const vazio = { producao: 0, adiantamento: 0, pagamento: 0, desconto: 0, bonificacao: 0 };

  const movimentos: Omit<LinhaExtrato, "saldo">[] = [
    ...s.ordens.map((o) => ({
      ...vazio,
      id: `o-${o.id}`,
      data: o.concluidaEm ?? o.criadaEm,
      descricao: `Ordem ${o.codigo} · ${o.placa}${
        o.agenteAuxiliarId === agenteId ? " · auxiliar" : ""
      }`,
      tipo: "producao" as const,
      locadora: nomeLocadora(o.locadoraId),
      servico: nomeServico(banco, o),
      producao: valorPagarAgente(banco, o, agenteId),
      movimento: valorPagarAgente(banco, o, agenteId),
    })),
    ...s.pagamentos.map((p) => ({
      ...vazio,
      id: `p-${p.id}`,
      data: p.pagoEm,
      descricao: `Pagamento ${p.forma.toUpperCase()}${p.observacao ? ` · ${p.observacao}` : ""}`,
      tipo: "pagamento" as const,
      locadora: "—",
      servico: null,
      pagamento: p.valor,
      movimento: -p.valor,
    })),
    ...s.lancamentos
      .filter((l) => l.tipo !== "producao")
      .map((l) => {
        const sinal =
          l.situacao === "estornado"
            ? 0
            : l.tipo === "bonificacao"
              ? 1
              : l.tipo === "compensacao"
                ? 0
                : -1;
        return {
          ...vazio,
          id: `l-${l.id}`,
          data: l.data,
          descricao: `${l.descricao || ROTULO_LANCAMENTO[l.tipo]}${
            l.situacao === "estornado" ? " · estornado" : ""
          }`,
          tipo: l.tipo,
          locadora: "—",
          servico: null,
          adiantamento: l.tipo === "adiantamento" ? l.valor : 0,
          pagamento: l.tipo === "pagamento" ? l.valor : 0,
          desconto: l.tipo === "desconto" ? l.valor : 0,
          bonificacao: l.tipo === "bonificacao" ? l.valor : 0,
          movimento: sinal * l.valor,
        };
      }),
  ].sort((a, b) => a.data.localeCompare(b.data));

  let acumulado = 0;
  const linhas = movimentos.map((m) => {
    acumulado += m.movimento;
    return { ...m, saldo: acumulado };
  });

  const de = periodo?.de ? new Date(periodo.de) : null;
  const ate = periodo?.ate ? new Date(`${periodo.ate}T23:59:59`) : null;
  return linhas
    .filter((l) => (de ? new Date(l.data) >= de : true) && (ate ? new Date(l.data) <= ate : true))
    .reverse();
}

/** Produção diária do agente nos últimos dias — alimenta o gráfico. */
export function produtividadeAgente(banco: Banco, agenteId: string, dias = 14) {
  const base = inicioDoDia();
  const s = saldoAgente(banco, agenteId);
  return Array.from({ length: dias }, (_, i) => {
    const dia = new Date(base);
    dia.setDate(base.getDate() - (dias - 1 - i));
    const fim = new Date(dia);
    fim.setHours(23, 59, 59, 999);
    const doDia = s.ordens.filter(
      (o) => o.concluidaEm && new Date(o.concluidaEm) >= dia && new Date(o.concluidaEm) <= fim,
    );
    return {
      dia: dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      ordens: doDia.length,
      valor: doDia.reduce((acc, o) => acc + valorPagarAgente(banco, o, agenteId), 0),
    };
  });
}

// ─────────────────────────── Relatórios ───────────────────────────

export function rankingAgentes(banco: Banco) {
  return banco.agentes
    .map((a) => ({ agente: a, ...saldoAgente(banco, a.id) }))
    .sort((x, y) => y.produzido - x.produzido);
}

export function custosPorLocadora(banco: Banco) {
  const faturaveis = ordensFaturaveis(banco);
  return banco.locadoras
    .map((l) => {
      const ordens = faturaveis.filter((o) => o.locadoraId === l.id);
      const receita = ordens.reduce((s, o) => s + valorReceber(banco, o), 0);
      const custo = ordens.reduce((s, o) => s + valorPagar(banco, o), 0);
      return {
        id: l.id,
        nome: l.nome,
        quantidade: ordens.length,
        receita,
        custo,
        lucro: receita - custo,
      };
    })
    .filter((l) => l.quantidade > 0)
    .sort((a, b) => b.lucro - a.lucro);
}

export function custosPorCidade(banco: Banco) {
  const mapa = new Map<
    string,
    { cidade: string; quantidade: number; receita: number; custo: number }
  >();
  for (const o of ordensFaturaveis(banco)) {
    const cidade = o.cidade || "Sem cidade";
    const atual = mapa.get(cidade) ?? { cidade, quantidade: 0, receita: 0, custo: 0 };
    atual.quantidade += 1;
    atual.receita += valorReceber(banco, o);
    atual.custo += valorPagar(banco, o);
    mapa.set(cidade, atual);
  }
  return [...mapa.values()]
    .map((c) => ({ ...c, lucro: c.receita - c.custo }))
    .sort((a, b) => b.receita - a.receita);
}

export interface MovimentoFinanceiro {
  id: string;
  agenteId: string;
  agente: string;
  data: string;
  valor: number;
  forma: string;
  observacao: string;
  responsavel: string;
  comprovante: string;
  tipo: "pagamento" | "adiantamento";
  /** ativo | cancelado | estornado — estornados continuam visíveis no extrato. */
  situacao: SituacaoLancamento;
  motivo: string;
  /** Só para adiantamentos: já foi abatido de um pagamento? */
  compensado?: boolean;
}

function nomeAgente(banco: Banco, id: string) {
  return banco.agentes.find((a) => a.id === id)?.nome ?? "—";
}

function noPeriodo(data: string, periodo?: { de?: string; ate?: string }) {
  const de = periodo?.de ? new Date(periodo.de) : null;
  const ate = periodo?.ate ? new Date(`${periodo.ate}T23:59:59`) : null;
  const d = new Date(data);
  return (de ? d >= de : true) && (ate ? d <= ate : true);
}

/** Pagamentos líquidos realizados (livro-caixa novo + registros legados). */
export function pagamentosRealizados(
  banco: Banco,
  periodo?: { de?: string; ate?: string },
): MovimentoFinanceiro[] {
  const novos = banco.lancamentos
    .filter((l) => l.tipo === "pagamento")
    .map((l) => ({
      id: l.id,
      agenteId: l.agenteId,
      agente: nomeAgente(banco, l.agenteId),
      data: l.data,
      valor: l.valor,
      forma: l.forma,
      observacao: l.observacao,
      responsavel: l.responsavel,
      comprovante: l.comprovante,
      tipo: "pagamento" as const,
      situacao: l.situacao,
      motivo: l.motivo,
    }));
  const legados = banco.pagamentos.map((p) => ({
    id: p.id,
    agenteId: p.agenteId,
    agente: nomeAgente(banco, p.agenteId),
    data: p.pagoEm,
    valor: p.valor,
    forma: p.forma as string,
    observacao: p.observacao,
    responsavel: p.responsavel,
    comprovante: p.comprovante,
    tipo: "pagamento" as const,
    situacao: "ativo" as SituacaoLancamento,
    motivo: "",
  }));
  return [...novos, ...legados]
    .filter((m) => noPeriodo(m.data, periodo))
    .sort((a, b) => b.data.localeCompare(a.data));
}

/** Adiantamentos concedidos — nunca somem, ficam pendentes até compensação. */
export function adiantamentos(
  banco: Banco,
  periodo?: { de?: string; ate?: string },
): MovimentoFinanceiro[] {
  const compensados = new Set(
    banco.lancamentos.filter((l) => l.tipo === "compensacao").map((l) => l.referenciaId),
  );
  return banco.lancamentos
    .filter((l) => l.tipo === "adiantamento")
    .filter((l) => noPeriodo(l.data, periodo))
    .map((l) => ({
      id: l.id,
      agenteId: l.agenteId,
      agente: nomeAgente(banco, l.agenteId),
      data: l.data,
      valor: l.valor,
      forma: l.forma,
      observacao: l.observacao,
      responsavel: l.responsavel,
      comprovante: l.comprovante,
      tipo: "adiantamento" as const,
      situacao: l.situacao,
      motivo: l.motivo,
      compensado: compensados.has(l.id),
    }))
    .sort((a, b) => b.data.localeCompare(a.data));
}

/** Total de adiantamentos ainda em aberto na operação inteira. */
export function adiantamentoEmAberto(banco: Banco) {
  return banco.agentes.reduce((s, a) => s + saldoAgente(banco, a.id).adiantamentoAberto, 0);
}
