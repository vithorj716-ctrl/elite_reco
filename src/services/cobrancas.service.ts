import { conferirErro } from "@/data/erros";
/**
 * Cobranças lançadas dentro da ficha da ordem.
 * Uma ordem pode ter quantas cobranças forem necessárias (recolhimento,
 * diária, guincho, lavagem…) e o total é a soma delas.
 *
 * Regra dura: ordem faturada ou cancelada não aceita mudança de cobrança —
 * validado aqui e também por gatilho no banco.
 */
import { supabase } from "@/integrations/supabase/client";
import { paraCobranca } from "@/domain/entities/mapeadores";
import { AuditoriaService } from "@/services/auditoria.service";
import type { Cobranca, Ordem, TipoCobranca } from "@/domain/types";

function erro(e: { message: string } | null) {
  conferirErro(e);
}

function exigirAberta(ordem: Ordem) {
  if (ordem.recebimentoPago) {
    throw new Error(`Ordem ${ordem.codigo} já faturada: as cobranças estão bloqueadas.`);
  }
  if (ordem.status === "cancelada") {
    throw new Error("Não é possível movimentar cobranças de uma ordem cancelada.");
  }
}

function exigirValor(valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error("O valor da cobrança deve ser maior que zero.");
  }
}

/** A taxa de cancelamento é imutável: só pode ser estornada. */
function exigirEditavel(c: Cobranca) {
  if (c.tipo === "taxa_cancelamento") {
    throw new Error("A taxa de cancelamento é imutável. Use o estorno para reverter o valor.");
  }
  if (c.situacao === "estornada") {
    throw new Error("Cobrança estornada não pode ser alterada.");
  }
}

export interface NovaCobranca {
  ordem: Ordem;
  nome: string;
  valor: number;
  observacao?: string;
  tipo?: TipoCobranca;
}

export const CobrancasService = {
  async criar(nova: NovaCobranca): Promise<Cobranca> {
    exigirAberta(nova.ordem);
    exigirValor(nova.valor);
    if (!nova.nome.trim()) throw new Error("Informe a descrição da cobrança.");
    const usuario = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("ordem_cobrancas")
      .insert({
        ordem_id: nova.ordem.id,
        locadora_id: nova.ordem.locadoraId,
        nome: nova.nome.trim(),
        valor: nova.valor,
        observacao: nova.observacao?.trim() ?? "",
        criado_por: usuario.data.user?.id ?? null,
        tipo: nova.tipo ?? "adicional",
        situacao: "ativa",
      })
      .select("*")
      .single();
    erro(error);
    await AuditoriaService.registrar("ordem_cobrancas", "criou", data!.id, {
      ordem: nova.ordem.codigo,
      nome: nova.nome,
      valor: nova.valor,
      tipo: nova.tipo ?? "adicional",
    });
    return paraCobranca(data!);
  },

  async atualizar(
    ordem: Ordem,
    cobranca: Cobranca,
    campos: { nome?: string; valor?: number; observacao?: string; tipo?: TipoCobranca },
  ) {
    exigirAberta(ordem);
    exigirEditavel(cobranca);
    if (campos.valor !== undefined) exigirValor(campos.valor);
    const { error } = await supabase
      .from("ordem_cobrancas")
      .update({
        ...(campos.nome !== undefined ? { nome: campos.nome.trim() } : {}),
        ...(campos.valor !== undefined ? { valor: campos.valor } : {}),
        ...(campos.observacao !== undefined ? { observacao: campos.observacao.trim() } : {}),
        ...(campos.tipo !== undefined ? { tipo: campos.tipo } : {}),
      })
      .eq("id", cobranca.id);
    erro(error);
    await AuditoriaService.registrar("ordem_cobrancas", "alterou", cobranca.id, {
      ordem: ordem.codigo,
      de: { nome: cobranca.nome, valor: cobranca.valor },
      para: campos,
    });
  },

  /**
   * ESTORNO — reverte o impacto financeiro preservando o histórico.
   * É o único caminho para anular uma taxa de cancelamento.
   */
  async estornar(ordem: Ordem, cobranca: Cobranca, motivo: string) {
    if (ordem.recebimentoPago) {
      throw new Error(`Ordem ${ordem.codigo} já faturada: estorne a liquidação antes.`);
    }
    if (cobranca.situacao === "estornada") throw new Error("Esta cobrança já está estornada.");
    if (!motivo.trim()) throw new Error("Informe o motivo do estorno.");
    const usuario = await supabase.auth.getUser();
    const { error } = await supabase
      .from("ordem_cobrancas")
      .update({
        situacao: "estornada",
        estornada_em: new Date().toISOString(),
        estornada_por: usuario.data.user?.id ?? null,
        motivo_estorno: motivo.trim(),
      })
      .eq("id", cobranca.id);
    erro(error);
    await AuditoriaService.registrar("ordem_cobrancas", "alterou", cobranca.id, {
      ordem: ordem.codigo,
      acao: "estorno",
      nome: cobranca.nome,
      valor: cobranca.valor,
      motivo,
    });
  },

  /**
   * EXCLUSÃO — só para cobranças sem trilha financeira relevante.
   * Taxa de cancelamento e ordem faturada são bloqueadas aqui e no banco.
   */
  async excluir(ordem: Ordem, cobranca: Cobranca) {
    if (ordem.recebimentoPago) {
      throw new Error(`Ordem ${ordem.codigo} já faturada: as cobranças estão bloqueadas.`);
    }
    if (cobranca.tipo === "taxa_cancelamento") {
      throw new Error("A taxa de cancelamento não pode ser excluída. Use o estorno.");
    }
    const { error } = await supabase.from("ordem_cobrancas").delete().eq("id", cobranca.id);
    erro(error);
    await AuditoriaService.registrar("ordem_cobrancas", "excluiu", cobranca.id, {
      ordem: ordem.codigo,
      nome: cobranca.nome,
      valor: cobranca.valor,
    });
  },
};

