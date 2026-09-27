/**
 * Ciclo de vida da vistoria: solicitação, distribuição, execução em campo,
 * conclusão e cancelamento.
 *
 * Reaproveita agentes, locadoras, tabelas de preço, Storage e notificações do
 * sistema — nada aqui cria estrutura paralela. O banco já garante a máquina de
 * estados; aqui ficam as travas de uso e o registro do histórico.
 */
import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { paraEvidenciaVistoria, paraVistoria } from "@/domain/entities/mapeadores";
import { AuditoriaService, responsavelAtual } from "@/services/auditoria.service";
import { processarFotoBlob, obterGps, obterCoordenadas } from "@/lib/foto";
import type {
  AvariaVistoria,
  CategoriaFoto,
  ChecklistItem,
  CondicaoItem,
  EvidenciaVistoria,
  ItemChecklistCatalogo,
  ItemVistoria,
  Vistoria,
} from "@/domain/types";
import { paraAvariaVistoria, paraItemVistoria } from "@/domain/entities/mapeadores";
import type { Json } from "@/integrations/supabase/types";

const BUCKET = "evidencias";

async function historico(
  vistoriaId: string,
  motoId: string | undefined,
  acao: string,
  detalhe = "",
  gps = "",
) {
  const { nome } = await responsavelAtual();
  await supabase.from("vistoria_historico").insert({
    vistoria_id: vistoriaId,
    moto_id: motoId ?? null,
    quem: nome,
    acao,
    detalhe,
    gps,
  });
}

export interface DadosVistoria {
  observacoes?: string;
  servicoId?: string | null;
  contatoNome?: string;
  contatoTelefone?: string;
  contatoEmail?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  linkMaps?: string;
  host?: string;
  pin?: string;
  pinValidade?: string;
  textoOrigem?: string;
}

export interface NovaVistoria extends DadosVistoria {
  motoId: string;
  locadoraId: string;
  origem?: "central" | "locadora" | "ciclo";
  agenteId?: string | null;
}

/** Converte o formulário para as colunas do banco, ignorando o que não veio. */
function colunas(dados: DadosVistoria): Record<string, unknown> {
  const mapa: Array<[keyof DadosVistoria, string]> = [
    ["observacoes", "observacoes"],
    ["servicoId", "servico_id"],
    ["contatoNome", "contato_nome"],
    ["contatoTelefone", "contato_telefone"],
    ["contatoEmail", "contato_email"],
    ["endereco", "endereco"],
    ["bairro", "bairro"],
    ["cidade", "cidade"],
    ["uf", "uf"],
    ["cep", "cep"],
    ["linkMaps", "link_maps"],
    ["host", "host"],
    ["pin", "pin"],
    ["pinValidade", "pin_validade"],
    ["textoOrigem", "texto_origem"],
  ];
  const saida: Record<string, unknown> = {};
  for (const [chave, coluna] of mapa) {
    const valor = dados[chave];
    if (valor !== undefined) saida[coluna] = valor;
  }
  return saida;
}

