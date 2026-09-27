/**
 * Módulo de Vistorias de Motos.
 *
 * Reutiliza integralmente locadoras, agentes, usuários, catálogo de serviços,
 * tabelas de remuneração, financeiro, notificações, Storage e Realtime já
 * existentes. Aqui só vivem as entidades realmente novas: a moto, a vistoria,
 * suas evidências e seu histórico.
 */

export type SituacaoMoto = "ativa" | "inativa";

export type StatusVistoria =
  | "pendente"
  | "distribuida"
  | "em_andamento"
  | "aguardando_complementacao"
  | "concluida"
  | "cancelada";

/** Quem originou a vistoria — a locadora pedindo ou a própria central. */
export type OrigemVistoria = "central" | "locadora" | "ciclo";

/** Condição de cada item avaliado. Nada nasce "bom": nasce não avaliado. */
export type CondicaoItem = "nao_avaliado" | "bom" | "regular" | "ruim";

export const ROTULO_CONDICAO: Record<CondicaoItem, string> = {
  nao_avaliado: "Não avaliado",
  bom: "Bom",
  regular: "Regular",
  ruim: "Ruim",
};

export const TOM_CONDICAO: Record<CondicaoItem, "neutro" | "sucesso" | "alerta" | "perigo"> = {
  nao_avaliado: "neutro",
  bom: "sucesso",
  regular: "alerta",
  ruim: "perigo",
};

/** Categoria da foto — o registro fotográfico não é uma lista genérica. */
export type CategoriaFoto = "geral" | "painel" | "avaria" | "outro";

export const ROTULO_CATEGORIA_FOTO: Record<CategoriaFoto, string> = {
  geral: "Foto geral",
  painel: "Painel",
  avaria: "Avaria",
  outro: "Outro",
};

/** Código do serviço de vistoria dentro do catálogo existente. */
export const CODIGO_SERVICO_VISTORIA = "vistoria_moto";

/** Ciclo obrigatório entre vistorias, em dias. */
export const CICLO_VISTORIA_DIAS = 40;

export const ROTULO_STATUS_VISTORIA: Record<StatusVistoria, string> = {
  pendente: "Aguardando vistoria",
  distribuida: "Distribuída",
  em_andamento: "Em andamento",
  aguardando_complementacao: "Aguardando complementação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const ROTULO_SITUACAO_MOTO: Record<SituacaoMoto, string> = {
  ativa: "Ativa",
  inativa: "Inativa",
};

export const ROTULO_ORIGEM_VISTORIA: Record<OrigemVistoria, string> = {
  central: "Central",
  locadora: "Solicitação da locadora",
  ciclo: "Ciclo de 40 dias",
};


/**
 * Checklist próprio da vistoria — não se mistura com o do recolhimento.
 * Sem documentação e sem foto de chassi, conforme a operação real.
 */
export const ITENS_CHECKLIST_VISTORIA = [
  "Estado geral",
  "Carenagem",
  "Pneus",
  "Rodas",
  "Freios",
  "Suspensão",
  "Guidão",
  "Painel",
  "Iluminação",
  "Setas",
  "Retrovisores",
  "Banco",
  "Escapamento",
  "Motor",
  "Acessórios",
] as const;

/**
 * Fotos obrigatórias da vistoria. Sem foto de chassi: a identificação é feita
 * pela placa e pelo cadastro global da moto.
 */
export const FOTOS_VISTORIA = [
  { etapa: "frente", rotulo: "Frente", categoria: "geral" },
  { etapa: "traseira", rotulo: "Traseira", categoria: "geral" },
  { etapa: "lateral_esquerda", rotulo: "Lateral esquerda", categoria: "geral" },
  { etapa: "lateral_direita", rotulo: "Lateral direita", categoria: "geral" },
  { etapa: "painel", rotulo: "Painel / odômetro", categoria: "painel" },
] as const satisfies readonly { etapa: string; rotulo: string; categoria: CategoriaFoto }[];


