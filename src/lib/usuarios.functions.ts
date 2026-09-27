/**
 * Operações privilegiadas de acesso (criar/remover contas).
 * Roda no servidor porque exige a chave administrativa.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ADMIN_EMAIL = "admin@elite.com.br";
const ADMIN_SENHA = "10203040";

const esquemaNovo = z.object({
  nome: z.string().min(2),
  email: z.string().email(),
  senha: z.string().min(6),
  papel: z.enum(["super_admin", "operador", "cliente", "agente"]),
  locadoraId: z.string().uuid().nullable().optional(),
  agenteId: z.string().uuid().nullable().optional(),
});

/** Garante que a conta mestre exista. Idempotente e seguro de chamar sempre. */
export const garantirAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existente } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", ADMIN_EMAIL)
    .maybeSingle();
  if (existente) return { criado: false };

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_SENHA,
    email_confirm: true,
    user_metadata: { nome: "Administrador" },
  });
  if (error || !data.user) {
    // conta já existe no autenticador: apenas garante perfil e papel
    const { data: lista } = await supabaseAdmin.auth.admin.listUsers();
    const achado = lista?.users.find((u) => u.email === ADMIN_EMAIL);
    if (!achado) throw new Error(error?.message ?? "Não foi possível criar a conta mestre.");
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: achado.id, nome: "Administrador", email: ADMIN_EMAIL });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: achado.id, role: "super_admin" }, { onConflict: "user_id,role" });
    return { criado: false };
  }

  await supabaseAdmin
    .from("profiles")
    .upsert({ id: data.user.id, nome: "Administrador", email: ADMIN_EMAIL });
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: data.user.id, role: "super_admin" }, { onConflict: "user_id,role" });
  return { criado: true };
});

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => esquemaNovo.parse(input))
  .handler(async ({ data, context }) => {
    const { data: permitido } = await context.supabase.rpc("equipe", { _user_id: context.userId });
    if (!permitido) throw new Error("Sem permissão para criar acessos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const criado = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (criado.error || !criado.data.user) {
      throw new Error(criado.error?.message ?? "Não foi possível criar o acesso.");
    }

    const id = criado.data.user.id;
    const perfil = await supabaseAdmin.from("profiles").upsert({
      id,
      nome: data.nome,
      email: data.email.toLowerCase(),
      locadora_id: data.papel === "cliente" ? (data.locadoraId ?? null) : null,
      agente_id: data.papel === "agente" ? (data.agenteId ?? null) : null,
    });
    if (perfil.error) throw new Error(perfil.error.message);

    const papel = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: id, role: data.papel }, { onConflict: "user_id,role" });
    if (papel.error) throw new Error(papel.error.message);

    return { id };
  });

/**
 * Define uma nova senha para uma conta. A senha atual nunca é legível
 * (fica só o resumo criptográfico no autenticador), então recuperar acesso
 * significa gravar uma nova senha e entregá-la à pessoa.
 */
export const redefinirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), senha: z.string().min(6).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!admin) throw new Error("Somente o administrador pode redefinir senhas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.senha,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!admin) throw new Error("Somente o administrador pode remover acessos.");
    if (data.id === context.userId) throw new Error("Não é possível remover a própria conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
