/**
 * Conversão entre as linhas do banco (snake_case) e as entidades do domínio
 * (camelCase). Nenhuma tela conhece o formato do banco — só estas funções.
 */
import type { Tables } from "@/integrations/supabase/types";
import type {
  Agente,
  ApelidoLocadora,
  CancelamentoOrdem,
  Notificacao,
  TipoNotificacao,
  ChecklistItem,
  Cobranca,
  DocumentoAgente,
  Evidencia,
  TipoEvidencia,
  EventoHistorico,
  Foto,
  FormaPagamento,
  Importacao,
  Locadora,
  Ordem,
  PagamentoAgente,
  Papel,
  Prioridade,
  SituacaoAgente,
  StatusOrdem,
  TipoDocumento,
  TipoServico,
  Usuario,
  EscopoTabela,
  ItemRemuneracao,
  LancamentoAgente,
  RegistroAuditoria,
  TabelaRemuneracao,
  TipoLancamento,
  SituacaoLancamento,
  Servico,
  UnidadeItem,
  Moto,
  AgenteSorteio,
  Distribuicao,
  EventoDistribuicao,
  SituacaoMoto,
  Vistoria,
  StatusVistoria,
  OrigemVistoria,
  EvidenciaVistoria,
  EventoVistoria,
  ItemChecklistCatalogo,
  ItemVistoria,
  AvariaVistoria,
  CondicaoItem,
  CategoriaFoto,
} from "@/domain/types";

const texto = (v: string | null | undefined) => v ?? "";
const opcional = (v: string | null | undefined) => (v ? v : undefined);
const numero = (v: number | string | null | undefined) => Number(v ?? 0);

export function paraLocadora(r: Tables<"locadoras">): Locadora {
  return {
    id: r.id,
    nome: r.nome,
    cnpj: texto(r.cnpj),
    cidade: texto(r.cidade),
    uf: texto(r.uf),
    responsavel: texto(r.responsavel),
    telefone: texto(r.telefone),
    email: texto(r.email),
    ativa: r.ativa,
    criadaEm: r.criada_em,
    razaoSocial: texto(r.razao_social),
    nomeFantasia: texto(r.nome_fantasia),
    situacaoCadastral: texto(r.situacao_cadastral),
    dataAbertura: texto(r.data_abertura),
    naturezaJuridica: texto(r.natureza_juridica),
    cnae: texto(r.cnae),
    cep: texto(r.cep),
    bairro: texto(r.bairro),
    rua: texto(r.rua),
    numero: texto(r.numero),
    complemento: texto(r.complemento),
    limiteCredito: numero(r.limite_credito),
    formaPagamento: texto(r.forma_pagamento),
    prazoPagamento: Number(r.prazo_pagamento ?? 0),
    observacoes: texto(r.observacoes),
    tabelaCobrancaId: r.tabela_cobranca_id ?? undefined,
  };
}

export function paraAgente(r: Tables<"agentes">): Agente {
  return {
    id: r.id,
    nome: r.nome,
    telefone: texto(r.telefone),
    cidade: texto(r.cidade),
    ativo: r.ativo,
    online: r.online,
    vistoEm: r.visto_em ?? undefined,
    cpf: texto(r.cpf),
    rg: texto(r.rg),
    nascimento: texto(r.nascimento),
    sexo: texto(r.sexo),
    estadoCivil: texto(r.estado_civil),
    whatsapp: texto(r.whatsapp),
    email: texto(r.email),
    cep: texto(r.cep),
    rua: texto(r.rua),
    numero: texto(r.numero),
    bairro: texto(r.bairro),
    uf: texto(r.uf),
    cnh: texto(r.cnh),
    cnhCategoria: texto(r.cnh_categoria),
    cnhValidade: texto(r.cnh_validade),
    contratadoEm: texto(r.contratado_em),
    situacao: (texto(r.situacao) || "ativo") as SituacaoAgente,
    regiao: texto(r.regiao),
    cidadesAtendidas: r.cidades_atendidas ?? [],
    motoPlaca: texto(r.moto_placa),
    motoModelo: texto(r.moto_modelo),
    motoAno: texto(r.moto_ano),
    motoCor: texto(r.moto_cor),
    motoRenavam: texto(r.moto_renavam),
    seguro: texto(r.seguro),
    observacoes: texto(r.observacoes),
    foto: texto(r.foto),
  };
}

