import { supabase } from "@/integrations/supabase/client";

/**
 * Trilha de auditoria: quem criou, alterou ou excluiu, com data e hora.
 * Nunca lança erro para a tela — auditoria falha em silêncio, jamais bloqueia
 * uma operação financeira já concluída.
 */
export const AuditoriaService = {
  async registrar(
    entidade: string,
    acao: "criou" | "alterou" | "excluiu" | "duplicou" | "liquidou" | "estornou",
    registroId: string | null,
    dados: Record<string, unknown> = {},
  ) {
    try {
      const { data } = await supabase.auth.getUser();
      const id = data.user?.id ?? null;
      let nome = data.user?.email ?? "sistema";
      if (id) {
        const perfil = await supabase.from("profiles").select("nome").eq("id", id).maybeSingle();
        if (perfil.data?.nome) nome = perfil.data.nome;
      }
      await supabase.from("auditoria").insert({
        entidade,
        acao,
        registro_id: registroId,
        quem: id,
        quem_nome: nome,
        dados: dados as never,
      });
    } catch {
      /* auditoria nunca interrompe a operação */
    }
  },
};

/** Identificação do responsável logado, usada nos lançamentos financeiros. */
export async function responsavelAtual(): Promise<{ id: string | null; nome: string }> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id ?? null;
  if (!id) return { id: null, nome: "sistema" };
  const perfil = await supabase.from("profiles").select("nome, email").eq("id", id).maybeSingle();
  return { id, nome: perfil.data?.nome || perfil.data?.email || data.user?.email || "operador" };
}
