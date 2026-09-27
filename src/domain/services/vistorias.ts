/**
 * Regras do módulo de Vistorias.
 *
 * Nada aqui duplica cadastro: locadora, agente, serviço e tabelas de preço são
 * exatamente os mesmos já usados pelos recolhimentos. Este arquivo responde
 * apenas três perguntas: em que prazo a moto está, quanto a vistoria vale para
 * a locadora e quanto vale para o agente.
 */
import {
  itensDa,
  tabelaDaLocadora,
  tabelaDoAgente,
  tabelaPadrao,
} from "@/domain/services/remuneracao";
import { operacaoLiberada } from "@/domain/services/liberacao";
import {
  CICLO_VISTORIA_DIAS,
  CODIGO_SERVICO_VISTORIA,
  type Banco,
  type Moto,
  type Servico,
  type StatusPrazo,
  type TabelaRemuneracao,
  type Vistoria,
} from "@/domain/types";

const DIA = 86_400_000;

/** Serviço "Vistoria de Moto" do catálogo existente. */
export function servicoVistoria(banco: Banco): Servico | null {
  return (banco.servicos ?? []).find((s) => s.codigo === CODIGO_SERVICO_VISTORIA) ?? null;
}

// ───────────────────────────── Prazo (ciclo de 40 dias) ─────────────────────────────

/** Dias restantes até a próxima vistoria — sempre calculado, nunca salvo. */
export function diasRestantes(moto: Moto, referencia = new Date()): number | null {
  if (!moto.proximaVistoriaEm) return null;
  const alvo = new Date(moto.proximaVistoriaEm).getTime();
  const hoje = new Date(referencia);
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((alvo - hoje.getTime()) / DIA);
}

/** Semáforo do prazo: verde em dia, amarelo perto, vermelho vencida. */
export function statusPrazo(moto: Moto, referencia = new Date()): StatusPrazo {
  if (moto.situacao === "inativa") return "em_dia";
  const dias = diasRestantes(moto, referencia);
  if (dias === null) return "sem_vistoria";
  if (dias < 0) return "vencida";
  if (dias <= 7) return "proxima";
  return "em_dia";
}

export const ROTULO_PRAZO: Record<StatusPrazo, string> = {
  em_dia: "Em dia",
  proxima: "Próxima do vencimento",
  vencida: "Vencida",
  sem_vistoria: "Aguardando 1ª vistoria",
};

/** Classes do semáforo aplicadas direto na linha/card — não só na legenda. */
export const TOM_PRAZO: Record<StatusPrazo, "sucesso" | "alerta" | "perigo" | "neutro"> = {
  em_dia: "sucesso",
  proxima: "alerta",
  vencida: "perigo",
  sem_vistoria: "neutro",
};

export const LINHA_PRAZO: Record<StatusPrazo, string> = {
  em_dia: "border-l-2 border-l-success/70",
  proxima: "border-l-2 border-l-warning/80 bg-warning/[0.04]",
  vencida: "border-l-2 border-l-destructive/80 bg-destructive/[0.05]",
  sem_vistoria: "border-l-2 border-l-info/60",
};

/** Data prevista da próxima vistoria a partir de uma conclusão. */
export function proximaData(conclusao: string | Date): string {
  const base = new Date(conclusao);
  base.setDate(base.getDate() + CICLO_VISTORIA_DIAS);
  return base.toISOString();
}

// ───────────────────────────── Valores (tabelas existentes) ─────────────────────────────

function valorNaTabela(banco: Banco, tabela: TabelaRemuneracao | null): number | null {
  if (!tabela) return null;
  const servico = servicoVistoria(banco);
  const linha = itensDa(banco, tabela.id).find(
    (i) =>
      i.ativo && ((servico && i.servicoId === servico.id) || i.codigo === CODIGO_SERVICO_VISTORIA),
  );
  return linha ? linha.valor : null;
}

/** Tabela de cobrança que precifica a vistoria desta locadora. */
export function tabelaCobrancaVistoria(banco: Banco, locadoraId: string) {
  const daLocadora = tabelaDaLocadora(banco, locadoraId, "cobranca");
  if (daLocadora && valorNaTabela(banco, daLocadora) !== null) return daLocadora;
  const padrao = tabelaPadrao(banco, "cobranca");
  return padrao && valorNaTabela(banco, padrao) !== null ? padrao : (daLocadora ?? padrao ?? null);
}

