import { traduzirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { AuditoriaService } from "@/services/auditoria.service";
import type { OperacaoFinanceira } from "@/domain/services/financeiro";

export interface ResultadoLiquidacao {
  /** Operações efetivamente persistidas (confirmadas pelo banco). */
  liquidadas: OperacaoFinanceira[];
  /** Operações que já estavam na situação pedida — nada foi feito. */
  ignoradas: OperacaoFinanceira[];
  /** Falhas individuais, com o motivo real devolvido pelo banco. */
  falhas: { operacao: OperacaoFinanceira; motivo: string }[];
  valor: number;
}

const tabela = (op: OperacaoFinanceira) => (op.tipo === "vistoria" ? "vistorias" : "ordens");

/**
 * Liquidação financeira — fluxo próprio, isolado e verificado.
 *
 * Regras que valem sempre:
 *  - cada operação é liquidada individualmente: um registro problemático
 *    (vistoria sem preço, ordem travada por gatilho, dado órfão) NUNCA impede a
 *    liquidação das demais;
 *  - só é considerado liquidado o que o banco devolveu com a coluna já gravada;
 *  - dupla liquidação é impossível: o que já está na situação pedida é ignorado;
 *  - toda liquidação e todo estorno vão para a auditoria com valor e data.
 */
async function liquidarUma(
  op: OperacaoFinanceira,
  tipo: "receber" | "pagar",
  pago: boolean,
): Promise<"ok" | "ignorada"> {
  const coluna = tipo === "receber" ? "recebimento_pago" : "pagamento_pago";
  const jaEsta = tipo === "receber" ? op.recebimentoPago : op.pagamentoPago;
  if (jaEsta === pago) return "ignorada";

  const { data, error } = await supabase
    .from(tabela(op))
    .update({ [coluna]: pago } as never)
    .eq("id", op.refId)
    .select(`id, ${coluna}`);

  if (error) throw traduzirErro(error);

  const linha = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!linha) {
    throw new Error(
      "O banco não confirmou a gravação (registro não encontrado ou sem permissão). Nada foi alterado.",
    );
  }
  if (Boolean(linha[coluna]) !== pago) {
    throw new Error("O banco recusou a alteração da situação financeira. Nada foi alterado.");
  }
  return "ok";
}

export const FinanceiroService = {
  /**
   * Liquida (ou estorna) um conjunto de operações — recolhimentos, vistorias ou
   * as duas coisas na mesma seleção. Devolve o que foi feito para a tela poder
   * informar exatamente o resultado, inclusive as falhas.
   */
  async liquidar(
    operacoes: OperacaoFinanceira[],
    tipo: "receber" | "pagar",
    pago: boolean,
  ): Promise<ResultadoLiquidacao> {
    const resultado: ResultadoLiquidacao = {
      liquidadas: [],
      ignoradas: [],
      falhas: [],
      valor: 0,
    };

    for (const op of operacoes) {
      try {
        const efeito = await liquidarUma(op, tipo, pago);
        if (efeito === "ignorada") {
          resultado.ignoradas.push(op);
          continue;
        }
        resultado.liquidadas.push(op);
        resultado.valor += tipo === "receber" ? op.receber : op.pagar;
        await AuditoriaService.registrar(
          tabela(op),
          pago ? "liquidou" : "estornou",
          op.refId,
          {
            codigo: op.codigo,
            operacao: op.tipo,
            tipo,
            valor: tipo === "receber" ? op.receber : op.pagar,
            em: new Date().toISOString(),
          },
        );
      } catch (e) {
        resultado.falhas.push({ operacao: op, motivo: (e as Error).message });
      }
    }

    return resultado;
  },
};
