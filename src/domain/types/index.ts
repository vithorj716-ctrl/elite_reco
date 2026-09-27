import type {
  AvariaVistoria,
  EvidenciaVistoria,
  EventoVistoria,
  ItemChecklistCatalogo,
  ItemVistoria,
  Moto,
  Vistoria,
} from "./vistoria";
import type { Distribuicao, EventoDistribuicao } from "./distribuicao";

export * from "./vistoria";
export * from "./distribuicao";


export type Papel = "super_admin" | "operador" | "cliente" | "agente";

export type Prioridade = "baixa" | "normal" | "alta" | "urgente";

/**
 * Situação da ordem — espelha o enum `status_ordem` do banco.
 *
 * `pendente_definicao` é o estado de nascimento: a ordem existe, o administrador
 * é avisado, mas nenhum agente pode vê-la como oportunidade nem assumi-la.
 * `liberada` significa que os valores já foram definidos e congelados na ordem.
 */
export type StatusOrdem =
  | "pendente_definicao"
  | "liberada"
  | "distribuida"
  | "em_andamento"
  | "concluida"
  | "cancelada";

export type TipoServico =
  | "coleta_padrao"
  | "coleta_externa"
  | "viagem_especial"
  | "limpeza_moto"
  | "escapamento"
  | "captura_normal"
  | "captura_dificil"
  | "busca_especial"
  | "recolhimento_urbano"
  | "recolhimento_rural"
  | "tentativa_sem_sucesso"
  | "moto_patio"
  | "entrega"
  | "remocao_especial";

export type SituacaoAgente = "ativo" | "inativo" | "bloqueado";

export type FormaPagamento = "pix" | "ted" | "dinheiro";

export type TipoDocumento =
  "cnh" | "rg" | "cpf" | "residencia" | "contrato" | "comprovante" | "outro";

export type Conceito = "bom" | "regular" | "ruim";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha?: string | undefined;
  papel: Papel;
  locadoraId?: string | undefined;
  agenteId?: string | undefined;
}

export interface Locadora {
  id: string;
  nome: string;
  cnpj: string;
  cidade: string;
  uf: string;
  responsavel: string;
  telefone: string;
  email: string;
  ativa: boolean;
  criadaEm: string;
  /** Dados públicos obtidos pelo CNPJ. */
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  dataAbertura: string;
  naturezaJuridica: string;
  cnae: string;
  cep: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
  /** Dados comerciais internos. */
  limiteCredito: number;
  formaPagamento: string;
  prazoPagamento: number;
  observacoes: string;
  /** Tabela de cobrança utilizada por esta locadora. */
  tabelaCobrancaId?: string | undefined;
}

export interface Agente {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  ativo: boolean;
  /** Intenção do agente: botão de disponibilidade ligado. */
  online: boolean;
  /** Última presença confirmada pelo servidor (heartbeat). */
  vistoEm?: string | undefined;
  cpf: string;
  rg: string;
  nascimento: string;
  sexo: string;
  estadoCivil: string;
  whatsapp: string;
  email: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  uf: string;
  cnh: string;
  cnhCategoria: string;
  cnhValidade: string;
  contratadoEm: string;
  situacao: SituacaoAgente;
  regiao: string;
  cidadesAtendidas: string[];
  motoPlaca: string;
  motoModelo: string;
  motoAno: string;
  motoCor: string;
  motoRenavam: string;
  seguro: string;
  observacoes: string;
  foto: string;
}

export interface ChecklistItem {
  item: string;
  conceito: Conceito;
  descricao?: string | undefined;
  fotoId?: string | undefined;
}

export interface Foto {
  id: string;
  ordemId: string;
  dataUrl: string;
  etapa: string;
  criadaEm: string;
}

export interface EventoHistorico {
  id: string;
  ordemId: string;
  quem: string;
  quando: string;
  acao: string;
  detalhe?: string | undefined;
  gps?: string | undefined;
}

