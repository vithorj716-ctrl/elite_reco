import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Contas importadas do sistema antigo: na primeira tentativa de login (qualquer senha)
// a pessoa define uma senha nova. Depois disso a marcação é apagada.
function cfg() {
  const url = (process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"] ?? "").replace(/\/$/, "");
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["BANCO_SERVICE_ROLE_KEY"] ?? "";
  if (!url || !key) throw new Error("Configuração do servidor ausente.");
  return { url, h: { apikey: key, "Content-Type": "application/json" } as Record<string, string> };
}

async function buscar(email: string): Promise<string | null> {
  const { url, h } = cfg();
  const r = await fetch(
    `${url}/rest/v1/senha_pendente?select=user_id&email=eq.${encodeURIComponent(email)}`,
    { headers: h },
  );
  if (!r.ok) return null;
  const rows = (await r.json()) as { user_id: string }[];
  return rows[0]?.user_id ?? null;
}

const Email = z.string().trim().toLowerCase().email().max(255);

export const verificarSenhaPendente = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: Email }).parse(d))
  .handler(async ({ data }) => ({ pendente: !!(await buscar(data.email)) }));

export const definirSenhaPendente = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: Email, senha: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data }) => {
    const id = await buscar(data.email);
    if (!id) return { ok: false, erro: "Esta conta já tem senha definida." };
    const { url, h } = cfg();
    const r = await fetch(`${url}/auth/v1/admin/users/${id}`, {
      method: "PUT",
      headers: h,
      body: JSON.stringify({ password: data.senha }),
    });
    if (!r.ok) return { ok: false, erro: "Não foi possível salvar a senha." };
    await fetch(`${url}/rest/v1/senha_pendente?email=eq.${encodeURIComponent(data.email)}`, {
      method: "DELETE",
      headers: h,
    });
    return { ok: true };
  });
