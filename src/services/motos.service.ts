/**
 * Cadastro de motos. A locadora é sempre uma locadora já cadastrada:
 * a central escolhe na lista e a locadora usa automaticamente a própria sessão.
 */
import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { paraMoto } from "@/domain/entities/mapeadores";
import { AuditoriaService } from "@/services/auditoria.service";
import type { Moto, SituacaoMoto } from "@/domain/types";

export interface NovaMoto {
  locadoraId: string;
  placa: string;
  marca?: string;
  modelo?: string;
  ano?: string;
  cor?: string;
  chassi?: string;
  observacoes?: string;
  situacao?: SituacaoMoto;
  /** Rastreador da moto — link completo do host e PIN em texto. */
  host?: string;
  pin?: string;
}

const normalizar = (dados: NovaMoto) => ({
  locadora_id: dados.locadoraId,
  placa: dados.placa.trim().toUpperCase(),
  marca: dados.marca ?? "",
  modelo: dados.modelo ?? "",
  ano: dados.ano ?? "",
  cor: dados.cor ?? "",
  chassi: dados.chassi ?? "",
  observacoes: dados.observacoes ?? "",
  situacao: dados.situacao ?? "ativa",
  host: (dados.host ?? "").trim(),
  pin: (dados.pin ?? "").trim(),
});

export const MotosService = {
  async criar(dados: NovaMoto): Promise<Moto> {
    if (!dados.locadoraId) throw new Error("Escolha a locadora dona da moto.");
    if (!dados.placa?.trim()) throw new Error("A placa é obrigatória.");
    const { data, error } = await supabase
      .from("motos")
      .insert(normalizar(dados))
      .select("*")
      .single();
    conferirErro(error);
    await AuditoriaService.registrar("motos", "criou", data.id, { placa: data.placa });
    return paraMoto(data);
  },

  async atualizar(id: string, dados: Partial<NovaMoto>): Promise<Moto> {
    const alteracao: Partial<{
      placa: string;
      locadora_id: string;
      marca: string;
      modelo: string;
      ano: string;
      cor: string;
      chassi: string;
      observacoes: string;
      situacao: SituacaoMoto;
      host: string;
      pin: string;
    }> = {};
    if (dados.placa !== undefined) alteracao.placa = dados.placa.trim().toUpperCase();
    if (dados.locadoraId !== undefined) alteracao.locadora_id = dados.locadoraId;
    if (dados.marca !== undefined) alteracao.marca = dados.marca;
    if (dados.modelo !== undefined) alteracao.modelo = dados.modelo;
    if (dados.ano !== undefined) alteracao.ano = dados.ano;
    if (dados.cor !== undefined) alteracao.cor = dados.cor;
    if (dados.chassi !== undefined) alteracao.chassi = dados.chassi;
    if (dados.observacoes !== undefined) alteracao.observacoes = dados.observacoes;
    if (dados.situacao !== undefined) alteracao.situacao = dados.situacao;
    if (dados.host !== undefined) alteracao.host = dados.host.trim();
    if (dados.pin !== undefined) alteracao.pin = dados.pin.trim();

    const { data, error } = await supabase
      .from("motos")
      .update(alteracao)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await AuditoriaService.registrar("motos", "alterou", id, alteracao);
    return paraMoto(data);
  },

  /** Moto inativa não gera alerta e não entra em novas distribuições — o histórico fica. */
  alternarSituacao(id: string, situacao: SituacaoMoto) {
    return this.atualizar(id, { situacao });
  },

  /** A mesma placa não pode existir duas vezes na mesma locadora. */
  async placaDuplicada(locadoraId: string, placa: string, ignorarId?: string): Promise<boolean> {
    const alvo = placa.trim().toUpperCase();
    if (!locadoraId || !alvo) return false;
    let consulta = supabase
      .from("motos")
      .select("id")
      .eq("locadora_id", locadoraId)
      .eq("placa", alvo);
    if (ignorarId) consulta = consulta.neq("id", ignorarId);
    const { data, error } = await consulta.limit(1);
    conferirErro(error);
    return (data?.length ?? 0) > 0;
  },

  /**
   * Conta o que já está amarrado à moto. Enquanto houver histórico, a exclusão
   * física é proibida — a moto é inativada para preservar os relacionamentos.
   */
  async historico(id: string, placa: string) {
    const [vistorias, evidencias, linhas, ordens] = await Promise.all([
      supabase.from("vistorias").select("id", { count: "exact", head: true }).eq("moto_id", id),
      supabase
        .from("vistoria_evidencias")
        .select("id", { count: "exact", head: true })
        .eq("moto_id", id),
      supabase
        .from("vistoria_historico")
        .select("id", { count: "exact", head: true })
        .eq("moto_id", id),
      supabase
        .from("ordens")
        .select("id", { count: "exact", head: true })
        .eq("placa", placa.trim().toUpperCase()),
    ]);
    const resumo = {
      vistorias: vistorias.count ?? 0,
      evidencias: evidencias.count ?? 0,
      historico: linhas.count ?? 0,
      recolhimentos: ordens.count ?? 0,
    };
    return { ...resumo, possui: Object.values(resumo).some((n) => n > 0) };
  },

  /** Exclusão definitiva — só passa quando não há nenhum vínculo operacional. */
  async excluir(id: string, placa: string): Promise<void> {
    const vinculos = await this.historico(id, placa);
    if (vinculos.possui) {
      throw new Error(
        "Esta moto possui histórico operacional e não pode ser excluída definitivamente. Ela será inativada para preservar o histórico.",
      );
    }
    const { error } = await supabase.from("motos").delete().eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar("motos", "excluiu", id, { placa });
  },
};