export interface Ordem {
  id: string;
  codigo: string;
  locadoraId: string;
  agenteId?: string | undefined;
  /** Agente auxiliar: participa do financeiro e do histórico, não do app de campo. */
  agenteAuxiliarId?: string | undefined;
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  valorPendente: number;
  telefone: string;
  endereco: string;
  cidade: string;
  observacoes?: string | undefined;
  linkRastreador?: string | undefined;
  prioridade: Prioridade;
  /** Serviço do catálogo — fonte de verdade. */
  servicoId?: string | undefined;
  /** Código legado do serviço; mantido apenas para leitura do histórico. */
  tipoServico?: TipoServico | undefined;
  status: StatusOrdem;
  criadaEm: string;
  distribuidaEm?: string | undefined;
  aceitaEm?: string | undefined;
  iniciadaEm?: string | undefined;
  chegadaEm?: string | undefined;
  concluidaEm?: string | undefined;
  canceladaEm?: string | undefined;
  motivoCancelamento?: string | undefined;
  /** Valor congelado na conclusão — imune a mudanças futuras de tabela. */
  valorCobranca?: number | undefined;
  valorPagamento?: number | undefined;
  /**
   * Valores comerciais CONGELADOS nesta operação, definidos pelo administrador.
   * A tabela de remuneração é só referência para novas operações: depois da
   * liberação, o valor histórico desta ordem é exclusivamente o que está aqui.
   */
  valorLocadora?: number | undefined;
  adicionalLocadoraHorario: number;
  valorFinalLocadora?: number | undefined;
  valorAgente?: number | undefined;
  adicionalAgenteHorario: number;
  valorFinalAgente?: number | undefined;
  /** Lançada dentro da faixa de horário especial (decidido pela criação). */
  horarioEspecial: boolean;
  /** Auditoria da definição/liberação administrativa. */
  definidoPor?: string | undefined;
  definidoEm?: string | undefined;
  liberadoPor?: string | undefined;
  liberadoEm?: string | undefined;
  /** Ordem anterior ao fluxo de definição: valor preservado como histórico. */
  legado: boolean;
  /** Repasse individual de cada agente nesta ordem. */
  valorPagamentoPrincipal?: number | undefined;
  valorPagamentoAuxiliar?: number | undefined;
  /** Quilometragem percorrida — usada nos serviços cobrados por km. */
  quantidadeKm?: number | undefined;
  checklist?: ChecklistItem[] | undefined;
  termoAceito?: boolean | undefined;
  /** Financeiro — liquidação do que a locadora deve pagar. */
  recebimentoPago?: boolean | undefined;
  /** Financeiro — liquidação do repasse ao agente. */
  pagamentoPago?: boolean | undefined;
  /** Dados extraídos pelo importador inteligente. */
  locatario: string;
  cpf: string;
  telefoneSecundario: string;
  host: string;
  pin: string;
  bairro: string;
  uf: string;
  cep: string;
  latitude: string;
  longitude: string;
  linkMaps: string;
  ultimoRastreio: string;
  situacaoFinanceira: string;
  statusInformado: string;
  resumoIa: string;
  textoOrigem: string;
}

export type TipoEvidencia = "foto" | "video" | "audio" | "documento" | "assinatura" | "comprovante";

export const ROTULO_EVIDENCIA: Record<TipoEvidencia, string> = {
  foto: "Foto",
  video: "Vídeo",
  audio: "Áudio",
  documento: "Documento",
  assinatura: "Assinatura",
  comprovante: "Comprovante",
};

export interface Evidencia {
  id: string;
  ordemId: string;
  locadoraId: string;
  agenteId?: string | undefined;
  usuarioId?: string | undefined;
  tipo: TipoEvidencia;
  etapa: string;
  nome: string;
  caminho: string;
  url: string;
  mime: string;
  tamanho: number;
  gps: string;
  observacao: string;
  criadaEm: string;
}

/** Cobrança avulsa lançada dentro da ordem (recolhimento, diária, guincho...). */
/** Tipos financeiros de cobrança da locadora. */
export type TipoCobranca =
  | "servico"
  | "taxa_cancelamento"
  | "km"
  | "adicional"
  | "viagem"
  | "outros";

/** Situação financeira da cobrança — estornada nunca é apagada. */
export type SituacaoCobranca = "ativa" | "estornada";

