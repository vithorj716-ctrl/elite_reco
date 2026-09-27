/**
 * Catálogo de serviços da operação.
 *
 * Regra central: o catálogo global existe para administrar os serviços; a
 * tabela vinculada à locadora é que determina quais serviços podem ser
 * utilizados nas ordens daquela locadora.
 */
import type { Banco, ItemRemuneracao, Ordem, Servico, TabelaRemuneracao } from "@/domain/types";

const lista = (banco: Banco): Servico[] => banco.servicos ?? [];

/** Todos os serviços ativos do catálogo, na ordem definida pelo administrador. */
export function catalogoAtivo(banco: Banco): Servico[] {
  return lista(banco)
    .filter((s) => s.ativo)
    .sort((a, b) => a.posicao - b.posicao || a.nome.localeCompare(b.nome));
}

export function servicoPorId(banco: Banco, id?: string | null): Servico | null {
  if (!id) return null;
  return lista(banco).find((s) => s.id === id) ?? null;
}

export function servicoPorCodigo(banco: Banco, codigo?: string | null): Servico | null {
  if (!codigo) return null;
  return lista(banco).find((s) => s.codigo === codigo) ?? null;
}

/** Serviço de uma ordem: pelo vínculo novo, com queda para o código legado. */
export function servicoDaOrdem(banco: Banco, o: Ordem): Servico | null {
  return servicoPorId(banco, o.servicoId) ?? servicoPorCodigo(banco, o.tipoServico ?? null);
}

/** Nome exibível do serviço de uma ordem, sem depender de rótulos fixos. */
export function nomeServico(banco: Banco, o: Ordem): string {
  const s = servicoDaOrdem(banco, o);
  if (s) return s.nome;
  const codigo = o.tipoServico ?? "";
  if (!codigo) return "—";
  return codigo.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Tabela de cobrança vinculada à locadora, com queda para a tabela padrão. */
export function tabelaDeCobranca(banco: Banco, locadoraId: string): TabelaRemuneracao | null {
  const tabelas = banco.tabelas ?? [];
  const locadora = banco.locadoras.find((l) => l.id === locadoraId);
  const vinculada = locadora?.tabelaCobrancaId
    ? tabelas.find((t) => t.id === locadora.tabelaCobrancaId && t.ativa)
    : undefined;
  if (vinculada) return vinculada;
  return (
    tabelas.find((t) => t.escopo === "cobranca" && t.ativa && t.locadoraId === locadoraId) ??
    tabelas.find(
      (t) => t.escopo === "cobranca" && t.ativa && t.padrao && !t.locadoraId && !t.agenteId,
    ) ??
    null
  );
}

/** Linhas ativas da tabela vinculada à locadora. */
export function itensDaLocadora(banco: Banco, locadoraId: string): ItemRemuneracao[] {
  const tabela = tabelaDeCobranca(banco, locadoraId);
  if (!tabela) return [];
  return (banco.itens ?? [])
    .filter((i) => i.tabelaId === tabela.id && i.ativo)
    .sort((a, b) => a.posicao - b.posicao || a.nome.localeCompare(b.nome));
}

/**
 * Serviços que podem ser escolhidos numa ordem desta locadora: somente os que
 * existem na tabela vinculada a ela e continuam ativos no catálogo.
 */
export function servicosDaLocadora(banco: Banco, locadoraId?: string | null): Servico[] {
  if (!locadoraId) return [];
  const vistos = new Set<string>();
  const resultado: Servico[] = [];
  for (const item of itensDaLocadora(banco, locadoraId)) {
    const servico = servicoPorId(banco, item.servicoId) ?? servicoPorCodigo(banco, item.codigo);
    if (!servico || !servico.ativo || vistos.has(servico.id)) continue;
    vistos.add(servico.id);
    resultado.push(servico);
  }
  return resultado;
}
