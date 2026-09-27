import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { paraLocadora } from "@/domain/entities/mapeadores";
import type { Locadora } from "@/domain/types";

/** Campos editáveis de uma locadora (os públicos vêm da BrasilAPI). */
export interface DadosLocadora {
  cnpj: string;
  nome: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: string;
  dataAbertura: string;
  naturezaJuridica: string;
  cnae: string;
  cep: string;
  uf: string;
  cidade: string;
  bairro: string;
  rua: string;
  numero: string;
  complemento: string;
  telefone: string;
  email: string;
  responsavel: string;
  limiteCredito: number;
  formaPagamento: string;
  prazoPagamento: number;
  observacoes: string;
  ativa: boolean;
}

export const LOCADORA_EM_BRANCO: DadosLocadora = {
  cnpj: "",
  nome: "",
  razaoSocial: "",
  nomeFantasia: "",
  situacaoCadastral: "",
  dataAbertura: "",
  naturezaJuridica: "",
  cnae: "",
  cep: "",
  uf: "",
  cidade: "",
  bairro: "",
  rua: "",
  numero: "",
  complemento: "",
  telefone: "",
  email: "",
  responsavel: "",
  limiteCredito: 0,
  formaPagamento: "boleto",
  prazoPagamento: 15,
  observacoes: "",
  ativa: true,
};

function paraLinha(d: DadosLocadora) {
  return {
    nome: (d.nome || d.nomeFantasia || d.razaoSocial).trim(),
    cnpj: d.cnpj,
    razao_social: d.razaoSocial,
    nome_fantasia: d.nomeFantasia,
    situacao_cadastral: d.situacaoCadastral,
    data_abertura: d.dataAbertura,
    natureza_juridica: d.naturezaJuridica,
    cnae: d.cnae,
    cep: d.cep,
    uf: d.uf,
    cidade: d.cidade,
    bairro: d.bairro,
    rua: d.rua,
    numero: d.numero,
    complemento: d.complemento,
    telefone: d.telefone,
    email: d.email,
    responsavel: d.responsavel,
    limite_credito: d.limiteCredito,
    forma_pagamento: d.formaPagamento,
    prazo_pagamento: d.prazoPagamento,
    observacoes: d.observacoes,
    ativa: d.ativa,
  };
}

export function paraFormulario(l: Locadora): DadosLocadora {
  return {
    cnpj: l.cnpj,
    nome: l.nome,
    razaoSocial: l.razaoSocial,
    nomeFantasia: l.nomeFantasia,
    situacaoCadastral: l.situacaoCadastral,
    dataAbertura: l.dataAbertura,
    naturezaJuridica: l.naturezaJuridica,
    cnae: l.cnae,
    cep: l.cep,
    uf: l.uf,
    cidade: l.cidade,
    bairro: l.bairro,
    rua: l.rua,
    numero: l.numero,
    complemento: l.complemento,
    telefone: l.telefone,
    email: l.email,
    responsavel: l.responsavel,
    limiteCredito: l.limiteCredito,
    formaPagamento: l.formaPagamento,
    prazoPagamento: l.prazoPagamento,
    observacoes: l.observacoes,
    ativa: l.ativa,
  };
}

export const LocadorasService = {
  async criar(dados: DadosLocadora): Promise<Locadora> {
    const { data, error } = await supabase
      .from("locadoras")
      .insert(paraLinha(dados))
      .select("*")
      .single();
    conferirErro(error);
    return paraLocadora(data);
  },

  async atualizar(id: string, dados: DadosLocadora): Promise<Locadora> {
    const { data, error } = await supabase
      .from("locadoras")
      .update(paraLinha(dados))
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    return paraLocadora(data);
  },

  async alternarAtiva(id: string, ativa: boolean) {
    const { error } = await supabase.from("locadoras").update({ ativa }).eq("id", id);
    conferirErro(error);
  },

  async remover(id: string) {
    const { error } = await supabase.from("locadoras").delete().eq("id", id);
    conferirErro(error);
  },
};
