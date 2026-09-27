import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";
import { AuditoriaService, responsavelAtual } from "@/services/auditoria.service";

/** Termo padrão do recibo — editável pelo administrador em Configurações. */
export const TERMO_PADRAO_RECIBO =
  "Declaro que recebi nesta data o valor acima descrito referente aos serviços prestados de forma autônoma, sem exclusividade, assumindo inteira responsabilidade pelos tributos, encargos e demais obrigações legais decorrentes da atividade exercida, não existindo vínculo empregatício entre as partes.";

export const CHAVES = {
  termoRecibo: "recibo_termo",
  qrRecibo: "recibo_qrcode",
  assinaturaRecibo: "recibo_assinatura",
  horarioEspecialInicio: "horario_especial_inicio",
  adicionalCobrancaHorario: "horario_especial_adicional_cobranca",
  adicionalPagamentoHorario: "horario_especial_adicional_pagamento",
} as const;

/** Padrões do horário especial — nunca fixos no código da regra. */
export const PADRAO_HORARIO_ESPECIAL = "17:00";

export const ConfiguracoesService = {
  ler(configuracoes: Record<string, string>, chave: string, padrao = "") {
    return configuracoes[chave] ?? padrao;
  },

  async definir(chave: string, valor: string) {
    const { id } = await responsavelAtual();
    const { error } = await supabase
      .from("configuracoes")
      .upsert({ chave, valor, atualizado_por: id }, { onConflict: "chave" });
    conferirErro(error);
    await AuditoriaService.registrar("configuracoes", "alterou", chave, { chave });
  },
};
