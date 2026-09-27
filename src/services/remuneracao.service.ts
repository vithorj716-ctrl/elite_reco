import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { AuditoriaService, responsavelAtual } from "@/services/auditoria.service";
import type { EscopoTabela, ItemRemuneracao, TabelaRemuneracao, UnidadeItem } from "@/domain/types";

export interface NovaTabela {
  nome: string;
  escopo: EscopoTabela;
  locadoraId?: string | null;
  agenteId?: string | null;
  padrao?: boolean;
  observacao?: string;
}

export interface NovoItem {
  nome: string;
  /** Serviço do catálogo vinculado à linha (public.servicos). */
  servicoId?: string | null;
  codigo?: string;
  descricao?: string;
  valor?: number;
  unidade?: UnidadeItem;
  status?: string;
  observacao?: string;
  ativo?: boolean;
  posicao?: number;
}

/**
 * Tabelas de remuneração totalmente livres: o administrador cria, renomeia,
 * duplica e exclui tabelas e linhas — nenhum nome ou valor é fixo no código.
 */
export const RemuneracaoService = {
  async criarTabela(dados: NovaTabela): Promise<TabelaRemuneracao["id"]> {
    const nome = dados.nome.trim();
    if (!nome) throw new Error("Informe o nome da tabela.");
    const { id } = await responsavelAtual();
    const { data, error } = await supabase
      .from("tabelas_remuneracao")
      .insert({
        nome,
        escopo: dados.escopo,
        locadora_id: dados.locadoraId ?? null,
        agente_id: dados.agenteId ?? null,
        padrao: dados.padrao ?? false,
        observacao: dados.observacao ?? "",
        criado_por: id,
        atualizado_por: id,
      })
      .select("id")
      .single();
    conferirErro(error);
    await AuditoriaService.registrar("tabelas_remuneracao", "criou", data.id, {
      nome,
      escopo: dados.escopo,
    });
    return data.id;
  },

  async atualizarTabela(id: string, mudancas: Partial<NovaTabela> & { ativa?: boolean }) {
    const { id: quem } = await responsavelAtual();
    const alteracao: Record<string, unknown> = { atualizado_por: quem };
    if (mudancas.nome !== undefined) alteracao["nome"] = mudancas.nome.trim();
    if (mudancas.observacao !== undefined) alteracao["observacao"] = mudancas.observacao;
    if (mudancas.locadoraId !== undefined) alteracao["locadora_id"] = mudancas.locadoraId;
    if (mudancas.agenteId !== undefined) alteracao["agente_id"] = mudancas.agenteId;
    if (mudancas.padrao !== undefined) alteracao["padrao"] = mudancas.padrao;
    if (mudancas.ativa !== undefined) alteracao["ativa"] = mudancas.ativa;
    const { error } = await supabase
      .from("tabelas_remuneracao")
      .update(alteracao as never)
      .eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar(
      "tabelas_remuneracao",
      "alterou",
      id,
      mudancas as Record<string, unknown>,
    );
  },

  async excluirTabela(id: string) {
    const { error } = await supabase.from("tabelas_remuneracao").delete().eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar("tabelas_remuneracao", "excluiu", id);
  },

  /** Duplica a tabela inteira, com todas as linhas, para ajuste independente. */
  async duplicarTabela(origem: TabelaRemuneracao, itens: ItemRemuneracao[], nome?: string) {
    const novoId = await this.criarTabela({
      nome: nome?.trim() || `${origem.nome} (cópia)`,
      escopo: origem.escopo,
      observacao: origem.observacao,
    });
    if (itens.length > 0) {
      const { id: quem } = await responsavelAtual();
      const { error } = await supabase.from("itens_remuneracao").insert(
        itens.map((i) => ({
          tabela_id: novoId,
          servico_id: i.servicoId ?? null,
          codigo: i.codigo,
          nome: i.nome,
          descricao: i.descricao,
          valor: i.valor,
          unidade: i.unidade,
          status: i.status,
          observacao: i.observacao,
          ativo: i.ativo,
          posicao: i.posicao,
          criado_por: quem,
          atualizado_por: quem,
        })),
      );
      conferirErro(error);
    }
    await AuditoriaService.registrar("tabelas_remuneracao", "duplicou", novoId, {
      origem: origem.id,
    });
    return novoId;
  },

  async adicionarItem(tabelaId: string, dados: NovoItem) {
    const nome = (dados.nome ?? "").trim();
    if (!nome) throw new Error("Informe o nome do serviço.");
    const { id: quem } = await responsavelAtual();
    const { data, error } = await supabase
      .from("itens_remuneracao")
      .insert({
        tabela_id: tabelaId,
        nome,
        servico_id: dados.servicoId ?? null,
        codigo: dados.codigo ?? "",
        descricao: dados.descricao ?? "",
        valor: dados.valor ?? 0,
        unidade: dados.unidade ?? "fixo",
        status: dados.status ?? "vigente",
        observacao: dados.observacao ?? "",
        ativo: dados.ativo ?? true,
        posicao: dados.posicao ?? 0,
        criado_por: quem,
        atualizado_por: quem,
      })
      .select("id")
      .single();
    conferirErro(error);
    await AuditoriaService.registrar("itens_remuneracao", "criou", data.id, { tabelaId, nome });
    return data.id;
  },

  async atualizarItem(id: string, mudancas: Partial<ItemRemuneracao>) {
    const { id: quem } = await responsavelAtual();
    const alteracao: Record<string, unknown> = { atualizado_por: quem };
    for (const [chave, coluna] of [
      ["nome", "nome"],
      ["servicoId", "servico_id"],
      ["codigo", "codigo"],
      ["descricao", "descricao"],
      ["valor", "valor"],
      ["unidade", "unidade"],
      ["status", "status"],
      ["observacao", "observacao"],
      ["ativo", "ativo"],
      ["posicao", "posicao"],
    ] as const) {
      const v = (mudancas as Record<string, unknown>)[chave];
      if (v !== undefined) alteracao[coluna] = v;
    }
    const { error } = await supabase
      .from("itens_remuneracao")
      .update(alteracao as never)
      .eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar(
      "itens_remuneracao",
      "alterou",
      id,
      mudancas as Record<string, unknown>,
    );
  },

  /** Duplica uma linha da planilha logo abaixo da original. */
  async duplicarItem(item: ItemRemuneracao) {
    return this.adicionarItem(item.tabelaId, {
      nome: `${item.nome} (cópia)`,
      servicoId: item.servicoId ?? null,
      codigo: item.codigo,
      descricao: item.descricao,
      valor: item.valor,
      unidade: item.unidade,
      status: item.status,
      observacao: item.observacao,
      ativo: item.ativo,
      posicao: item.posicao + 1,
    });
  },

  /** Reorganiza a planilha gravando a nova posição de cada linha. */
  async reordenar(itens: ItemRemuneracao[]) {
    const { id: quem } = await responsavelAtual();
    for (const [posicao, item] of itens.entries()) {
      if (item.posicao === posicao) continue;
      const { error } = await supabase
        .from("itens_remuneracao")
        .update({ posicao, atualizado_por: quem } as never)
        .eq("id", item.id);
      conferirErro(error);
    }
  },

  async excluirItem(id: string) {
    const { error } = await supabase.from("itens_remuneracao").delete().eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar("itens_remuneracao", "excluiu", id);
  },
};