export function paraDocumento(r: Tables<"agente_documentos">): DocumentoAgente {
  return {
    id: r.id,
    agenteId: r.agente_id,
    tipo: (texto(r.tipo) || "outro") as TipoDocumento,
    nome: r.nome,
    url: r.url,
    criadoEm: r.criado_em,
  };
}

export function paraPagamento(r: Tables<"pagamentos_agente">): PagamentoAgente {
  return {
    id: r.id,
    agenteId: r.agente_id,
    valor: numero(r.valor),
    pagoEm: r.pago_em,
    forma: (texto(r.forma) || "pix") as FormaPagamento,
    observacao: texto(r.observacao),
    comprovante: texto(r.comprovante),
    responsavel: texto(r.responsavel),
  };
}

export function paraOrdem(r: Tables<"ordens">): Ordem {
  return {
    id: r.id,
    codigo: r.codigo,
    locadoraId: r.locadora_id,
    agenteId: r.agente_id ?? undefined,
    agenteAuxiliarId: r.agente_auxiliar_id ?? undefined,
    placa: r.placa,
    marca: texto(r.marca),
    modelo: texto(r.modelo),
    ano: texto(r.ano),
    cor: texto(r.cor),
    valorPendente: Number(r.valor_pendente ?? 0),
    telefone: texto(r.telefone),
    endereco: texto(r.endereco),
    cidade: texto(r.cidade),
    observacoes: opcional(r.observacoes),
    linkRastreador: opcional(r.link_rastreador),
    prioridade: r.prioridade as Prioridade,
    servicoId: r.servico_id ?? undefined,
    tipoServico: (r.tipo_servico as TipoServico | null) ?? undefined,
    status: r.status as StatusOrdem,
    criadaEm: r.criada_em,
    distribuidaEm: opcional(r.distribuida_em),
    aceitaEm: opcional(r.aceita_em),
    iniciadaEm: opcional(r.iniciada_em),
    chegadaEm: opcional(r.chegada_em),
    concluidaEm: opcional(r.concluida_em),
    canceladaEm: opcional(r.cancelada_em),
    motivoCancelamento: opcional(r.motivo_cancelamento),
    valorCobranca: r.valor_cobranca === null ? undefined : Number(r.valor_cobranca),
    valorPagamento: r.valor_pagamento === null ? undefined : Number(r.valor_pagamento),
    valorLocadora: r.valor_cobranca_base === null ? undefined : Number(r.valor_cobranca_base),
    adicionalLocadoraHorario: Number(r.valor_cobranca_adicional ?? 0),
    valorFinalLocadora: r.valor_cobranca_final === null ? undefined : Number(r.valor_cobranca_final),
    valorAgente: r.valor_pagamento_base === null ? undefined : Number(r.valor_pagamento_base),
    adicionalAgenteHorario: Number(r.valor_pagamento_adicional ?? 0),
    valorFinalAgente: r.valor_pagamento_final === null ? undefined : Number(r.valor_pagamento_final),
    horarioEspecial: Boolean(r.horario_especial),
    definidoPor: r.definido_por ?? undefined,
    definidoEm: opcional(r.definido_em),
    liberadoPor: r.liberado_por ?? undefined,
    liberadoEm: opcional(r.liberado_em),
    legado: Boolean(r.legado),
    valorPagamentoPrincipal:
      r.valor_pagamento_principal === null ? undefined : Number(r.valor_pagamento_principal),
    valorPagamentoAuxiliar:
      r.valor_pagamento_auxiliar === null ? undefined : Number(r.valor_pagamento_auxiliar),
    quantidadeKm: Number(r.quantidade_km ?? 0),
    checklist: (r.checklist as ChecklistItem[] | null) ?? undefined,
    termoAceito: r.termo_aceito,
    recebimentoPago: r.recebimento_pago,
    pagamentoPago: r.pagamento_pago,
    locatario: texto(r.locatario),
    cpf: texto(r.cpf),
    telefoneSecundario: texto(r.telefone_secundario),
    host: texto(r.host),
    pin: texto(r.pin),
    bairro: texto(r.bairro),
    uf: texto(r.uf),
    cep: texto(r.cep),
    latitude: texto(r.latitude),
    longitude: texto(r.longitude),
    linkMaps: texto(r.link_maps),
    ultimoRastreio: texto(r.ultimo_rastreio),
    situacaoFinanceira: texto(r.situacao_financeira),
    statusInformado: texto(r.status_informado),
    resumoIa: texto(r.resumo_ia),
    textoOrigem: texto(r.texto_origem),
  };
}

