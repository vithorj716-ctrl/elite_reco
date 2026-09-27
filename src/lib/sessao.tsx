import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProvedorDados } from "@/providers/dados";
import type { Papel, Usuario } from "@/domain/types";

interface Sessao {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>;
  sair: () => Promise<void>;
}

const Ctx = createContext<Sessao | null>(null);

async function carregarUsuario(id: string, emailPadrao: string): Promise<Usuario | null> {
  const [perfil, papel] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle(),
  ]);
  if (!perfil.data) return null;
  return {
    id,
    nome: perfil.data.nome || emailPadrao,
    email: perfil.data.email || emailPadrao,
    papel: (papel.data?.role ?? "operador") as Papel,
    locadoraId: perfil.data.locadora_id ?? undefined,
    agenteId: perfil.data.agente_id ?? undefined,
  };
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let vivo = true;

    const aplicar = async (id: string | null, email: string) => {
      if (!id) {
        if (vivo) setUsuario(null);
        return;
      }
      const u = await carregarUsuario(id, email);
      if (vivo) setUsuario(u);
    };

    void supabase.auth.getSession().then(async ({ data }) => {
      await aplicar(data.session?.user.id ?? null, data.session?.user.email ?? "");
      if (vivo) setCarregando(false);
    });

    const { data: inscricao } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento !== "SIGNED_IN" && evento !== "SIGNED_OUT" && evento !== "USER_UPDATED") return;
      void aplicar(sessao?.user.id ?? null, sessao?.user.email ?? "");
      if (evento === "SIGNED_OUT") queryClient.clear();
    });

    return () => {
      vivo = false;
      inscricao.subscription.unsubscribe();
    };
  }, [queryClient]);

  const entrar = useCallback(async (email: string, senha: string) => {
    const { garantirAdmin } = await import("@/lib/usuarios.functions");
    try {
      await garantirAdmin();
    } catch {
      /* a conta mestre já existe ou o servidor cuidará disso depois */
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha,
    });
    if (error || !data.user) return { ok: false, erro: "E-mail ou senha inválidos." };
    const u = await carregarUsuario(data.user.id, data.user.email ?? email);
    setUsuario(u);
    return { ok: true };
  }, []);

  const sair = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setUsuario(null);
  }, [queryClient]);

  const valor = useMemo(
    () => ({ usuario, carregando, entrar, sair }),
    [usuario, carregando, entrar, sair],
  );

  return (
    <Ctx.Provider value={valor}>
      <ProvedorDados ativo={!!usuario}>{children}</ProvedorDados>
    </Ctx.Provider>
  );
}

export function useSessao() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSessao precisa estar dentro de ProvedorSessao");
  return ctx;
}

export { useBanco, useDados, useFotosDaOrdem, useSincronizar } from "@/providers/dados";
export type { EntidadeSincronizavel } from "@/providers/dados";