export const ROTULO_TIPO_COBRANCA: Record<TipoCobranca, string> = {
  servico: "Serviço",
  taxa_cancelamento: "Taxa de cancelamento",
  km: "Quilometragem",
  adicional: "Cobrança adicional",
  viagem: "Viagem",
  outros: "Outros",
};

export interface Cobranca {
  id: string;
  ordemId: string;
  locadoraId: string;
  nome: string;
  valor: number;
  observacao: string;
  criadoEm: string;
  tipo: TipoCobranca;
  situacao: SituacaoCobranca;
  estornadaEm: string | null;
  motivoEstorno: string;
}


export interface ApelidoLocadora {
  id: string;
  locadoraId: string;
  apelido: string;
}

export interface Importacao {
  id: string;
  locadoraId: string;
  arquivo: string;
  total: number;
  criadaEm: string;
  autor: string;
}

/**
 * Serviço do catálogo configurável. É a única fonte de verdade dos serviços
 * da operação: o enum antigo permanece apenas para leitura do histórico.
 */
export interface Servico {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  unidade: UnidadeItem;
  ativo: boolean;
  posicao: number;
  criadoEm: string;
  atualizadoEm: string;
}


export interface DocumentoAgente {
  id: string;
  agenteId: string;
  tipo: TipoDocumento;
  nome: string;
  url: string;
  criadoEm: string;
}

export interface PagamentoAgente {
  id: string;
  agenteId: string;
  valor: number;
  pagoEm: string;
  forma: FormaPagamento;
  observacao: string;
  comprovante: string;
  responsavel: string;
}

/** Tipos de aviso enviados ao agente e à locadora. */
export type TipoNotificacao =
  | "nova_ordem"
  | "alteracao"
  | "cancelamento"
  | "status"
  | "financeiro"
  | "operacional";

export interface Notificacao {
  id: string;
  usuarioId: string;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  ordemId?: string | undefined;
  lida: boolean;
  lidaEm?: string | undefined;
  criadaEm: string;
}

/** Registro imutável do cancelamento feito pela locadora. */
export interface CancelamentoOrdem {
  id: string;
  ordemId: string;
  locadoraId: string;
  valorOriginal: number;
  percentual: number;
  valorCobranca: number;
  motivo: string;
  aceite: boolean;
  textoAceite: string;
  canceladoEm: string;
}

export interface Banco {
  usuarios: Usuario[];
  locadoras: Locadora[];
  agentes: Agente[];
  ordens: Ordem[];
  fotos: Foto[];
  historico: EventoHistorico[];
  importacoes: Importacao[];
  documentos: DocumentoAgente[];
  pagamentos: PagamentoAgente[];
  evidencias: Evidencia[];
  cobrancas: Cobranca[];
  apelidos: ApelidoLocadora[];
  /** Catálogo configurável de serviços da operação. */
  servicos: Servico[];

  /** Tabelas de remuneração flexíveis criadas pelo administrador. */
  tabelas: TabelaRemuneracao[];
  itens: ItemRemuneracao[];
  /** Livro-caixa imutável dos agentes. */
  lancamentos: LancamentoAgente[];
  configuracoes: Record<string, string>;
  auditoria: RegistroAuditoria[];
  /** Avisos do usuário conectado (o banco só entrega os dele). */
  notificacoes: Notificacao[];
  /** Cancelamentos com taxa registrados pelas locadoras. */
  cancelamentos: CancelamentoOrdem[];
  /** Módulo de vistorias — motos e seu ciclo de 40 dias. */
  motos: Moto[];
  vistorias: Vistoria[];
  evidenciasVistoria: EvidenciaVistoria[];
  historicoVistoria: EventoVistoria[];
  /** Catálogo administrável dos itens de checklist da vistoria. */
  catalogoChecklist: ItemChecklistCatalogo[];
  itensVistoria: ItemVistoria[];
  avariasVistoria: AvariaVistoria[];
  /** Distribuição automática de serviços e sua linha do tempo. */
  distribuicoes: Distribuicao[];
  eventosDistribuicao: EventoDistribuicao[];

}