export const VistoriasService = {
  /** Abre a vistoria. A locadora só solicita; quem distribui é a central. */
  async solicitar(dados: NovaVistoria): Promise<Vistoria> {
    if (!dados.motoId) throw new Error("Escolha a moto que será vistoriada.");
    if (!dados.locadoraId) throw new Error("Escolha a locadora responsável pela moto.");

    // O rastreador é dado da moto: a vistoria só herda o que já está cadastrado.
    const rastreador: Record<string, unknown> = {};
    if (dados.host === undefined || dados.pin === undefined) {
      const { data: moto } = await supabase
        .from("motos")
        .select("host, pin")
        .eq("id", dados.motoId)
        .maybeSingle();
      if (moto) {
        if (dados.host === undefined) rastreador["host"] = moto.host ?? "";
        if (dados.pin === undefined) rastreador["pin"] = moto.pin ?? "";
      }
    }

    const { data, error } = await supabase
      .from("vistorias")
      .insert({
        moto_id: dados.motoId,
        locadora_id: dados.locadoraId,
        origem: dados.origem ?? "central",
        agente_id: dados.agenteId ?? null,
        status: dados.agenteId ? "distribuida" : "pendente",
        ...rastreador,
        ...colunas(dados),
      } as never)
      .select("*")
      .single();
    conferirErro(error);
    await historico(data.id, data.moto_id, "Vistoria solicitada");
    await AuditoriaService.registrar("vistorias", "criou", data.id, { codigo: data.codigo });
    return paraVistoria(data);
  },

  /** Edição dos dados da solicitação — central e locadora dona da moto. */
  async atualizar(id: string, dados: DadosVistoria): Promise<Vistoria> {
    const alteracao = colunas(dados);
    if (Object.keys(alteracao).length === 0) throw new Error("Nada para atualizar.");
    const { data, error } = await supabase
      .from("vistorias")
      .update(alteracao as never)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(id, data.moto_id, "Dados da vistoria atualizados");
    await AuditoriaService.registrar("vistorias", "alterou", id, alteracao);
    return paraVistoria(data);
  },

  /** Exclusão definitiva — o banco bloqueia vistoria concluída ou faturada. */
  async excluir(id: string) {
    const { error } = await supabase.from("vistorias").delete().eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar("vistorias", "excluiu", id);
  },

  /** Distribuição individual ou em massa para um agente já cadastrado. */
  async distribuir(ids: string[], agenteId: string): Promise<void> {
    if (ids.length === 0) return;
    if (!agenteId) throw new Error("Escolha o agente responsável.");
    const { data, error } = await supabase
      .from("vistorias")
      .update({ agente_id: agenteId, status: "distribuida" })
      .in("id", ids)
      .select("id, moto_id, codigo");
    conferirErro(error);
    await Promise.all(
      (data ?? []).map(async (v) => {
        await historico(v.id, v.moto_id, "Vistoria distribuída");
        await AuditoriaService.registrar("vistorias", "alterou", v.id, {
          codigo: v.codigo,
          acao: "distribuição",
        });
      }),
    );
  },

  /** Troca de agente antes do início — o histórico guarda a mudança. */
  async reatribuir(id: string, agenteId: string) {
    await this.distribuir([id], agenteId);
    await historico(id, undefined, "Vistoria reatribuída");
  },

  /** Agente aceita a vistoria — primeiro passo obrigatório do fluxo de campo. */
  async aceitar(id: string) {
    const gps = await obterGps();
    const { data, error } = await supabase
      .from("vistorias")
      .update({ aceita_em: new Date().toISOString() } as never)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(id, data.moto_id, "Vistoria aceita pelo agente", "", gps);
    return paraVistoria(data);
  },

  /** Início do deslocamento — só depois disso a chegada pode ser registrada. */
  async iniciar(id: string) {
    const gps = await obterGps();
    const { data, error } = await supabase
      .from("vistorias")
      .update({ status: "em_andamento" })
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(id, data.moto_id, "Deslocamento iniciado", "", gps);
    return paraVistoria(data);
  },

  /** Chegada ao local — obrigatória antes das fotos e da conclusão. */
  async registrarChegada(id: string) {
    const gps = await obterGps();
    const { data, error } = await supabase
      .from("vistorias")
      .update({ chegada_em: new Date().toISOString() } as never)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(id, data.moto_id, "Chegada ao local", "", gps);
    return paraVistoria(data);
  },

  /** Aceite do termo de responsabilidade do agente. */
  async aceitarTermo(id: string) {
    const gps = await obterGps();
    const { data, error } = await supabase
      .from("vistorias")
      .update({ termo_aceito: true, termo_aceito_em: new Date().toISOString() } as never)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(id, data.moto_id, "Termo aceito pelo agente", "", gps);
    return paraVistoria(data);
  },

  /**
   * Conclui a vistoria congelando os valores das tabelas vigentes.
   * O banco atualiza a moto e agenda o próximo ciclo de 40 dias.
   */
  async concluir(
    id: string,
    dados: {
      checklist?: ChecklistItem[];
      observacoes?: string;
      valorCobranca?: number | null;
      valorPagamento?: number | null;
      tabelaCobrancaId?: string | null;
      tabelaPagamentoId?: string | null;
    },
  ) {
    // Validação real antes de tentar gravar: as pendências vêm do banco.
    const bloqueios = await this.bloqueiosConclusao(id);
    if (bloqueios.length > 0) {
      throw new Error(bloqueios.map((b) => b.texto).join(" • "));
    }
    const gps = await obterGps();

    const { data, error } = await supabase
      .from("vistorias")
      .update({
        status: "concluida",
        checklist: dados.checklist as unknown as Json,
        observacoes: dados.observacoes ?? "",
        valor_cobranca: dados.valorCobranca && dados.valorCobranca > 0 ? dados.valorCobranca : null,
        valor_pagamento:
          dados.valorPagamento && dados.valorPagamento > 0 ? dados.valorPagamento : null,
        tabela_cobranca_id: dados.tabelaCobrancaId ?? null,
        tabela_pagamento_id: dados.tabelaPagamentoId ?? null,
      })
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(id, data.moto_id, "Vistoria concluída", "", gps);
    await AuditoriaService.registrar("vistorias", "alterou", id, {
      codigo: data.codigo,
      acao: "conclusão",
    });
    return paraVistoria(data);
  },

  async cancelar(id: string, motivo: string) {
    const { data, error } = await supabase
      .from("vistorias")
      .update({ status: "cancelada", motivo_cancelamento: motivo })
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(id, data.moto_id, "Vistoria cancelada", motivo);
    await AuditoriaService.registrar("vistorias", "alterou", id, {
      codigo: data.codigo,
      acao: "cancelamento",
      motivo,
    });
    return paraVistoria(data);
  },

  /** Ajuste de valores pela central antes do faturamento. */
  async ajustarValores(
    id: string,
    valores: { cobranca?: number | null; pagamento?: number | null },
  ) {
    const { data, error } = await supabase
      .from("vistorias")
      .update({
        ...(valores.cobranca !== undefined ? { valor_cobranca: valores.cobranca } : {}),
        ...(valores.pagamento !== undefined ? { valor_pagamento: valores.pagamento } : {}),
      })
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await AuditoriaService.registrar("vistorias", "alterou", id, valores);
    return paraVistoria(data);
  },

  /** Liquidação financeira — mesma lógica de receber/pagar dos recolhimentos. */
  async liquidar(ids: string[], tipo: "receber" | "pagar", pago: boolean) {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("vistorias")
      .update(tipo === "receber" ? { recebimento_pago: pago } : { pagamento_pago: pago })
      .in("id", ids);
    conferirErro(error);
    await Promise.all(
      ids.map((id) =>
        AuditoriaService.registrar("vistorias", pago ? "liquidou" : "alterou", id, { tipo, pago }),
      ),
    );
  },

  // ─────────────────────────── Evidências (fotos obrigatórias) ───────────────────────────

  /**
   * Envia a foto já com marca d'água permanente para o bucket privado.
   *
   * A foto só é considerada entregue quando as três etapas terminam: arquivo no
   * Storage, registro no banco e arquivo comprovadamente recuperável. Se o
   * registro falhar, o arquivo é removido — nada de órfão no bucket.
   */
  async anexarFoto(
    vistoria: Vistoria,
    arquivo: File | Blob,
    ctx: {
      etapa: string;
      placa: string;
      agente: string;
      locadora?: string;
      observacao?: string;
      gps?: string;
      categoria?: CategoriaFoto;
      avariaId?: string | null;
      km?: number | null;
    },
  ): Promise<EvidenciaVistoria> {
    const gps = ctx.gps ?? (await obterGps());
    const coords = await obterCoordenadas();
    const km = ctx.km ?? vistoria.km ?? null;
    const blob = await processarFotoBlob(arquivo, {
      empresa: "Recolhe",
      agente: ctx.agente,
      placa: ctx.placa,
      gps,
      ...(km !== null && km !== undefined ? { km: km.toLocaleString("pt-BR") } : {}),
      ...(ctx.locadora ? { locadora: ctx.locadora } : {}),
    });
    if (blob.size === 0) throw new Error("A foto ficou vazia. Tire a foto novamente.");

    const nome = `${ctx.etapa}-${Date.now()}.webp`;
    const caminho = `locadoras/${vistoria.locadoraId}/vistorias/${vistoria.id}/fotos/${nome}`;
    console.info("[vistoria] upload iniciado", {
      vistoria: vistoria.id,
      etapa: ctx.etapa,
      caminho,
    });
    const envio = await supabase.storage
      .from(BUCKET)
      .upload(caminho, blob, { contentType: blob.type, upsert: false });
    if (envio.error) {
      console.error("[vistoria] falha no upload", { vistoria: vistoria.id, etapa: ctx.etapa });
      conferirErro(envio.error, "envio");
    }

    const { data: sessao } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("vistoria_evidencias")
      .insert({
        vistoria_id: vistoria.id,
        moto_id: vistoria.motoId,
        locadora_id: vistoria.locadoraId,
        agente_id: vistoria.agenteId ?? null,
        usuario_id: sessao.user?.id ?? null,
        tipo: "foto",
        categoria: ctx.categoria ?? "geral",
        avaria_id: ctx.avariaId ?? null,
        km,
        latitude: coords.latitude,
        longitude: coords.longitude,
        etapa: ctx.etapa,
        nome,
        caminho,
        url: "",
        mime: blob.type,
        tamanho: blob.size,
        gps,
        observacao: ctx.observacao ?? "",
      })
      .select("*")
      .single();
    if (error) {
      // Sem registro no banco a foto não existe para o sistema: desfaz o arquivo.
      await supabase.storage
        .from(BUCKET)
        .remove([caminho])
        .catch(() => undefined);
      console.error("[vistoria] falha ao registrar a foto", {
        vistoria: vistoria.id,
        etapa: ctx.etapa,
        erro: error.message,
      });
      conferirErro(error);
    }

    // Confirmação final: o arquivo tem de estar recuperável para o usuário.
    const confirmacao = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60);
    if (confirmacao.error || !confirmacao.data?.signedUrl) {
      await supabase.from("vistoria_evidencias").delete().eq("id", data.id);
      await supabase.storage
        .from(BUCKET)
        .remove([caminho])
        .catch(() => undefined);
      throw new Error("A foto não pôde ser confirmada no armazenamento. Envie novamente.");
    }
    console.info("[vistoria] foto persistida", {
      vistoria: vistoria.id,
      etapa: ctx.etapa,
      foto: data.id,
    });
    return paraEvidenciaVistoria(data);
  },

  /** Link temporário de visualização (bucket privado). */
  async link(evidencia: EvidenciaVistoria, segundos = 3600) {
    if (!evidencia.caminho) return evidencia.url || "";
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(evidencia.caminho, segundos);
    conferirErro(error, "download");
    return data!.signedUrl;
  },

  /**
   * Pendências oficiais da conclusão — a mesma regra que o banco aplica na
   * gravação. A tela nunca decide sozinha se a vistoria pode ser fechada.
   */
  async bloqueiosConclusao(id: string): Promise<{ chave: string; texto: string }[]> {
    const { data, error } = await supabase.rpc("vistoria_bloqueios_conclusao", { _id: id });
    conferirErro(error);
    const retorno = (data ?? {}) as { bloqueios?: { chave: string; texto: string }[] };
    return retorno.bloqueios ?? [];
  },

  /** Vistorias concluídas com evidência faltando — auditoria da central. */
  async inconsistentes() {
    const { data, error } = await supabase.rpc("vistorias_inconsistentes");
    conferirErro(error);
    return data ?? [];
  },

  /** Remove uma foto enviada por engano (antes da conclusão). */
  async removerFoto(evidencia: EvidenciaVistoria) {
    if (evidencia.caminho) {
      await supabase.storage.from(BUCKET).remove([evidencia.caminho]);
    }
    const { error } = await supabase.from("vistoria_evidencias").delete().eq("id", evidencia.id);
    conferirErro(error);
  },


  // ─────────────────── Inspeção: KM, checklist, avarias ───────────────────

  /** KM e coordenadas da inspeção — primeiro passo obrigatório em campo. */
  async registrarKm(id: string, km: number): Promise<Vistoria> {
    if (!Number.isFinite(km) || km < 0) throw new Error("Informe uma quilometragem válida.");
    const coords = await obterCoordenadas();
    const { data, error } = await supabase
      .from("vistorias")
      .update({
        km,
        latitude: coords.latitude,
        longitude: coords.longitude,
      } as never)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(
      id,
      data.moto_id,
      "Quilometragem registrada",
      `${km.toLocaleString("pt-BR")} km`,
      [coords.latitude, coords.longitude].filter(Boolean).join(", "),
    );
    return paraVistoria(data);
  },

  /**
   * Garante que a vistoria tenha uma linha para cada item ativo do catálogo.
   * Nada nasce "bom": todos entram como "não avaliado".
   */
  async prepararChecklist(
    vistoriaId: string,
    catalogo: ItemChecklistCatalogo[],
    jaExistentes: ItemVistoria[],
  ): Promise<ItemVistoria[]> {
    const existentes = new Set(jaExistentes.map((i) => i.codigo));
    const faltando = catalogo.filter((c) => c.ativo && !existentes.has(c.codigo));
    if (faltando.length === 0) return [];
    const { data, error } = await supabase
      .from("vistoria_itens")
      .insert(
        faltando.map((c) => ({
          vistoria_id: vistoriaId,
          catalogo_id: c.id,
          codigo: c.codigo,
          item: c.nome,
          obrigatorio: c.obrigatorio,
          posicao: c.posicao,
        })) as never,
      )
      .select("*");
    conferirErro(error);
    return (data ?? []).map(paraItemVistoria);
  },

  /** Avaliação de um item — o histórico registra cada mudança de condição. */
  async avaliarItem(
    itemId: string,
    condicao: CondicaoItem,
    observacao?: string,
  ): Promise<ItemVistoria> {
    const { data: sessao } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("vistoria_itens")
      .update({
        condicao,
        ...(observacao === undefined ? {} : { observacao }),
        avaliado_em: new Date().toISOString(),
        avaliado_por: sessao.user?.id ?? null,
      } as never)
      .eq("id", itemId)
      .select("*")
      .single();
    conferirErro(error);
    return paraItemVistoria(data);
  },

  /** Avaria identificada — vive fora do checklist e aceita várias fotos. */
  async registrarAvaria(dados: {
    vistoriaId: string;
    itemId?: string | null;
    componente: string;
    condicao?: "regular" | "ruim";
    descricao: string;
  }): Promise<AvariaVistoria> {
    if (!dados.componente.trim()) throw new Error("Informe o componente afetado.");
    if (!dados.descricao.trim()) throw new Error("Descreva a avaria identificada.");
    const { data: sessao } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("vistoria_avarias")
      .insert({
        vistoria_id: dados.vistoriaId,
        item_id: dados.itemId ?? null,
        componente: dados.componente.trim(),
        condicao: dados.condicao ?? "ruim",
        descricao: dados.descricao.trim(),
        criado_por: sessao.user?.id ?? null,
      } as never)
      .select("*")
      .single();
    conferirErro(error);
    return paraAvariaVistoria(data);
  },

  async atualizarAvaria(
    id: string,
    dados: { componente?: string; descricao?: string; condicao?: "regular" | "ruim" },
  ): Promise<AvariaVistoria> {
    const { data, error } = await supabase
      .from("vistoria_avarias")
      .update(dados as never)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    return paraAvariaVistoria(data);
  },

  /** Remoção registrada em auditoria — nada some em silêncio. */
  async removerAvaria(id: string) {
    const { error } = await supabase.from("vistoria_avarias").delete().eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar("vistoria_avarias", "excluiu", id);
  },

  /** Observações gerais — campo livre, separado do checklist. */
  async salvarObservacoes(id: string, observacoes: string) {
    const { data, error } = await supabase
      .from("vistorias")
      .update({ observacoes } as never)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await historico(id, data.moto_id, "Observações atualizadas", observacoes.slice(0, 180));
    return paraVistoria(data);
  },
};
