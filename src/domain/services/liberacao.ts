/**
 * Liberação administrativa da operação.
 *
 * Depois que o administrador define e libera uma operação, os valores passam a
 * viver NA PRÓPRIA operação. A tabela de remuneração continua sendo apenas a
 * referência para novas operações — nunca a fonte do valor histórico. Por isso
 * o financeiro pergunta primeiro se a operação já foi liberada: se foi, o valor
 * gravado é o único aceito, sem nenhum recálculo pela tabela atual.
 */
import type { Banco } from "@/domain/types";

/** A operação já passou pela definição/liberação do administrador. */
export function operacaoLiberada(
  banco: Banco,
  ref: { ordemId?: string; vistoriaId?: string },
): boolean {
  return (banco.distribuicoes ?? []).some(
    (d) =>
      !!d.aprovadaEm &&
      ((ref.ordemId && d.ordemId === ref.ordemId) ||
        (ref.vistoriaId && d.vistoriaId === ref.vistoriaId)),
  );
}