export function paraEvidencia(r: Tables<"ordem_evidencias">): Evidencia {
  return {
    id: r.id,
    ordemId: r.ordem_id,
    locadoraId: r.locadora_id,
    agenteId: r.agente_id ?? undefined,
    usuarioId: r.usuario_id ?? undefined,
    tipo: (texto(r.tipo) || "foto") as TipoEvidencia,
    etapa: texto(r.etapa),
    nome: texto(r.nome),
    caminho: texto(r.caminho),
    url: texto(r.url),
    mime: texto(r.mime),
    tamanho: Number(r.tamanho ?? 0),
    gps: texto(r.gps),
    observacao: texto(r.observacao),
    criadaEm: r.criada_em,
  };
}

export function paraCobranca(r: Tables<"ordem_cobrancas">): Cobranca {
  return {
    id: r.id,
    ordemId: r.ordem_id,
    locadoraId: r.locadora_id,
    nome: texto(r.nome),
    valor: numero(r.valor),
    observacao: texto(r.observacao),
    criadoEm: r.criado_em,
    tipo: (r.tipo ?? "adicional") as Cobranca["tipo"],
    situacao: (r.situacao ?? "ativa") as Cobranca["situacao"],
    estornadaEm: r.estornada_em ?? null,
    motivoEstorno: texto(r.motivo_estorno),
  };
}

export function paraApelido(r: Tables<"locadora_apelidos">): ApelidoLocadora {
  return { id: r.id, locadoraId: r.locadora_id, apelido: r.apelido };
}

export function paraFoto(r: Omit<Tables<"ordem_fotos">, "imagem"> & { imagem?: string }): Foto {
  return {
    id: r.id,
    ordemId: r.ordem_id,
    dataUrl: r.imagem ?? "",
    etapa: r.etapa,
    criadaEm: r.criada_em,
  };
}

export function paraEvento(r: Tables<"ordem_historico">): EventoHistorico {
  return {
    id: r.id,
    ordemId: r.ordem_id,
    quem: r.quem,
    quando: r.quando,
    acao: r.acao,
    detalhe: opcional(r.detalhe),
    gps: opcional(r.gps),
  };
}

export function paraImportacao(r: Tables<"importacoes">): Importacao {
  return {
    id: r.id,
    locadoraId: r.locadora_id,
    arquivo: r.arquivo,
    total: r.total,
    criadaEm: r.criada_em,
    autor: texto(r.autor),
  };
}

export function paraUsuario(
  perfil: Tables<"profiles">,
  papeis: Pick<Tables<"user_roles">, "user_id" | "role">[],
): Usuario {
  const papel = (papeis.find((p) => p.user_id === perfil.id)?.role ?? "operador") as Papel;
  return {
    id: perfil.id,
    nome: texto(perfil.nome),
    email: texto(perfil.email),
    papel,
    locadoraId: perfil.locadora_id ?? undefined,
    agenteId: perfil.agente_id ?? undefined,
  };
}

// ─────────────────── Remuneração, lançamentos e auditoria ───────────────────

