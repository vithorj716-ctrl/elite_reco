import { conferirErro } from "@/data/erros";
/**
 * Regras e operações de ordens de recolhimento.
 * Nenhuma tela fala com o banco diretamente — tudo passa por aqui.
 *
 * As travas críticas (transição de estado, ordem faturada, permissão do agente)
 * também existem no banco por gatilho: aqui elas servem para dar mensagem clara
 * ao operador antes da viagem até o servidor.
 */
import { supabase } from "@/integrations/supabase/client";
import { paraOrdem } from "@/domain/entities/mapeadores";
import { AuditoriaService, responsavelAtual } from "@/services/auditoria.service";
import { EvidenciasService } from "@/services/evidencias.service";
import type { ChecklistItem, Ordem, Prioridade, StatusOrdem, TipoServico } from "@/domain/types";

export interface NovaOrdem {
  /** Opcional: quando vazio, o banco gera o código sequencial sem risco de duplicidade. */
  codigo?: string;
  locadoraId: string;
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
  /** Serviço do catálogo (public.servicos). */
  servicoId: string;
  /** Campos preenchidos pelo importador inteligente. */
  locatario?: string;
  cpf?: string;
  telefoneSecundario?: string;
  host?: string;
  pin?: string;
  bairro?: string;
  uf?: string;
  cep?: string;
  latitude?: string;
  longitude?: string;
  linkMaps?: string;
  ultimoRastreio?: string;
  situacaoFinanceira?: string;
  statusInformado?: string;
  resumoIa?: string;
  textoOrigem?: string;
}

function erro(e: { message: string } | null) {
  conferirErro(e);
}

/** Transições permitidas — espelha o gatilho `ordens_regras` do banco. */
const TRANSICOES: Record<StatusOrdem, StatusOrdem[]> = {
  // a definição administrativa é a única saída de uma ordem recém-criada
  pendente_definicao: ["liberada", "cancelada"],
  liberada: ["distribuida", "pendente_definicao", "cancelada"],
  distribuida: ["em_andamento", "liberada", "pendente_definicao", "cancelada"],
  em_andamento: ["concluida", "liberada", "pendente_definicao", "cancelada"],
  concluida: ["pendente_definicao"],
  cancelada: ["pendente_definicao", "liberada"],
};

export function podeTransicionar(de: StatusOrdem, para: StatusOrdem) {
  return de === para || TRANSICOES[de].includes(para);
}

export function estaLiquidada(o: Pick<Ordem, "recebimentoPago" | "pagamentoPago">) {
  return Boolean(o.recebimentoPago || o.pagamentoPago);
}

/** Ordem faturada ou paga é imutável até que a liquidação seja estornada. */
function exigirNaoLiquidada(o: Ordem, acao: string) {
  if (estaLiquidada(o)) {
    throw new Error(
      `Ordem ${o.codigo} já está faturada ou paga. Estorne a liquidação antes de ${acao}.`,
    );
  }
}

async function historico(ordemId: string, acao: string, detalhe?: string) {
  const { nome } = await responsavelAtual();
  await supabase.from("ordem_historico").insert({
    ordem_id: ordemId,
    quem: nome,
    acao,
    detalhe: detalhe ?? null,
  });
}

function linhaOrdem(o: NovaOrdem) {
  return {
    // vazio = o banco gera o código sequencial (sem corrida entre operadores)
    codigo: o.codigo?.trim() ?? "",
    locadora_id: o.locadoraId,
    placa: o.placa,
    marca: o.marca,
    modelo: o.modelo,
    ano: o.ano,
    cor: o.cor,
    valor_pendente: Math.max(0, o.valorPendente || 0),
    telefone: o.telefone,
    endereco: o.endereco,
    cidade: o.cidade,
    observacoes: o.observacoes ?? null,
    link_rastreador: o.linkRastreador ?? null,
    prioridade: o.prioridade,
    servico_id: o.servicoId || null,
    tipo_servico: null,
    // nasce aguardando a definição de valores pelo administrador
    status: "pendente_definicao" as const,
    locatario: o.locatario ?? "",
    cpf: o.cpf ?? "",
    telefone_secundario: o.telefoneSecundario ?? "",
    host: o.host ?? "",
    pin: o.pin ?? "",
    bairro: o.bairro ?? "",
    uf: o.uf ?? "",
    cep: o.cep ?? "",
    latitude: o.latitude ?? "",
    longitude: o.longitude ?? "",
    link_maps: o.linkMaps ?? "",
    ultimo_rastreio: o.ultimoRastreio ?? "",
    situacao_financeira: o.situacaoFinanceira ?? "",
    status_informado: o.statusInformado ?? "",
    resumo_ia: o.resumoIa ?? "",
    texto_origem: o.textoOrigem ?? "",
  };
}