/** Tabela de pagamento que remunera o agente por esta vistoria. */
export function tabelaPagamentoVistoria(banco: Banco, agenteId?: string | null) {
  const doAgente = agenteId ? tabelaDoAgente(banco, agenteId) : null;
  if (doAgente && valorNaTabela(banco, doAgente) !== null) return doAgente;
  const padrao = tabelaPadrao(banco, "pagamento");
  return padrao && valorNaTabela(banco, padrao) !== null ? padrao : (doAgente ?? padrao ?? null);
}

/** Quanto a locadora paga por esta vistoria, pela tabela vinculada a ela. */
export function precoCobrancaVistoria(banco: Banco, locadoraId: string): number | null {
  return valorNaTabela(banco, tabelaCobrancaVistoria(banco, locadoraId));
}

/** Quanto o agente recebe por esta vistoria, pela tabela de remuneração dele. */
export function precoPagamentoVistoria(banco: Banco, agenteId?: string | null): number | null {
  return valorNaTabela(banco, tabelaPagamentoVistoria(banco, agenteId));
}

const congelado = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;

/** Valor a receber da locadora — snapshot congelado quando existe. */
export function valorCobrancaVistoria(banco: Banco, v: Vistoria) {
  // Vistoria já liberada pelo administrador: vale só o valor gravado nela.
  if (operacaoLiberada(banco, { vistoriaId: v.id })) return congelado(v.valorCobranca) ?? 0;
  return congelado(v.valorCobranca) ?? precoCobrancaVistoria(banco, v.locadoraId) ?? 0;
}

/** Valor a pagar ao agente — snapshot congelado quando existe. */
export function valorPagamentoVistoria(banco: Banco, v: Vistoria) {
  if (!v.agenteId) return 0;
  if (operacaoLiberada(banco, { vistoriaId: v.id })) return congelado(v.valorPagamento) ?? 0;
  return congelado(v.valorPagamento) ?? precoPagamentoVistoria(banco, v.agenteId) ?? 0;
}

// ───────────────────────────── Consultas de apoio ─────────────────────────────

export const motoDaVistoria = (banco: Banco, v: Vistoria) =>
  banco.motos.find((m) => m.id === v.motoId) ?? null;

export const placaDaVistoria = (banco: Banco, v: Vistoria) =>
  motoDaVistoria(banco, v)?.placa ?? "—";

export const nomeLocadora = (banco: Banco, id: string) =>
  banco.locadoras.find((l) => l.id === id)?.nome ?? "—";

export const nomeAgente = (banco: Banco, id?: string | null) =>
  (id ? banco.agentes.find((a) => a.id === id)?.nome : null) ?? "—";

/** Vistorias em aberto de uma moto (não concluídas e não canceladas). */
export const vistoriasAbertas = (banco: Banco, motoId?: string) =>
  banco.vistorias.filter(
    (v) => (!motoId || v.motoId === motoId) && v.status !== "concluida" && v.status !== "cancelada",
  );

/** Histórico completo da moto — nada é substituído. */
export const historicoDaMoto = (banco: Banco, motoId: string) =>
  banco.vistorias
    .filter((v) => v.motoId === motoId)
    .sort((a, b) =>
      (b.concluidaEm ?? b.solicitadaEm).localeCompare(a.concluidaEm ?? a.solicitadaEm),
    );

export interface ResumoVistorias {
  motosAtivas: number;
  pendentes: number;
  distribuidas: number;
  emAndamento: number;
  concluidas: number;
  proximas: number;
  vencidas: number;
  solicitacoes: number;
}

/** Números do painel de vistorias. */
export function resumoVistorias(banco: Banco): ResumoVistorias {
  const motos = banco.motos.filter((m) => m.situacao === "ativa");
  const prazos = motos.map((m) => statusPrazo(m));
  const v = banco.vistorias;
  return {
    motosAtivas: motos.length,
    pendentes: v.filter((x) => x.status === "pendente").length,
    distribuidas: v.filter((x) => x.status === "distribuida").length,
    emAndamento: v.filter((x) => x.status === "em_andamento").length,
    concluidas: v.filter((x) => x.status === "concluida").length,
    proximas: prazos.filter((p) => p === "proxima").length,
    vencidas: prazos.filter((p) => p === "vencida").length,
    solicitacoes: v.filter((x) => x.status === "pendente" && x.origem === "locadora").length,
  };
}