export function paraTabelaRemuneracao(r: Tables<"tabelas_remuneracao">): TabelaRemuneracao {
  return {
    id: r.id,
    nome: r.nome,
    escopo: r.escopo as EscopoTabela,
    locadoraId: r.locadora_id ?? undefined,
    agenteId: r.agente_id ?? undefined,
    padrao: r.padrao,
    ativa: r.ativa,
    observacao: texto(r.observacao),
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

export function paraItemRemuneracao(r: Tables<"itens_remuneracao">): ItemRemuneracao {
  return {
    id: r.id,
    tabelaId: r.tabela_id,
    servicoId: r.servico_id ?? undefined,
    codigo: texto(r.codigo),
    nome: r.nome,
    descricao: texto(r.descricao),
    valor: numero(r.valor),
    unidade: (texto(r.unidade) || "fixo") as UnidadeItem,
    status: texto(r.status) || "vigente",
    observacao: texto(r.observacao),
    ativo: r.ativo,
    posicao: Number(r.posicao ?? 0),
  };
}

export function paraServico(r: Tables<"servicos">): Servico {
  return {
    id: r.id,
    codigo: r.codigo,
    nome: r.nome,
    descricao: texto(r.descricao),
    unidade: (texto(r.unidade) || "fixo") as UnidadeItem,
    ativo: r.ativo,
    posicao: Number(r.posicao ?? 0),
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

export function paraLancamento(r: Tables<"lancamentos_agente">): LancamentoAgente {
  return {
    id: r.id,
    agenteId: r.agente_id,
    tipo: r.tipo as TipoLancamento,
    valor: numero(r.valor),
    data: r.data,
    descricao: texto(r.descricao),
    forma: texto(r.forma),
    observacao: texto(r.observacao),
    comprovante: texto(r.comprovante),
    ordemId: r.ordem_id ?? undefined,
    referenciaId: r.referencia_id ?? undefined,
    responsavel: texto(r.responsavel),
    criadoEm: r.criado_em,
    situacao: (texto(r.situacao) || "ativo") as SituacaoLancamento,
    motivo: texto(r.motivo),
  };
}

export function paraAuditoria(r: Tables<"auditoria">): RegistroAuditoria {
  return {
    id: r.id,
    entidade: r.entidade,
    registroId: r.registro_id ?? undefined,
    acao: r.acao,
    quemNome: texto(r.quem_nome),
    dados: r.dados,
    criadoEm: r.criado_em,
  };
}

export function paraNotificacao(r: Tables<"notificacoes">): Notificacao {
  return {
    id: r.id,
    usuarioId: r.usuario_id,
    tipo: (texto(r.tipo) || "operacional") as TipoNotificacao,
    titulo: r.titulo,
    mensagem: texto(r.mensagem),
    ordemId: r.ordem_id ?? undefined,
    lida: r.lida,
    lidaEm: r.lida_em ?? undefined,
    criadaEm: r.criada_em,
  };
}

export function paraCancelamento(r: Tables<"cancelamentos_ordem">): CancelamentoOrdem {
  return {
    id: r.id,
    ordemId: r.ordem_id,
    locadoraId: r.locadora_id,
    valorOriginal: numero(r.valor_original),
    percentual: numero(r.percentual_cobranca),
    valorCobranca: numero(r.valor_cobranca),
    motivo: texto(r.motivo),
    aceite: r.aceite_cobranca,
    textoAceite: texto(r.texto_aceite),
    canceladoEm: r.cancelado_em,
  };
}

// ─────────────────────────── Vistorias de motos ───────────────────────────

export function paraMoto(r: Tables<"motos">): Moto {
  return {
    id: r.id,
    locadoraId: r.locadora_id,
    placa: r.placa,
    marca: texto(r.marca),
    modelo: texto(r.modelo),
    ano: texto(r.ano),
    cor: texto(r.cor),
    chassi: texto(r.chassi),
    observacoes: texto(r.observacoes),
    situacao: (r.situacao ?? "ativa") as SituacaoMoto,
    host: texto(r.host),
    pin: texto(r.pin),

    ultimaVistoriaEm: r.ultima_vistoria_at ?? undefined,
    proximaVistoriaEm: r.proxima_vistoria_at ?? undefined,
    criadaEm: r.criada_em,
    atualizadoEm: r.atualizado_em,
  };
}

export function paraVistoria(r: Tables<"vistorias">): Vistoria {
  return {
    id: r.id,
    codigo: texto(r.codigo),
    motoId: r.moto_id,
    locadoraId: r.locadora_id,
    agenteId: r.agente_id ?? undefined,
    servicoId: r.servico_id ?? undefined,
    status: r.status as StatusVistoria,
    origem: (texto(r.origem) || "central") as OrigemVistoria,
    observacoes: texto(r.observacoes),
    checklist: (r.checklist as ChecklistItem[] | null) ?? undefined,
    motivoCancelamento: texto(r.motivo_cancelamento),
    contatoNome: texto(r.contato_nome),
    contatoTelefone: texto(r.contato_telefone),
    contatoEmail: texto(r.contato_email),
    endereco: texto(r.endereco),
    bairro: texto(r.bairro),
    cidade: texto(r.cidade),
    uf: texto(r.uf),
    cep: texto(r.cep),
    linkMaps: texto(r.link_maps),
    host: texto(r.host),
    pin: texto(r.pin),
    pinValidade: texto(r.pin_validade),
    textoOrigem: texto(r.texto_origem),
    km: r.km === null || r.km === undefined ? undefined : Number(r.km),
    latitude: texto(r.latitude),
    longitude: texto(r.longitude),

    solicitadaEm: r.solicitada_em,
    distribuidaEm: r.distribuida_em ?? undefined,
    aceitaEm: r.aceita_em ?? undefined,
    iniciadaEm: r.iniciada_em ?? undefined,
    chegadaEm: r.chegada_em ?? undefined,
    concluidaEm: r.concluida_em ?? undefined,
    canceladaEm: r.cancelada_em ?? undefined,
    termoAceito: r.termo_aceito ?? false,
    termoAceitoEm: r.termo_aceito_em ?? undefined,
    valorCobranca: r.valor_cobranca === null ? undefined : Number(r.valor_cobranca),
    valorPagamento: r.valor_pagamento === null ? undefined : Number(r.valor_pagamento),
    tabelaCobrancaId: r.tabela_cobranca_id ?? undefined,
    tabelaPagamentoId: r.tabela_pagamento_id ?? undefined,
    recebimentoPago: r.recebimento_pago,
    pagamentoPago: r.pagamento_pago,
    criadaEm: r.criada_em,
    atualizadoEm: r.atualizado_em,
  };
}

export function paraItemChecklistCatalogo(
  r: Tables<"vistoria_checklist_itens">,
): ItemChecklistCatalogo {
  return {
    id: r.id,
    codigo: texto(r.codigo),
    nome: texto(r.nome),
    ativo: r.ativo,
    obrigatorio: r.obrigatorio,
    fotoQuandoRuim: r.foto_quando_ruim,
    fotoQuandoRegular: r.foto_quando_regular,
    posicao: r.posicao ?? 0,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

export function paraItemVistoria(r: Tables<"vistoria_itens">): ItemVistoria {
  return {
    id: r.id,
    vistoriaId: r.vistoria_id,
    catalogoId: r.catalogo_id ?? undefined,
    codigo: texto(r.codigo),
    item: texto(r.item),
    condicao: (r.condicao ?? "nao_avaliado") as CondicaoItem,
    obrigatorio: r.obrigatorio,
    observacao: texto(r.observacao),
    posicao: r.posicao ?? 0,
    avaliadoEm: r.avaliado_em ?? undefined,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

export function paraAvariaVistoria(r: Tables<"vistoria_avarias">): AvariaVistoria {
  return {
    id: r.id,
    vistoriaId: r.vistoria_id,
    itemId: r.item_id ?? undefined,
    componente: texto(r.componente),
    condicao: (r.condicao ?? "ruim") as "regular" | "ruim",
    descricao: texto(r.descricao),
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
  };
}

export function paraEvidenciaVistoria(r: Tables<"vistoria_evidencias">): EvidenciaVistoria {
  return {
    id: r.id,
    vistoriaId: r.vistoria_id,
    motoId: r.moto_id,
    locadoraId: r.locadora_id,
    agenteId: r.agente_id ?? undefined,
    usuarioId: r.usuario_id ?? undefined,
    avariaId: r.avaria_id ?? undefined,
    categoria: (texto(r.categoria) || "geral") as CategoriaFoto,
    tipo: texto(r.tipo) || "foto",
    etapa: texto(r.etapa),
    nome: texto(r.nome),
    caminho: texto(r.caminho),
    url: texto(r.url),
    mime: texto(r.mime),
    tamanho: Number(r.tamanho ?? 0),
    gps: texto(r.gps),
    km: r.km === null || r.km === undefined ? undefined : Number(r.km),
    latitude: texto(r.latitude),
    longitude: texto(r.longitude),
    observacao: texto(r.observacao),
    criadaEm: r.criada_em,
  };
}

export function paraEventoVistoria(r: Tables<"vistoria_historico">): EventoVistoria {
  return {
    id: r.id,
    vistoriaId: r.vistoria_id,
    motoId: r.moto_id ?? undefined,
    quem: texto(r.quem),
    quando: r.quando,
    acao: r.acao,
    detalhe: texto(r.detalhe),
    gps: texto(r.gps),
  };
}

// ============ Distribuição automática ============

function agentesSorteio(valor: unknown): AgenteSorteio[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
    .map((i) => ({
      id: String(i["id"] ?? ""),
      nome: String(i["nome"] ?? ""),
      cidade: i["cidade"] ? String(i["cidade"]) : undefined,
      motivo: i["motivo"] ? String(i["motivo"]) : undefined,
    }));
}

export function paraDistribuicao(r: Tables<"distribuicoes">): Distribuicao {
  return {
    id: r.id,
    tipo: r.tipo as Distribuicao["tipo"],
    ordemId: r.ordem_id ?? undefined,
    vistoriaId: r.vistoria_id ?? undefined,
    motoId: r.moto_id ?? undefined,
    locadoraId: r.locadora_id,
    gatilho: texto(r.gatilho),
    servicoId: r.servico_id ?? undefined,
    servicoNome: texto(r.servico_nome),
    valorCobranca: Number(r.valor_cobranca ?? 0),
    valorPagamento: Number(r.valor_pagamento ?? 0),
    valorCobrancaBase: Number(r.valor_cobranca_base ?? 0),
    valorCobrancaAdicional: Number(r.valor_cobranca_adicional ?? 0),
    valorPagamentoBase: Number(r.valor_pagamento_base ?? 0),
    valorPagamentoAdicional: Number(r.valor_pagamento_adicional ?? 0),
    referenciaCobranca: Number(r.referencia_cobranca ?? 0),
    referenciaPagamento: Number(r.referencia_pagamento ?? 0),
    referenciaAdicionalCobranca: Number(r.referencia_adicional_cobranca ?? 0),
    referenciaAdicionalPagamento: Number(r.referencia_adicional_pagamento ?? 0),
    horarioEspecial: !!r.horario_especial,
    aprovadaEm: r.aprovada_em ?? undefined,
    aprovadaPorNome: texto(r.aprovada_por_nome),
    agenteId: r.agente_id ?? undefined,
    agenteAuxiliarId: r.agente_auxiliar_id ?? undefined,
    status: r.status as Distribuicao["status"],
    origem: r.origem as Distribuicao["origem"],
    regra: texto(r.regra),
    elegiveis: agentesSorteio(r.elegiveis),
    descartados: agentesSorteio(r.descartados),
    motivo: texto(r.motivo),
    distribuidaEm: r.distribuida_em ?? undefined,
    notificadaEm: r.notificada_em ?? undefined,
    aceitaEm: r.aceita_em ?? undefined,
    recusadaEm: r.recusada_em ?? undefined,
    concluidaEm: r.concluida_em ?? undefined,
    canceladaEm: r.cancelada_em ?? undefined,
    criadaEm: r.criada_em,
  };
}

export function paraEventoDistribuicao(r: Tables<"distribuicao_eventos">): EventoDistribuicao {
  return {
    id: r.id,
    distribuicaoId: r.distribuicao_id,
    acao: texto(r.acao),
    detalhe: texto(r.detalhe),
    automatico: !!r.automatico,
    quemNome: texto(r.quem_nome) || "Sistema",
    quando: r.quando,
  };
}
