import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { paraLancamento } from "@/domain/entities/mapeadores";
import { AuditoriaService, responsavelAtual } from "@/services/auditoria.service";
import type { Banco, LancamentoAgente, TipoLancamento } from "@/domain/types";
import { saldoAgente } from "@/domain/services/financeiro";

export interface NovoLancamento {
  agenteId: string;
  tipo: TipoLancamento;
  valor: number;
  data: string;
  forma?: string;
  descricao?: string;
  observacao?: string;
  comprovante?: File | null;
}

async function enviarComprovante(agenteId: string, arquivo: File) {
  const extensao = arquivo.name.split(".").pop() ?? "bin";
  const caminho = `${agenteId}/financeiro-${Date.now()}.${extensao}`;
  const envio = await supabase.storage.from("documentos").upload(caminho, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
    upsert: false,
  });
  conferirErro(envio.error, "envio");
  return caminho;
}

/**
 * Livro-caixa do agente. Nada é editado ou apagado: cada movimento vira uma
 * linha definitiva. Um pagamento compensa automaticamente os adiantamentos em
 * aberto antes de liquidar o saldo, e a compensação também fica registrada.
 */
export const LancamentosService = {
  async registrar(dados: NovoLancamento): Promise<LancamentoAgente> {
    if (!(dados.valor > 0)) throw new Error("O valor deve ser maior que zero.");
    const responsavel = await responsavelAtual();
    const comprovante = dados.comprovante
      ? await enviarComprovante(dados.agenteId, dados.comprovante)
      : "";

    const { data, error } = await supabase
      .from("lancamentos_agente")
      .insert({
        agente_id: dados.agenteId,
        tipo: dados.tipo,
        valor: dados.valor,
        data: new Date(dados.data).toISOString(),
        forma: dados.forma ?? "",
        descricao: dados.descricao ?? "",
        observacao: dados.observacao ?? "",
        comprovante,
        responsavel: responsavel.nome,
        criado_por: responsavel.id,
      })
      .select("*")
      .single();
    conferirErro(error);
    await AuditoriaService.registrar("lancamentos_agente", "criou", data.id, {
      tipo: dados.tipo,
      valor: dados.valor,
      agenteId: dados.agenteId,
    });
    return paraLancamento(data);
  },

  /** Adiantamento: sai do caixa agora e fica pendente até ser compensado. */
  adiantar(dados: Omit<NovoLancamento, "tipo">) {
    return this.registrar({
      ...dados,
      tipo: "adiantamento",
      descricao: dados.descricao || "Adiantamento",
    });
  },

  desconto(dados: Omit<NovoLancamento, "tipo">) {
    return this.registrar({ ...dados, tipo: "desconto", descricao: dados.descricao || "Desconto" });
  },

  bonificacao(dados: Omit<NovoLancamento, "tipo">) {
    return this.registrar({
      ...dados,
      tipo: "bonificacao",
      descricao: dados.descricao || "Bonificação",
    });
  },

  /**
   * Pagamento com compensação automática dos adiantamentos em aberto.
   * Retorna quanto foi abatido e o lançamento do pagamento líquido.
   */
  async pagar(banco: Banco, dados: Omit<NovoLancamento, "tipo">) {
    if (!(dados.valor > 0)) throw new Error("O valor do pagamento deve ser maior que zero.");
    const responsavel = await responsavelAtual();

    const compensados = new Set(
      banco.lancamentos.filter((l) => l.tipo === "compensacao").map((l) => l.referenciaId),
    );
    const abertos = banco.lancamentos
      .filter(
        (l) => l.tipo === "adiantamento" && l.agenteId === dados.agenteId && !compensados.has(l.id),
      )
      .sort((a, b) => a.data.localeCompare(b.data));

    let restante = dados.valor;
    let abatido = 0;
    for (const adiantamento of abertos) {
      if (restante < adiantamento.valor) break;
      const { error } = await supabase.from("lancamentos_agente").insert({
        agente_id: dados.agenteId,
        tipo: "compensacao",
        valor: adiantamento.valor,
        data: new Date(dados.data).toISOString(),
        forma: "",
        descricao: `Compensação de adiantamento de ${adiantamento.data.slice(0, 10)}`,
        observacao: dados.observacao ?? "",
        comprovante: "",
        responsavel: responsavel.nome,
        criado_por: responsavel.id,
        referencia_id: adiantamento.id,
      });
      conferirErro(error);
      restante -= adiantamento.valor;
      abatido += adiantamento.valor;
    }

    const pagamento = await this.registrar({
      ...dados,
      valor: restante,
      tipo: "pagamento",
      descricao: dados.descricao || "Pagamento ao agente",
    });
    return { pagamento, abatido, liquido: restante };
  },

  /** Saldo disponível para pagar, já descontados os adiantamentos em aberto. */
  disponivel(banco: Banco, agenteId: string) {
    const s = saldoAgente(banco, agenteId);
    return Math.max(s.pendente, 0);
  },

  /**
   * Edição de um lançamento ainda não utilizado (sem compensação vinculada).
   * Valor, data, forma, descrição, observação e comprovante são ajustáveis.
   */
  async editar(
    banco: Banco,
    id: string,
    campos: {
      valor?: number;
      data?: string;
      forma?: string;
      descricao?: string;
      observacao?: string;
      comprovante?: File | null;
    },
  ) {
    const atual = banco.lancamentos.find((l) => l.id === id);
    if (!atual) throw new Error("Lançamento não encontrado.");
    if (atual.situacao !== "ativo")
      throw new Error("Lançamento cancelado ou estornado não pode ser editado.");
    if (this.utilizado(banco, id))
      throw new Error("Este adiantamento já foi compensado por um pagamento. Faça o estorno.");
    if (campos.valor !== undefined && !(campos.valor > 0))
      throw new Error("O valor deve ser maior que zero.");

    const alteracao: Record<string, unknown> = {};
    if (campos.valor !== undefined) alteracao["valor"] = campos.valor;
    if (campos.data !== undefined) alteracao["data"] = new Date(campos.data).toISOString();
    if (campos.forma !== undefined) alteracao["forma"] = campos.forma;
    if (campos.descricao !== undefined) alteracao["descricao"] = campos.descricao;
    if (campos.observacao !== undefined) alteracao["observacao"] = campos.observacao;
    if (campos.comprovante)
      alteracao["comprovante"] = await enviarComprovante(atual.agenteId, campos.comprovante);

    const { error } = await supabase
      .from("lancamentos_agente")
      .update(alteracao as never)
      .eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar("lancamentos_agente", "alterou", id, alteracao);
  },

  /** Um adiantamento já compensado por pagamento não pode mais ser excluído. */
  utilizado(banco: Banco, id: string) {
    return banco.lancamentos.some((l) => l.tipo === "compensacao" && l.referenciaId === id);
  },

  /** Exclusão definitiva — só permitida enquanto o lançamento não foi utilizado. */
  async excluir(banco: Banco, id: string) {
    const atual = banco.lancamentos.find((l) => l.id === id);
    if (!atual) throw new Error("Lançamento não encontrado.");
    if (this.utilizado(banco, id))
      throw new Error(
        "Este adiantamento já foi utilizado em um pagamento. Use o estorno para desfazê-lo.",
      );
    const { error } = await supabase.from("lancamentos_agente").delete().eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar("lancamentos_agente", "excluiu", id, {
      tipo: atual.tipo,
      valor: atual.valor,
      agenteId: atual.agenteId,
    });
  },

  /**
   * Estorno: o lançamento permanece no extrato, marcado como estornado, e as
   * compensações vinculadas são canceladas para devolver o saldo ao agente.
   */
  async estornar(banco: Banco, id: string, motivo: string) {
    const atual = banco.lancamentos.find((l) => l.id === id);
    if (!atual) throw new Error("Lançamento não encontrado.");
    if (atual.situacao !== "ativo") throw new Error("Este lançamento já foi estornado.");
    if (!motivo.trim()) throw new Error("Informe o motivo do estorno.");

    const vinculados = banco.lancamentos
      .filter((l) => l.tipo === "compensacao" && l.referenciaId === id)
      .map((l) => l.id);

    const marcar = async (ids: string[], situacao: "estornado" | "cancelado") => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("lancamentos_agente")
        .update({ situacao, motivo: motivo.trim() } as never)
        .in("id", ids);
      conferirErro(error);
    };
    await marcar([id], "estornado");
    await marcar(vinculados, "cancelado");

    await AuditoriaService.registrar("lancamentos_agente", "estornou", id, {
      motivo,
      valor: atual.valor,
      compensacoesCanceladas: vinculados.length,
    });
  },

  async abrirComprovante(caminho: string) {
    const { data, error } = await supabase.storage
      .from("documentos")
      .createSignedUrl(caminho, 60 * 10);
    if (error || !data) throw new Error(error?.message ?? "Comprovante indisponível.");
    return data.signedUrl;
  },
};
