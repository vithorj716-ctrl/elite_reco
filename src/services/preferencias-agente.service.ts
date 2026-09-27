/**
 * Tipos de serviço que o agente aceita.
 *
 * O agente escolhe apenas SE aceita cada serviço — o valor vem sempre da
 * tabela de remuneração do administrador e é somente leitura aqui.
 */
import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";

export interface ServicoAceito {
  servicoId: string;
  codigo: string;
  nome: string;
  valor: number;
  aceita: boolean;
}

export const PreferenciasAgenteService = {
  async listar(): Promise<ServicoAceito[]> {
    const { data, error } = await supabase.rpc("servicos_do_agente");
    conferirErro(error);
    return ((data ?? []) as Array<{
      servico_id: string;
      codigo: string;
      nome: string;
      valor: number | string;
      aceita: boolean;
    }>).map((r) => ({
      servicoId: r.servico_id,
      codigo: r.codigo,
      nome: r.nome,
      valor: Number(r.valor ?? 0),
      aceita: r.aceita,
    }));
  },

  async definir(servicoId: string, aceita: boolean): Promise<void> {
    const { error } = await supabase.rpc("definir_servico_aceito", {
      _servico: servicoId,
      _aceita: aceita,
    });
    conferirErro(error);
  },
};