/** Texto do termo aceito pelo agente antes de concluir a vistoria. */
export const TERMO_VISTORIA =
  "Declaro que executei a vistoria presencialmente, que as fotos enviadas são da moto indicada e que o checklist reflete o estado real do veículo neste momento.";

export interface Moto {
  id: string;
  locadoraId: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor: string;
  chassi: string;
  observacoes: string;
  situacao: SituacaoMoto;
  /** Rastreador da moto — dado único e global, consumido por vistoria e recolhimento. */
  host: string;
  pin: string;

  /** Datas reais — os dias restantes são sempre calculados na hora. */
  ultimaVistoriaEm?: string | undefined;
  proximaVistoriaEm?: string | undefined;
  criadaEm: string;
  atualizadoEm: string;
}

export interface Vistoria {
  id: string;
  codigo: string;
  motoId: string;
  locadoraId: string;
  agenteId?: string | undefined;
  servicoId?: string | undefined;
  status: StatusVistoria;
  origem: OrigemVistoria;
  observacoes: string;
  checklist?: import("./index").ChecklistItem[] | undefined;
  motivoCancelamento: string;

  /** Dados da solicitação — mesmos campos operacionais do recolhimento. */
  contatoNome: string;
  contatoTelefone: string;
  contatoEmail: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  linkMaps: string;
  host: string;
  pin: string;
  pinValidade: string;
  textoOrigem: string;

  /** Dados da inspeção — registrados em campo, nunca editáveis depois. */
  km?: number | undefined;
  latitude: string;
  longitude: string;

  solicitadaEm: string;
  distribuidaEm?: string | undefined;
  aceitaEm?: string | undefined;
  iniciadaEm?: string | undefined;
  chegadaEm?: string | undefined;
  concluidaEm?: string | undefined;
  canceladaEm?: string | undefined;
  termoAceito: boolean;
  termoAceitoEm?: string | undefined;
  /** Valores congelados na conclusão — imunes a mudanças futuras de tabela. */
  valorCobranca?: number | undefined;
  valorPagamento?: number | undefined;
  tabelaCobrancaId?: string | undefined;
  tabelaPagamentoId?: string | undefined;
  recebimentoPago: boolean;
  pagamentoPago: boolean;
  criadaEm: string;
  atualizadoEm: string;
}

/** Item do catálogo administrável do checklist. */
export interface ItemChecklistCatalogo {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  obrigatorio: boolean;
  fotoQuandoRuim: boolean;
  fotoQuandoRegular: boolean;
  posicao: number;
  criadoEm: string;
  atualizadoEm: string;
}

/** Item efetivamente avaliado dentro de uma vistoria. */
export interface ItemVistoria {
  id: string;
  vistoriaId: string;
  catalogoId?: string | undefined;
  codigo: string;
  item: string;
  condicao: CondicaoItem;
  obrigatorio: boolean;
  observacao: string;
  posicao: number;
  avaliadoEm?: string | undefined;
  criadoEm: string;
  atualizadoEm: string;
}

/** Avaria identificada — vive fora do checklist e pode ter várias fotos. */
export interface AvariaVistoria {
  id: string;
  vistoriaId: string;
  itemId?: string | undefined;
  componente: string;
  condicao: "regular" | "ruim";
  descricao: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface EvidenciaVistoria {
  id: string;
  vistoriaId: string;
  motoId: string;
  locadoraId: string;
  agenteId?: string | undefined;
  usuarioId?: string | undefined;
  avariaId?: string | undefined;
  categoria: CategoriaFoto;
  tipo: string;
  etapa: string;
  nome: string;
  caminho: string;
  url: string;
  mime: string;
  tamanho: number;
  gps: string;
  km?: number | undefined;
  latitude: string;
  longitude: string;
  observacao: string;
  criadaEm: string;
}

export interface EventoVistoria {
  id: string;
  vistoriaId: string;
  motoId?: string | undefined;
  quem: string;
  quando: string;
  acao: string;
  detalhe: string;
  gps: string;
}


/** Semáforo do prazo da moto — a cor vai direto na linha/card, não só na legenda. */
export type StatusPrazo = "em_dia" | "proxima" | "vencida" | "sem_vistoria";
