/**
 * Catálogo administrável dos itens de checklist da vistoria.
 *
 * Os itens não ficam presos no código: a central adiciona, renomeia, ordena,
 * desativa e define quando a foto é obrigatória.
 */
import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { paraItemChecklistCatalogo } from "@/domain/entities/mapeadores";
import { AuditoriaService } from "@/services/auditoria.service";
import type { ItemChecklistCatalogo } from "@/domain/types";

export interface DadosItemChecklist {
  nome: string;
  codigo?: string;
  ativo?: boolean;
  obrigatorio?: boolean;
  fotoQuandoRuim?: boolean;
  fotoQuandoRegular?: boolean;
  posicao?: number;
}

/** Código estável a partir do nome — usado para casar itens já avaliados. */
export function codigoDoItem(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function colunas(dados: Partial<DadosItemChecklist>) {
  const saida: Record<string, unknown> = {};
  if (dados.nome !== undefined) saida["nome"] = dados.nome.trim();
  if (dados.codigo !== undefined) saida["codigo"] = dados.codigo;
  if (dados.ativo !== undefined) saida["ativo"] = dados.ativo;
  if (dados.obrigatorio !== undefined) saida["obrigatorio"] = dados.obrigatorio;
  if (dados.fotoQuandoRuim !== undefined) saida["foto_quando_ruim"] = dados.fotoQuandoRuim;
  if (dados.fotoQuandoRegular !== undefined) saida["foto_quando_regular"] = dados.fotoQuandoRegular;
  if (dados.posicao !== undefined) saida["posicao"] = dados.posicao;
  return saida;
}

export const ChecklistVistoriaService = {
  async criar(dados: DadosItemChecklist): Promise<ItemChecklistCatalogo> {
    const nome = dados.nome.trim();
    if (!nome) throw new Error("Informe o nome do item.");
    const { data, error } = await supabase
      .from("vistoria_checklist_itens")
      .insert({
        ...colunas(dados),
        nome,
        codigo: dados.codigo?.trim() || codigoDoItem(nome),
      } as never)
      .select("*")
      .single();
    conferirErro(error);
    await AuditoriaService.registrar("vistoria_checklist_itens", "criou", data.id, { nome });
    return paraItemChecklistCatalogo(data);
  },

  async atualizar(id: string, dados: Partial<DadosItemChecklist>): Promise<ItemChecklistCatalogo> {
    const alteracao = colunas(dados);
    if (Object.keys(alteracao).length === 0) throw new Error("Nada para atualizar.");
    const { data, error } = await supabase
      .from("vistoria_checklist_itens")
      .update(alteracao as never)
      .eq("id", id)
      .select("*")
      .single();
    conferirErro(error);
    await AuditoriaService.registrar("vistoria_checklist_itens", "alterou", id, alteracao);
    return paraItemChecklistCatalogo(data);
  },

  /** Desativar preserva o histórico das vistorias já feitas com o item. */
  async desativar(id: string, ativo: boolean) {
    return this.atualizar(id, { ativo });
  },

  async excluir(id: string) {
    const { error } = await supabase.from("vistoria_checklist_itens").delete().eq("id", id);
    conferirErro(error);
    await AuditoriaService.registrar("vistoria_checklist_itens", "excluiu", id);
  },

  /** Reordena em lote pela posição informada na tela. */
  async reordenar(ordem: Array<{ id: string; posicao: number }>) {
    await Promise.all(
      ordem.map((o) =>
        supabase.from("vistoria_checklist_itens").update({ posicao: o.posicao }).eq("id", o.id),
      ),
    );
  },
};