export const OrdensService = {
  async criarLote(novas: NovaOrdem[]): Promise<Ordem[]> {
    if (novas.length === 0) return [];
    const { data, error } = await supabase.from("ordens").insert(novas.map(linhaOrdem)).select("*");
    erro(error);
    const criadas = (data ?? []).map(paraOrdem);
    await Promise.all(criadas.map((o) => historico(o.id, "Ordem criada", o.codigo)));
    return criadas;
  },

  /** Edição livre da ordem — bloqueada quando a ordem já foi liquidada. */
  async atualizar(ordem: Ordem | string, campos: Partial<Record<string, unknown>>) {
    const alvo = typeof ordem === "string" ? await this.buscar(ordem) : ordem;
    exigirNaoLiquidada(alvo, "editá-la");
    const { error } = await supabase
      .from("ordens")
      .update(campos as never)
      .eq("id", alvo.id);
    erro(error);
    await AuditoriaService.registrar("ordens", "alterou", alvo.id, {
      codigo: alvo.codigo,
      campos: Object.keys(campos),
    });
    await historico(alvo.id, "Ordem editada", Object.keys(campos).join(", "));
  },

  async buscar(ordemId: string): Promise<Ordem> {
    const { data, error } = await supabase.from("ordens").select("*").eq("id", ordemId).single();
    erro(error);
    return paraOrdem(data!);
  },

  async cancelar(ordem: Ordem, motivo: string) {
    exigirNaoLiquidada(ordem, "cancelá-la");
    if (!podeTransicionar(ordem.status, "cancelada")) {
      throw new Error(`Não é possível cancelar uma ordem ${ordem.status}.`);
    }
    const { error } = await supabase
      .from("ordens")
      .update({ status: "cancelada", motivo_cancelamento: motivo.trim() })
      .eq("id", ordem.id);
    erro(error);
    await AuditoriaService.registrar("ordens", "alterou", ordem.id, {
      codigo: ordem.codigo,
      acao: "cancelamento",
      motivo,
    });
    await historico(ordem.id, "Ordem cancelada", motivo.trim() || undefined);
  },

  /** Prévia da taxa antes do cancelamento pela locadora. */
  async previaCancelamentoLocadora(ordemId: string) {
    const { data, error } = await supabase.rpc("previa_cancelamento_locadora", {
      _ordem_id: ordemId,
    });
    erro(error);
    const p = (data ?? {}) as {
      deslocamento_iniciado?: boolean;
      valor_original?: number;
      percentual?: number;
      valor_cobranca?: number;
    };
    return {
      deslocamentoIniciado: Boolean(p.deslocamento_iniciado),
      valorOriginal: Number(p.valor_original ?? 0),
      percentual: Number(p.percentual ?? 0),
      valorCobranca: Number(p.valor_cobranca ?? 0),
    };
  },

  /**
   * Cancelamento feito pela locadora. Toda a regra (taxa de 50% após o início
   * do deslocamento, aceite obrigatório e registro imutável) vive no banco.
   */
  async cancelarComoLocadora(
    ordem: Ordem,
    dados: { motivo: string; aceite: boolean; textoAceite: string },
  ) {
    const { data, error } = await supabase.rpc("cancelar_ordem_locadora", {
      _ordem_id: ordem.id,
      _motivo: dados.motivo.trim(),
      _aceite: dados.aceite,
      _texto_aceite: dados.textoAceite,
    });
    erro(error);
    const r = (data ?? {}) as { valor_cobranca?: number };
    await AuditoriaService.registrar("ordens", "alterou", ordem.id, {
      codigo: ordem.codigo,
      acao: "cancelamento_locadora",
      motivo: dados.motivo,
      taxa: Number(r.valor_cobranca ?? 0),
    });
    return { valorCobranca: Number(r.valor_cobranca ?? 0) };
  },

  async reabrir(ordem: Ordem, motivo: string) {
    exigirNaoLiquidada(ordem, "reabri-la");
    const { error } = await supabase
      .from("ordens")
      .update({ status: "pendente_definicao" })
      .eq("id", ordem.id);
    erro(error);
    await AuditoriaService.registrar("ordens", "alterou", ordem.id, {
      codigo: ordem.codigo,
      acao: "reabertura",
      motivo,
    });
    await historico(ordem.id, "Ordem reaberta", motivo.trim() || undefined);
  },

  /** Estorno da liquidação: única porta de saída de uma ordem já faturada/paga. */
  async estornar(ordem: Ordem, tipo: "receber" | "pagar", motivo: string) {
    const alteracao =
      tipo === "receber" ? { recebimento_pago: false } : ({ pagamento_pago: false } as const);
    const { error } = await supabase.from("ordens").update(alteracao).eq("id", ordem.id);
    erro(error);
    await AuditoriaService.registrar("ordens", "alterou", ordem.id, {
      codigo: ordem.codigo,
      acao: `estorno de ${tipo}`,
      motivo,
    });
    await historico(
      ordem.id,
      tipo === "receber" ? "Faturamento estornado" : "Pagamento ao agente estornado",
      motivo.trim() || undefined,
    );
  },

  /**
   * Exclusão definitiva. Só é possível enquanto a ordem não tiver vida
   * financeira; os arquivos de evidência saem do storage junto com ela para
   * não ficarem órfãos no bucket.
   */
  async excluir(ordem: Ordem, opcoes?: { estornarAntes?: boolean }) {
    if (estaLiquidada(ordem)) {
      if (!opcoes?.estornarAntes) exigirNaoLiquidada(ordem, "excluí-la");
      // estorno automático: a trava do banco impede apagar ordem liquidada
      const { error: erroEstorno } = await supabase
        .from("ordens")
        .update({ recebimento_pago: false, pagamento_pago: false })
        .eq("id", ordem.id);
      erro(erroEstorno);
    }

    // limpeza de arquivos é oportunista: falta de permissão no storage não pode
    // impedir a locadora de apagar a própria solicitação
    try {
      await EvidenciasService.limparDaOrdem(ordem.id);
    } catch {
      /* segue a exclusão do registro */
    }
    const { error } = await supabase.from("ordens").delete().eq("id", ordem.id);

    erro(error);
    await AuditoriaService.registrar("ordens", "excluiu", ordem.id, {
      codigo: ordem.codigo,
      placa: ordem.placa,
      locadoraId: ordem.locadoraId,
      status: ordem.status,
    });
  },

  /** Cria uma cópia limpa da ordem (sem agente, evidências ou histórico). */
  async duplicar(origem: Ordem): Promise<Ordem> {
    const [nova] = await this.criarLote([
      {
        locadoraId: origem.locadoraId,
        placa: origem.placa,
        marca: origem.marca,
        modelo: origem.modelo,
        ano: origem.ano,
        cor: origem.cor,
        valorPendente: origem.valorPendente,
        telefone: origem.telefone,
        endereco: origem.endereco,
        cidade: origem.cidade,
        observacoes: origem.observacoes,
        linkRastreador: origem.linkRastreador,
        prioridade: origem.prioridade,
        servicoId: origem.servicoId ?? "",
        locatario: origem.locatario ?? "",
        cpf: origem.cpf ?? "",
        telefoneSecundario: origem.telefoneSecundario ?? "",
        host: origem.host ?? "",
        pin: origem.pin ?? "",
        bairro: origem.bairro ?? "",
        uf: origem.uf ?? "",
        cep: origem.cep ?? "",
        latitude: origem.latitude ?? "",
        longitude: origem.longitude ?? "",
        linkMaps: origem.linkMaps ?? "",
        ultimoRastreio: origem.ultimoRastreio ?? "",
        situacaoFinanceira: origem.situacaoFinanceira ?? "",
        resumoIa: origem.resumoIa ?? "",
        textoOrigem: origem.textoOrigem ?? "",
      },
    ]);
    await historico(origem.id, "Ordem duplicada", `Gerou ${nova!.codigo}`);
    await historico(nova!.id, "Originada de duplicação", origem.codigo);
    return nova!;
  },

  /**
   * Distribuição da ordem para a dupla de campo.
   * O agente principal executa pelo aplicativo; o auxiliar entra no financeiro
   * e no histórico. Os valores informados aqui valem só para estas ordens —
   * a tabela de remuneração nunca é alterada.
   */
  async distribuir(
    ordens: Ordem[],
    dupla: {
      principalId: string;
      auxiliarId?: string | undefined;
      valorCobranca?: number | undefined;
      valorPrincipal?: number | undefined;
      valorAuxiliar?: number | undefined;
      quantidadeKm?: number | undefined;
    },
  ) {
    if (!dupla.principalId) throw new Error("Selecione o agente principal.");
    if (dupla.auxiliarId && dupla.auxiliarId === dupla.principalId) {
      throw new Error("O agente auxiliar precisa ser diferente do agente principal.");
    }
    // nenhuma ordem chega ao agente antes da definição/liberação administrativa
    const semLiberacao = ordens.filter((o) => !o.liberadoEm);
    if (semLiberacao.length > 0) {
      throw new Error(
        `${semLiberacao.map((o) => o.codigo).join(", ")}: ${
          semLiberacao.some((o) => o.horarioEspecial)
            ? "lançamento após o horário especial. Abra a ficha da ordem e use \"Definir e liberar\" para confirmar o valor da locadora e o repasse do agente antes de distribuir."
            : "esta ordem está sem valor na tabela de preços. Abra a ficha da ordem e use \"Definir e liberar\" para informar os valores antes de distribuir."
        }`,
      );
    }
    const invalidas = ordens.filter((o) => !podeTransicionar(o.status, "distribuida"));
    if (invalidas.length > 0) {
      throw new Error(
        `Não é possível distribuir: ${invalidas.map((o) => `${o.codigo} (${o.status})`).join(", ")}.`,
      );
    }
    const liquidadas = ordens.filter(estaLiquidada);
    if (liquidadas.length > 0) {
      throw new Error(`Ordens já liquidadas não podem ser redistribuídas.`);
    }
    const numero = (v: number | undefined) =>
      typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
    const { error } = await supabase
      .from("ordens")
      .update({
        agente_id: dupla.principalId,
        agente_auxiliar_id: dupla.auxiliarId ?? null,
        status: "distribuida" as StatusOrdem,
        distribuida_em: new Date().toISOString(),
        valor_cobranca: numero(dupla.valorCobranca),
        valor_pagamento_principal: numero(dupla.valorPrincipal),
        valor_pagamento_auxiliar: numero(dupla.valorAuxiliar),
        ...(dupla.quantidadeKm !== undefined ? { quantidade_km: dupla.quantidadeKm } : {}),
      })
      .in(
        "id",
        ordens.map((o) => o.id),
      );
    erro(error);
  },

  /**
   * Transferência do responsável de uma ordem já distribuída ou em execução.
   *
   * A decisão inteira acontece no banco (`transferir_ordem_agente`): só a equipe
   * operacional executa, o responsável atual é lido com a linha travada, os
   * marcos de campo são preservados e o histórico só recebe eventos novos.
   * A mesma ordem continua — mesmo id, código, placa, evidências e financeiro.
   */
  async transferirAgente(ordem: Ordem, novoAgenteId: string, motivo: string) {
    if (!novoAgenteId) throw new Error("Escolha o novo agente responsável.");
    if (novoAgenteId === ordem.agenteId) {
      throw new Error("Este agente já é o responsável pela ordem.");
    }
    const { error } = await supabase.rpc("transferir_ordem_agente", {
      _ordem: ordem.id,
      _agente: novoAgenteId,
      _motivo: motivo.trim(),
    });
    erro(error);
  },



  /**
   * Etapas de campo, obrigatoriamente nesta ordem:
   * aceite → deslocamento → chegada.
   */
  async marcarEtapa(ordem: Ordem, campo: "aceita_em" | "iniciada_em" | "chegada_em") {
    const agora = new Date().toISOString();
    if (campo === "aceita_em") {
      if (ordem.aceitaEm) throw new Error("Ordem já aceita.");
      if (ordem.status !== "distribuida") throw new Error("Só é possível aceitar uma ordem distribuída.");
      // O aceite é resolvido no banco: dois agentes nunca assumem a mesma ordem.
      const { error } = await supabase.rpc("aceitar_ordem", { _ordem: ordem.id });
      erro(error);
      return;
    }
    if (campo === "iniciada_em") {
      if (!ordem.aceitaEm) throw new Error("Aceite a ordem antes de iniciar o deslocamento.");
      if (ordem.iniciadaEm) throw new Error("Deslocamento já iniciado.");
    }
    if (campo === "chegada_em") {
      if (!ordem.iniciadaEm) {
        throw new Error("Para anunciar a chegada é obrigatório iniciar o deslocamento.");
      }
      if (ordem.chegadaEm) throw new Error("Chegada já registrada.");
    }
    const alteracao =
      campo === "iniciada_em"
        ? { iniciada_em: agora, status: "em_andamento" as StatusOrdem }
        : { chegada_em: agora };
    const { error } = await supabase.from("ordens").update(alteracao).eq("id", ordem.id);
    erro(error);
  },

  /**
   * Conclusão: além do checklist, congela o valor cobrado da locadora e o valor
   * devido a cada agente da dupla. Mudanças posteriores nas tabelas de preço
   * não reescrevem faturas e recibos já emitidos.
   */
  async concluir(
    ordem: Ordem,
    checklist: ChecklistItem[],
    valores: { cobranca: number; pagamento: number; principal?: number; auxiliar?: number },
  ) {
    if (!podeTransicionar(ordem.status, "concluida")) {
      throw new Error(`Uma ordem ${ordem.status} não pode ser concluída.`);
    }
    if (!ordem.iniciadaEm) throw new Error("Inicie o deslocamento antes de concluir.");
    if (!ordem.chegadaEm) {
      throw new Error("Antes de continuar é necessário informar sua chegada ao local.");
    }
    // Snapshot só é gravado quando há valor real; zero deixaria a ordem
    // congelada em R$ 0,00 e fora das contas a pagar/receber.
    const congelar = (v: number | undefined) =>
      typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
    const { error } = await supabase
      .from("ordens")
      .update({
        status: "concluida" as StatusOrdem,
        concluida_em: new Date().toISOString(),
        checklist: checklist as unknown as never,
        termo_aceito: true,
        valor_cobranca: congelar(valores.cobranca),
        valor_pagamento: congelar(valores.pagamento),
        valor_pagamento_principal: congelar(valores.principal ?? valores.pagamento),
        valor_pagamento_auxiliar: congelar(valores.auxiliar),
      })
      .eq("id", ordem.id);
    erro(error);

  },

  async registrarFoto(ordemId: string, etapa: string, imagem: string) {
    const { error } = await supabase
      .from("ordem_fotos")
      .insert({ ordem_id: ordemId, etapa, imagem });
    erro(error);
  },

  async registrarHistorico(
    ordemId: string,
    quem: string,
    acao: string,
    detalhe?: string | undefined,
    gps?: string | undefined,
  ) {
    const { error } = await supabase.from("ordem_historico").insert({
      ordem_id: ordemId,
      quem,
      acao,
      detalhe: detalhe ?? null,
      gps: gps ?? null,
    });
    erro(error);
  },

  async registrarImportacao(locadoraId: string, arquivo: string, total: number, autor: string) {
    const { error } = await supabase
      .from("importacoes")
      .insert({ locadora_id: locadoraId, arquivo, total, autor });
    erro(error);
  },
};
