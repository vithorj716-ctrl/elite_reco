/**
 * Endpoint interno de despacho de push.
 *
 * Quem chama é o próprio banco: um gatilho em `notificacoes` dispara um
 * `net.http_post` para cá assim que o aviso nasce. Por isso o envio funciona
 * mesmo sem ninguém com o sistema aberto.
 *
 * A rota é pública (fora do login do site), então cada chamada usa uma
 * autorização única, curta e descartável criada pelo próprio banco.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CorpoDespacho = z.object({
  notificacao_id: z.string().uuid(),
  token: z.string().uuid(),
});

export const Route = createFileRoute("/api/public/push/despachar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let corpo: z.infer<typeof CorpoDespacho>;
        try {
          corpo = CorpoDespacho.parse(await request.json());
        } catch {
          return new Response("requisicao invalida", { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: autorizado, error } = await supabaseAdmin.rpc("consumir_token_push", {
            _notificacao_id: corpo.notificacao_id,
            _token: corpo.token,
          });
          if (error || !autorizado) return new Response("nao autorizado", { status: 401 });

          const { despacharAvisos } = await import("@/lib/push.server");
          const resultado = await despacharAvisos(corpo.notificacao_id);
          return Response.json(resultado);
        } catch (erro) {
          console.error("Falha no despacho de push", erro);
          return Response.json({ erro: "falha no despacho de push" }, { status: 500 });
        }
      },
    },
  },
});
