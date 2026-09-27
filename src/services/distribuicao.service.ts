/**
 * Distribuição automática de serviços.
 *
 * Nenhuma regra vive aqui: toda decisão (sorteio, snapshot de valor, troca de
 * agente, alteração de serviço) acontece no banco, em rotinas transacionais e
 * auditadas. Esta camada apenas solicita a ação e devolve o erro em português.
 */
import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";

export const DistribuicaoService = {
  /**
   * Definição do administrador: congela os valores na própria operação e só
   * então a libera para a fila dos agentes. Antes disso nenhum agente enxerga
   * ou aceita a operação.
   */
  async aprovar(
    distribuicaoId: string,
    valores: {
      cobrancaBase: number;
      cobrancaAdicional: number;
      pagamentoBase: number;
      pagamentoAdicional: number;
      motivo?: string;
    },
  ): Promise<void> {
    if (valores.cobrancaBase + valores.cobrancaAdicional <= 0) {
      throw new Error("Defina o valor da cobrança da locadora.");
    }
    if (valores.pagamentoBase + valores.pagamentoAdicional <= 0) {
      throw new Error("Defina o valor do repasse do agente.");
    }
    const { error } = await supabase.rpc("aprovar_distribuicao", {
      _dist: distribuicaoId,
      _cobranca_base: valores.cobrancaBase,
      _cobranca_adicional: valores.cobrancaAdicional,
      _pagamento_base: valores.pagamentoBase,
      _pagamento_adicional: valores.pagamentoAdicional,
      _motivo: (valores.motivo ?? "").trim(),
    });
    conferirErro(error);
  },

  /** Agente principal assume a operação. */
  async aceitar(distribuicaoId: string): Promise<void> {
    const { error } = await supabase.rpc("aceitar_distribuicao", { _dist: distribuicaoId });
    conferirErro(error);
  },

  /** Agente devolve a operação; o sistema sorteia outro elegível na hora. */
  async recusar(distribuicaoId: string, motivo: string): Promise<void> {
    if (!motivo.trim()) throw new Error("Informe o motivo da recusa.");
    const { error } = await supabase.rpc("recusar_distribuicao", {
      _dist: distribuicaoId,
      _motivo: motivo.trim(),
    });
    conferirErro(error);
  },

  /** Auxiliar recebe o mesmo repasse do principal, sempre vindo da tabela. */
  async definirAuxiliar(distribuicaoId: string, auxiliarId: string | null): Promise<void> {
    const { error } = await supabase.rpc("definir_auxiliar_distribuicao", {
      _dist: distribuicaoId,
      // O banco aceita nulo para desvincular o auxiliar.
      _auxiliar: auxiliarId as string,
    });
    conferirErro(error);
  },

  /** Central redistribui: sem agente informado, o sistema sorteia outro. */
  async redistribuir(distribuicaoId: string, agenteId: string | null, motivo: string) {
    const { error } = await supabase.rpc("admin_redistribuir", {
      _dist: distribuicaoId,
      // Sem agente informado o banco sorteia outro elegível.
      ...(agenteId ? { _agente: agenteId } : {}),
      _motivo: motivo.trim(),
    });
    conferirErro(error);
  },

  async alterarServico(distribuicaoId: string, servicoId: string, motivo: string): Promise<void> {
    if (!servicoId) throw new Error("Escolha o serviço.");
    if (!motivo.trim()) throw new Error("Informe o motivo da alteração.");
    const { error } = await supabase.rpc("admin_alterar_servico", {
      _dist: distribuicaoId,
      _servico: servicoId,
      _motivo: motivo.trim(),
    });
    conferirErro(error);
  },

  async alterarValor(
    distribuicaoId: string,
    cobranca: number,
    pagamento: number,
    motivo: string,
  ): Promise<void> {
    if (!motivo.trim()) throw new Error("Informe o motivo da alteração.");
    const { error } = await supabase.rpc("admin_alterar_valor", {
      _dist: distribuicaoId,
      _cobranca: cobranca,
      _pagamento: pagamento,
      _motivo: motivo.trim(),
    });
    conferirErro(error);
  },

  async cancelar(distribuicaoId: string, motivo: string): Promise<void> {
    if (!motivo.trim()) throw new Error("Informe o motivo do cancelamento.");
    const { error } = await supabase.rpc("admin_cancelar_distribuicao", {
      _dist: distribuicaoId,
      _motivo: motivo.trim(),
    });
    conferirErro(error);
  },

  async reenviarNotificacao(distribuicaoId: string): Promise<void> {
    const { error } = await supabase.rpc("reenviar_notificacao_distribuicao", {
      _dist: distribuicaoId,
    });
    conferirErro(error);
  },
};
