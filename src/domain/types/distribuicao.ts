/**
 * Distribuição automática de serviços.
 *
 * Cada operação criada a partir do cadastro de uma motocicleta gera uma linha
 * de distribuição com o serviço e os valores congelados no momento da decisão.
 * O agente apenas aceita, recusa e escolhe auxiliar; corrigir serviço, valor ou
 * agente é sempre ação do administrador — e tudo fica registrado.
 */

export type TipoDistribuicao = "vistoria" | "recolhimento";

export type StatusDistribuicao =
  | "aguardando_definicao"
  | "aguardando_distribuicao"
  | "distribuida"
  | "notificada"
  | "aceita"
  | "recusada"
  | "em_execucao"
  | "concluida"
  | "cancelada"
  | "redistribuida";

export type OrigemDistribuicao = "automatica" | "manual" | "redistribuida";

export interface AgenteSorteio {
  id: string;
  nome: string;
  cidade?: string | undefined;
  motivo?: string | undefined;
}

export interface Distribuicao {
  id: string;
  tipo: TipoDistribuicao;
  ordemId?: string | undefined;
  vistoriaId?: string | undefined;
  motoId?: string | undefined;
  locadoraId: string;
  gatilho: string;
  servicoId?: string | undefined;
  servicoNome: string;
  /** Snapshot: imune a mudanças futuras nas tabelas de preço. */
  valorCobranca: number;
  valorPagamento: number;
  /** Composição congelada no momento da liberação pelo administrador. */
  valorCobrancaBase: number;
  valorCobrancaAdicional: number;
  valorPagamentoBase: number;
  valorPagamentoAdicional: number;
  /** Referências lidas das tabelas no lançamento — apoiam a decisão do admin. */
  referenciaCobranca: number;
  referenciaPagamento: number;
  referenciaAdicionalCobranca: number;
  referenciaAdicionalPagamento: number;
  /** Lançada dentro da faixa de horário especial configurada. */
  horarioEspecial: boolean;
  aprovadaEm?: string | undefined;
  aprovadaPorNome: string;
  agenteId?: string | undefined;
  agenteAuxiliarId?: string | undefined;
  status: StatusDistribuicao;
  origem: OrigemDistribuicao;
  regra: string;
  elegiveis: AgenteSorteio[];
  descartados: AgenteSorteio[];
  motivo: string;
  distribuidaEm?: string | undefined;
  notificadaEm?: string | undefined;
  aceitaEm?: string | undefined;
  recusadaEm?: string | undefined;
  concluidaEm?: string | undefined;
  canceladaEm?: string | undefined;
  criadaEm: string;
}

export interface EventoDistribuicao {
  id: string;
  distribuicaoId: string;
  acao: string;
  detalhe: string;
  automatico: boolean;
  quemNome: string;
  quando: string;
}

export const ROTULO_STATUS_DISTRIBUICAO: Record<StatusDistribuicao, string> = {
  aguardando_definicao: "Aguardando definição do admin",
  aguardando_distribuicao: "Aguardando distribuição",
  distribuida: "Distribuída",
  notificada: "Notificada",
  aceita: "Aceita",
  recusada: "Recusada",
  em_execucao: "Em execução",
  concluida: "Concluída",
  cancelada: "Cancelada",
  redistribuida: "Redistribuída",
};

export const ROTULO_ORIGEM_DISTRIBUICAO: Record<OrigemDistribuicao, string> = {
  automatica: "Distribuição automática",
  manual: "Distribuição manual",
  redistribuida: "Redistribuída pelo administrador",
};

export const ROTULO_TIPO_DISTRIBUICAO: Record<TipoDistribuicao, string> = {
  vistoria: "Vistoria",
  recolhimento: "Recolhimento",
};