/** Sugestões rápidas de cobrança dentro da ficha da ordem. */
export const COBRANCAS_SUGERIDAS = [
  "Recolhimento",
  "Diária",
  "Entrega",
  "Lavagem",
  "Guincho",
  "Pátio",
  "Quilometragem",
  "Chaveiro",
] as const;

export const ITENS_CHECKLIST = [
  "Motor",
  "Pneus",
  "Rodas",
  "Farol",
  "Lanterna",
  "Retrovisores",
  "Banco",
  "Painel",
  "Carenagem",
  "Chave",
  "Limpeza da Moto",
  "Escapamento",
  "Observações",
] as const;

export const ROTULO_STATUS: Record<StatusOrdem, string> = {
  pendente_definicao: "Aguardando definição",
  liberada: "Liberada",
  distribuida: "Distribuída",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const ROTULO_SITUACAO_AGENTE: Record<SituacaoAgente, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  bloqueado: "Bloqueado",
};

export const ROTULO_FORMA_PAGAMENTO: Record<FormaPagamento, string> = {
  pix: "PIX",
  ted: "TED",
  dinheiro: "Dinheiro",
};

export const ROTULO_DOCUMENTO: Record<TipoDocumento, string> = {
  cnh: "CNH",
  rg: "RG",
  cpf: "CPF",
  residencia: "Comprovante de residência",
  contrato: "Contrato",
  comprovante: "Comprovante",
  outro: "Outro",
};

// ─────────────────── Remuneração flexível (sem valores engessados) ───────────────────

export type EscopoTabela = "cobranca" | "pagamento";

export const ROTULO_ESCOPO: Record<EscopoTabela, string> = {
  cobranca: "Cobrança da locadora",
  pagamento: "Pagamento ao agente",
};

export interface TabelaRemuneracao {
  id: string;
  nome: string;
  escopo: EscopoTabela;
  locadoraId?: string | undefined;
  agenteId?: string | undefined;
  padrao: boolean;
  ativa: boolean;
  observacao: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ItemRemuneracao {
  id: string;
  tabelaId: string;
  /** Serviço do catálogo ligado a esta linha. */
  servicoId?: string | undefined;
  /** Código legado do serviço; espelha o código do catálogo. */
  codigo: string;
  nome: string;
  descricao: string;
  valor: number;
  /** "fixo" = valor fechado; "km" = valor multiplicado pela quilometragem. */
  unidade: UnidadeItem;
  status: string;
  observacao: string;
  ativo: boolean;
  posicao: number;
}

export type UnidadeItem = "fixo" | "km";

export const ROTULO_UNIDADE: Record<UnidadeItem, string> = {
  fixo: "Valor fixo",
  km: "Por quilômetro",
};

export type TipoLancamento =
  "producao" | "adiantamento" | "pagamento" | "desconto" | "bonificacao" | "compensacao";

export const ROTULO_LANCAMENTO: Record<TipoLancamento, string> = {
  producao: "Produção",
  adiantamento: "Adiantamento",
  pagamento: "Pagamento",
  desconto: "Desconto",
  bonificacao: "Bonificação",
  compensacao: "Compensação de adiantamento",
};

export interface LancamentoAgente {
  id: string;
  agenteId: string;
  tipo: TipoLancamento;
  valor: number;
  data: string;
  descricao: string;
  forma: string;
  observacao: string;
  comprovante: string;
  ordemId?: string | undefined;
  referenciaId?: string | undefined;
  responsavel: string;
  criadoEm: string;
  /** Um lançamento nunca some do extrato: ele muda de situação. */
  situacao: SituacaoLancamento;
  motivo: string;
}

export type SituacaoLancamento = "ativo" | "cancelado" | "estornado";

export const ROTULO_SITUACAO_LANCAMENTO: Record<SituacaoLancamento, string> = {
  ativo: "Ativo",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

export interface RegistroAuditoria {
  id: string;
  entidade: string;
  registroId?: string | undefined;
  acao: string;
  quemNome: string;
  dados: unknown;
  criadoEm: string;
}

export const CHAVE_TERMO_RECIBO = "recibo_termo";
export const CHAVE_QRCODE_RECIBO = "recibo_qrcode";