// ───────────────────────────── Inspeção: itens, avarias e fotos ─────────────────────────────

export const itensDaVistoria = (banco: Banco, vistoriaId: string) =>
  (banco.itensVistoria ?? [])
    .filter((i) => i.vistoriaId === vistoriaId)
    .sort((a, b) => a.posicao - b.posicao || a.item.localeCompare(b.item));

export const avariasDaVistoria = (banco: Banco, vistoriaId: string) =>
  (banco.avariasVistoria ?? []).filter((a) => a.vistoriaId === vistoriaId);

export const fotosDaVistoria = (banco: Banco, vistoriaId: string) =>
  banco.evidenciasVistoria.filter((e) => e.vistoriaId === vistoriaId);

export const fotosDaAvaria = (banco: Banco, avariaId: string) =>
  banco.evidenciasVistoria.filter((e) => e.avariaId === avariaId);

export const catalogoAtivo = (banco: Banco) =>
  (banco.catalogoChecklist ?? []).filter((c) => c.ativo).sort((a, b) => a.posicao - b.posicao);

export interface ResumoInspecao {
  bons: number;
  regulares: number;
  ruins: number;
  naoAvaliados: number;
  fotos: number;
  avarias: number;
}

/** Números da tela de revisão e do laudo. */
export function resumoInspecao(banco: Banco, vistoriaId: string): ResumoInspecao {
  const itens = itensDaVistoria(banco, vistoriaId);
  return {
    bons: itens.filter((i) => i.condicao === "bom").length,
    regulares: itens.filter((i) => i.condicao === "regular").length,
    ruins: itens.filter((i) => i.condicao === "ruim").length,
    naoAvaliados: itens.filter((i) => i.condicao === "nao_avaliado").length,
    fotos: fotosDaVistoria(banco, vistoriaId).length,
    avarias: avariasDaVistoria(banco, vistoriaId).length,
  };
}

export interface Pendencia {
  chave: string;
  texto: string;
}

/**
 * Tudo o que ainda impede a conclusão — a mesma regra que o banco aplica,
 * antecipada na tela para o agente saber exatamente o que falta.
 * A foto do chassi nunca entra aqui: ela não é obrigatória.
 */
export function pendenciasDaVistoria(
  banco: Banco,
  vistoria: Vistoria,
  fotosObrigatorias: readonly { etapa: string; rotulo: string }[] = [],
): Pendencia[] {
  const lista: Pendencia[] = [];
  const fotos = fotosDaVistoria(banco, vistoria.id);
  const itens = itensDaVistoria(banco, vistoria.id);
  const avarias = avariasDaVistoria(banco, vistoria.id);

  if (vistoria.km === undefined || vistoria.km === null) {
    lista.push({ chave: "km", texto: "Registre a quilometragem da motocicleta." });
  }

  const faltandoFoto = fotosObrigatorias.filter(
    (f) => !fotos.some((e) => e.etapa === f.etapa && !e.avariaId),
  );
  if (faltandoFoto.length > 0) {
    lista.push({
      chave: "fotos",
      texto: `Fotos pendentes: ${faltandoFoto.map((f) => f.rotulo).join(", ")}.`,
    });
  }

  const pendentes = itens.filter((i) => i.obrigatorio && i.condicao === "nao_avaliado");
  if (itens.length === 0) {
    lista.push({ chave: "checklist", texto: "Avalie o checklist da motocicleta." });
  } else if (pendentes.length > 0) {
    lista.push({
      chave: "checklist",
      texto: `Existem ${pendentes.length} item(ns) que ainda não foram avaliados.`,
    });
  }

  for (const item of itens.filter((i) => i.condicao === "ruim")) {
    const daAvaria = avarias.filter((a) => a.itemId === item.id && a.descricao.trim());
    const comFoto = daAvaria.some((a) => fotosDaAvaria(banco, a.id).length > 0);
    if (daAvaria.length === 0) {
      lista.push({ chave: `avaria-${item.id}`, texto: `${item.item}: descreva a avaria.` });
    } else if (!comFoto) {
      lista.push({ chave: `foto-${item.id}`, texto: `${item.item}: anexe a foto da avaria.` });
    }
  }

  if (!vistoria.termoAceito) {
    lista.push({ chave: "termo", texto: "Confirme o termo de responsabilidade." });
  }

  return lista;
}
