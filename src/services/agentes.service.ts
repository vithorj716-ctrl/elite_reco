import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { paraAgente, paraDocumento } from "@/domain/entities/mapeadores";
import type { Agente, DocumentoAgente, SituacaoAgente, TipoDocumento } from "@/domain/types";
import { extensaoDoBlob } from "@/lib/foto-perfil";

/** Ficha completa do agente — usada em criação e edição. */
export interface DadosAgente {
  nome: string;
  cpf: string;
  rg: string;
  nascimento: string;
  sexo: string;
  estadoCivil: string;
  telefone: string;
  whatsapp: string;
  email: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
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

export const AGENTE_EM_BRANCO: DadosAgente = {
  nome: "",
  cpf: "",
  rg: "",
  nascimento: "",
  sexo: "",
  estadoCivil: "",
  telefone: "",
  whatsapp: "",
  email: "",
  cep: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "",
  cnh: "",
  cnhCategoria: "A",
  cnhValidade: "",
  contratadoEm: new Date().toISOString().slice(0, 10),
  situacao: "ativo",
  regiao: "",
  cidadesAtendidas: [],
  motoPlaca: "",
  motoModelo: "",
  motoAno: "",
  motoCor: "",
  motoRenavam: "",
  seguro: "",
  observacoes: "",
  foto: "",
};

function paraLinha(d: DadosAgente) {
  return {
    nome: d.nome.trim(),
    cpf: d.cpf,
    rg: d.rg,
    nascimento: d.nascimento,
    sexo: d.sexo,
    estado_civil: d.estadoCivil,
    telefone: d.telefone,
    whatsapp: d.whatsapp,
    email: d.email,
    cep: d.cep,
    rua: d.rua,
    numero: d.numero,
    bairro: d.bairro,
    cidade: d.cidade,
    uf: d.uf,
    cnh: d.cnh,
    cnh_categoria: d.cnhCategoria,
    cnh_validade: d.cnhValidade,
    contratado_em: d.contratadoEm,
    situacao: d.situacao,
    regiao: d.regiao,
    cidades_atendidas: d.cidadesAtendidas,
    moto_placa: d.motoPlaca.toUpperCase(),
    moto_modelo: d.motoModelo,
    moto_ano: d.motoAno,
    moto_cor: d.motoCor,
    moto_renavam: d.motoRenavam,
    seguro: d.seguro,
    observacoes: d.observacoes,
    foto: d.foto,
    ativo: d.situacao === "ativo",
  };
}

export function paraFormularioAgente(a: Agente): DadosAgente {
  return {
    nome: a.nome,
    cpf: a.cpf,
    rg: a.rg,
    nascimento: a.nascimento,
    sexo: a.sexo,
    estadoCivil: a.estadoCivil,
    telefone: a.telefone,
    whatsapp: a.whatsapp,
    email: a.email,
    cep: a.cep,
    rua: a.rua,
    numero: a.numero,
    bairro: a.bairro,
    cidade: a.cidade,
    uf: a.uf,
    cnh: a.cnh,
    cnhCategoria: a.cnhCategoria,
    cnhValidade: a.cnhValidade,
    contratadoEm: a.contratadoEm,
    situacao: a.situacao,
    regiao: a.regiao,
    cidadesAtendidas: a.cidadesAtendidas,
    motoPlaca: a.motoPlaca,
    motoModelo: a.motoModelo,
    motoAno: a.motoAno,
    motoCor: a.motoCor,
    motoRenavam: a.motoRenavam,
    seguro: a.seguro,
    observacoes: a.observacoes,
    foto: a.foto,
  };
}

export const AgentesService = {
  async criar(dados: DadosAgente): Promise<Agente> {
    const { data, error } = await supabase
      .from("agentes")
      .insert(paraLinha(dados))
      .select("*")
      .single();
    conferirErro(error);
    return paraAgente(data);
  },

  async atualizar(id: string, dados: DadosAgente): Promise<Agente> {
    const { data, error } = await supabase
      .from("agentes")
      .update(paraLinha(dados))
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    return paraAgente(data);
  },

  /**
   * Edição rápida do cadastro (nome, telefone, cidade e situação).
   * Roda no banco por rotina auditada: preserva o mesmo id do agente e todos os
   * vínculos com ordens, usuário de acesso e histórico já registrado.
   */
  async editarCadastro(
    id: string,
    dados: { nome: string; telefone: string; cidade: string; situacao: SituacaoAgente },
  ) {
    if (!dados.nome.trim()) throw new Error("Informe o nome do agente.");
    const { error } = await supabase.rpc("atualizar_cadastro_agente", {
      _agente: id,
      _nome: dados.nome.trim(),
      _telefone: dados.telefone,
      _cidade: dados.cidade,
      _situacao: dados.situacao,
    });
    conferirErro(error);
  },

  async definirSituacao(id: string, situacao: SituacaoAgente) {
    const { error } = await supabase
      .from("agentes")
      .update({ situacao, ativo: situacao === "ativo" })
      .eq("id", id);
    conferirErro(error);
  },

  async alternarAtivo(id: string, ativo: boolean) {
    await AgentesService.definirSituacao(id, ativo ? "ativo" : "inativo");
  },

  async definirOnline(id: string, online: boolean) {
    const { error } = await supabase.from("agentes").update({ online }).eq("id", id);
    conferirErro(error);
  },

  /**
   * Decisão manual do agente: liga/desliga a disponibilidade no servidor.
   * Só muda quando ele toca no botão — nunca por falta de comunicação.
   */
  async registrarPresenca(online: boolean): Promise<string | null> {
    const { data, error } = await supabase.rpc("registrar_presenca", { _online: online });
    conferirErro(error);
    return (data as string | null) ?? null;
  },

  /**
   * Sinal de conexão do aparelho: carimba a última comunicação sem tocar na
   * decisão ONLINE/OFFLINE. Se houver fila pendente, o banco tenta distribuir.
   */
  async tocarPresenca(): Promise<string | null> {
    const { data, error } = await supabase.rpc("tocar_presenca");
    conferirErro(error);
    return (data as string | null) ?? null;
  },


  async remover(id: string) {
    const { error } = await supabase.from("agentes").delete().eq("id", id);
    conferirErro(error);
  },

  /** Envia um arquivo para o bucket privado e registra o documento do agente. */
  async enviarDocumento(
    agenteId: string,
    arquivo: File,
    tipo: TipoDocumento,
  ): Promise<DocumentoAgente> {
    const extensao = arquivo.name.split(".").pop() ?? "bin";
    const caminho = `${agenteId}/${tipo}-${Date.now()}.${extensao}`;
    const envio = await supabase.storage.from("documentos").upload(caminho, arquivo, {
      contentType: arquivo.type || "application/octet-stream",
      upsert: false,
    });
    conferirErro(envio.error, "envio");

    const { data, error } = await supabase
      .from("agente_documentos")
      .insert({ agente_id: agenteId, tipo, nome: arquivo.name, url: caminho })
      .select("*")
      .single();
    conferirErro(error);
    return paraDocumento(data);
  },

  /** Link temporário para abrir um arquivo privado. */
  async abrirDocumento(caminho: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(caminho, 60 * 10);
    if (error || !data) throw new Error(error?.message ?? "Não foi possível abrir o arquivo.");
    return data.signedUrl;
  },

  async removerDocumento(id: string, caminho: string) {
    await supabase.storage.from("documentos").remove([caminho]);
    const { error } = await supabase.from("agente_documentos").delete().eq("id", id);
    conferirErro(error);
  },
};

/* ─────────────────────────── Foto de perfil ─────────────────────────── */

/** Fotos antigas podem estar salvas como data URL ou link direto. */
export function fotoEhCaminho(foto: string) {
  return !!foto && !/^(data:|https?:|blob:)/.test(foto);
}

export const FotoAgenteService = {
  /** Envia a foto ao bucket privado e vincula o caminho ao cadastro. */
  async enviar(agenteId: string, blob: Blob): Promise<string> {
    const caminho = `${agenteId}/perfil-${Date.now()}.${extensaoDoBlob(blob)}`;
    const envio = await supabase.storage.from("perfis").upload(caminho, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });
    conferirErro(envio.error, "envio");

    const { error } = await supabase.from("agentes").update({ foto: caminho }).eq("id", agenteId);
    conferirErro(error);
    return caminho;
  },

  /** Link temporário para exibir a foto privada. */
  async url(caminho: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("perfis")
      .createSignedUrl(caminho, 60 * 60);
    if (error || !data) throw new Error(error?.message ?? "Não foi possível abrir a foto.");
    return data.signedUrl;
  },
};
