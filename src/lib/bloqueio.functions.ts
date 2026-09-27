/**
 * Chave de bloqueio do sistema.
 * Roda no servidor porque a tela de acesso não possui sessão autenticada
 * e a tabela de configurações só aceita escrita da equipe.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const CHAVE_BLOQUEIO = "sistema_bloqueado";
const SENHA_PAINEL = "12345678";

/** Lê o estado atual da chave (público: só devolve um booleano). */
export const lerBloqueio = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("configuracoes")
    .select("valor")
    .eq("chave", CHAVE_BLOQUEIO)
    .maybeSingle();
  return { ligado: data?.valor === "1" };
});

/** Liga/desliga a chave. Exige a senha do painel restrito. */
export const definirBloqueio = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ senha: z.string(), ligado: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    if (data.senha !== SENHA_PAINEL) throw new Error("Senha incorreta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("configuracoes")
      .upsert({ chave: CHAVE_BLOQUEIO, valor: data.ligado ? "1" : "0" }, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    return { ligado: data.ligado };
  });
