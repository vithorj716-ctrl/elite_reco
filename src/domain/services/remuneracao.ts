/**
 * Resolução de valores a partir das tabelas de remuneração.
 * Nada é fixo: os serviços, as linhas e os valores são criados pelo administrador.
 *
 * Ordem de prevalência
 *  - Cobrança:  tabela vinculada à locadora → tabela padrão de cobrança.
 *  - Pagamento: tabela de pagamento da locadora → tabela do agente → padrão.
 */
import { servicoDaOrdem, tabelaDeCobranca } from "@/domain/services/catalogo";
import type { Banco, ItemRemuneracao, Ordem, TabelaRemuneracao } from "@/domain/types";

/** Listas defensivas: o banco pode chegar parcialmente carregado. */
const listaTabelas = (banco: Banco): TabelaRemuneracao[] => banco.tabelas ?? [];
const listaItens = (banco: Banco): ItemRemuneracao[] => banco.itens ?? [];

export function itensDa(banco: Banco, tabelaId: string): ItemRemuneracao[] {
  return listaItens(banco)
    .filter((i) => i.tabelaId === tabelaId)
    .sort((a, b) => a.posicao - b.posicao || a.nome.localeCompare(b.nome));
}

export function tabelasDe(banco: Banco, escopo: TabelaRemuneracao["escopo"]) {
  return listaTabelas(banco).filter((t) => t.escopo === escopo);
}

export const tabelaDaLocadora = (
  banco: Banco,
  locadoraId: string,
  escopo: TabelaRemuneracao["escopo"],
) =>
  escopo === "cobranca"
    ? tabelaDeCobranca(banco, locadoraId)
    : (listaTabelas(banco).find(
        (t) => t.escopo === escopo && t.ativa && t.locadoraId === locadoraId,
      ) ?? null);

export const tabelaDoAgente = (banco: Banco, agenteId: string) =>
  listaTabelas(banco).find((t) => t.escopo === "pagamento" && t.ativa && t.agenteId === agenteId) ??
  null;

export const tabelaPadrao = (banco: Banco, escopo: TabelaRemuneracao["escopo"]) =>
  listaTabelas(banco).find(
    (t) => t.escopo === escopo && t.ativa && t.padrao && !t.locadoraId && !t.agenteId,
  ) ?? null;

/**
 * Valor de uma linha da tabela para o serviço da ordem. Linhas por quilômetro
 * são multiplicadas pela quilometragem informada; sem km, vale o valor fechado.
 *
 * Quando a ordem não tem serviço definido (importações antigas, ordens criadas
 * sem catálogo), usa-se a primeira linha ativa da tabela — é o valor padrão
 * cadastrado pelo administrador, e não zero.
 */
function valorDoServico(
  banco: Banco,
  tabela: TabelaRemuneracao | null,
  o: Ordem,
  km = 0,
): number | null {
  if (!tabela) return null;
  const servico = servicoDaOrdem(banco, o);
  const linhas = itensDa(banco, tabela.id).filter((i) => i.ativo);
  const item =
    linhas.find(
      (i) =>
        (servico && (i.servicoId === servico.id || i.codigo === servico.codigo)) ||
        (!servico && !!o.tipoServico && i.codigo === o.tipoServico),
    ) ??
    (!servico && !o.tipoServico ? linhas.find((i) => i.valor > 0) : undefined);
  if (!item) return null;
  if (item.unidade === "km" && km > 0) return item.valor * km;
  return item.valor;
}


/** Quanto a locadora paga por esta ordem. */
export function precoCobranca(banco: Banco, o: Ordem): number | null {
  const km = o.quantidadeKm ?? 0;
  return (
    valorDoServico(banco, tabelaDaLocadora(banco, o.locadoraId, "cobranca"), o, km) ??
    valorDoServico(banco, tabelaPadrao(banco, "cobranca"), o, km)
  );
}

/** Quanto o agente recebe por esta ordem. */
export function precoPagamento(banco: Banco, o: Ordem): number | null {
  const km = o.quantidadeKm ?? 0;
  const daLocadora = valorDoServico(banco, tabelaDaLocadora(banco, o.locadoraId, "pagamento"), o, km);
  if (daLocadora !== null) return daLocadora;
  const doAgente = o.agenteId
    ? valorDoServico(banco, tabelaDoAgente(banco, o.agenteId), o, km)
    : null;
  if (doAgente !== null) return doAgente;
  return valorDoServico(banco, tabelaPadrao(banco, "pagamento"), o, km);
}

/** Nome da tabela usada para precificar uma ordem — usado nos extratos. */
export function origemDoPreco(banco: Banco, o: Ordem, escopo: TabelaRemuneracao["escopo"]): string {
  const daLocadora = tabelaDaLocadora(banco, o.locadoraId, escopo);
  if (daLocadora && valorDoServico(banco, daLocadora, o) !== null) return daLocadora.nome;
  if (escopo === "pagamento" && o.agenteId) {
    const doAgente = tabelaDoAgente(banco, o.agenteId);
    if (doAgente && valorDoServico(banco, doAgente, o) !== null) return doAgente.nome;
  }
  const padrao = tabelaPadrao(banco, escopo);
  if (padrao && valorDoServico(banco, padrao, o) !== null) return padrao.nome;
  return "Sem tabela";
}
