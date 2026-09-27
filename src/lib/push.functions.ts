/**
 * Ponte cliente → servidor do push.
 *
 * O envio de verdade acontece no gatilho do banco (ver
 * `src/routes/api/public/push/despachar.ts`). Aqui ficam apenas a chave pública
 * VAPID, usada na inscrição do aparelho, e um despacho manual da fila para
 * diagnóstico da central.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Chave pública VAPID — pública por definição, usada pelo navegador na inscrição. */
export const chavePublicaPush = createServerFn({ method: "GET" }).handler(async () => {
  return { chave: process.env["VAPID_PUBLIC_KEY"] ?? "" };
});

/**
 * Reenvia a fila pendente (rede caiu, aparelho reinscrito etc.).
 * Exclusivo da central: cada aviso continua indo apenas ao seu destinatário,
 * mas o reprocessamento da fila inteira não é ação de agente ou locadora.
 */
export const despacharPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: daEquipe } = await context.supabase.rpc("equipe", { _user_id: context.userId });
    if (!daEquipe) throw new Error("Apenas a central pode reprocessar a fila de avisos.");
    const { despacharAvisos } = await import("@/lib/push.server");
    return despacharAvisos();
  });
