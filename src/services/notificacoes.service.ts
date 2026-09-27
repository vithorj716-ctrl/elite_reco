/**
 * Notificações do usuário conectado.
 * O banco cria os avisos por gatilho; aqui só lemos/atualizamos o estado.
 */
import { conferirErro } from "@/data/erros";
import { supabase } from "@/integrations/supabase/client";

export const NotificacoesService = {
  async marcarLida(id: string) {
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true, lida_em: new Date().toISOString() })
      .eq("id", id);
    conferirErro(error, "banco");
  },

  async marcarTodasLidas(ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true, lida_em: new Date().toISOString() })
      .in("id", ids);
    conferirErro(error, "banco");
  },

  async excluir(id: string) {
    const { error } = await supabase.from("notificacoes").delete().eq("id", id);
    conferirErro(error, "banco");
  },

  async limparLidas(usuarioId: string) {
    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .eq("usuario_id", usuarioId)
      .eq("lida", true);
    conferirErro(error, "banco");
  },
};
