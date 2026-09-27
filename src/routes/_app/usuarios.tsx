import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Botao, Pagina, Vazio, suave } from "@/components/app/ui";
import { CampoSenha } from "@/components/app/campo-senha";
import { useConfirmacao } from "@/components/app/confirmar";
import { AcessoConta } from "@/components/negocio/acesso-conta";

import { criarUsuario, removerUsuario } from "@/lib/usuarios.functions";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import type { Papel } from "@/domain/types";

export const Route = createFileRoute("/_app/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários do sistema — Recolhe" },
      { name: "description", content: "Criação de acessos para operadores, locadoras e agentes de campo." },
      { property: "og:title", content: "Usuários do sistema — Recolhe" },
      { property: "og:description", content: "Gestão de acessos e permissões da operação." },
    ],
  }),
  component: Usuarios,
});

const ROTULO_PAPEL: Record<Papel, string> = {
  super_admin: "Super administrador",
  operador: "Operador",
  cliente: "Locadora",
  agente: "Agente de campo",
};

const branco = {
  nome: "",
  email: "",
  senha: "",
  papel: "operador" as Papel,
  locadoraId: "",
  agenteId: "",
};

function Usuarios() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const ehAdmin = usuario?.papel === "super_admin";
  const [form, setForm] = useState(branco);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { pedir, dialogo } = useConfirmacao();

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim() || form.senha.length < 6) {
      toast.error("Preencha nome, e-mail e uma senha com ao menos 6 caracteres.");
      return;
    }
    if (banco.usuarios.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      toast.error("Já existe um usuário com esse e-mail.");
      return;
    }
    if (form.papel === "cliente" && !form.locadoraId) {
      toast.error("Selecione a locadora vinculada.");
      return;
    }
    if (form.papel === "agente" && !form.agenteId) {
      toast.error("Selecione o agente vinculado.");
      return;
    }
    setSalvando(true);
    try {
      await criarUsuario({
        data: {
          nome: form.nome.trim(),
          email: form.email.trim().toLowerCase(),
          senha: form.senha,
          papel: form.papel,
          locadoraId: form.papel === "cliente" ? form.locadoraId : null,
          agenteId: form.papel === "agente" ? form.agenteId : null,
        },
      });
      await sincronizar(["profiles", "user_roles"]);
      setForm(branco);
      setAberto(false);
      toast.success("Acesso criado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string, nome: string) {
    // Exclusão de acesso é irreversível: sempre confirmada
    const ok = await pedir({
      titulo: `Remover o acesso de ${nome}?`,
      texto: "A pessoa perde o login imediatamente. O histórico de ações continua registrado.",
      confirmar: "Remover acesso",
    });
    if (!ok) return;
    try {
      await removerUsuario({ data: { id } });
      await sincronizar(["profiles", "user_roles"]);
      toast.success("Acesso removido.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const outros = banco.usuarios.filter((u) => u.id !== usuario?.id);

  return (
    <Pagina
      titulo="Usuários"
      descricao="Acessos da central, das locadoras clientes e dos agentes de campo."
      acoes={
        <Botao variante={aberto ? "linha" : "solido"} onClick={() => setAberto((v) => !v)}>
          <Plus className="size-4" /> {aberto ? "Fechar" : "Novo acesso"}
        </Botao>
      }
    >
      {aberto && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={suave}
          className="mb-6 overflow-hidden border border-border bg-surface"
        >
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            <label className="bg-surface px-4 py-3">
              <span className="label-caps">Nome</span>
              <input
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] outline-none focus:border-primary"
              />
            </label>
            <label className="bg-surface px-4 py-3">
              <span className="label-caps">E-mail</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] outline-none focus:border-primary"
              />
            </label>
            <label className="bg-surface px-4 py-3">
              <span className="label-caps">Senha provisória</span>
              <CampoSenha
                value={form.senha}
                onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                className="mt-1.5 border-b border-border bg-transparent pb-1 text-[13px] outline-none focus:border-primary"
              />

            </label>
            <label className="bg-surface px-4 py-3">
              <span className="label-caps">Perfil</span>
              <select
                value={form.papel}
                onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value as Papel }))}
                className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] outline-none focus:border-primary"
              >
                {(Object.keys(ROTULO_PAPEL) as Papel[]).map((p) => (
                  <option key={p} value={p} className="bg-surface">
                    {ROTULO_PAPEL[p]}
                  </option>
                ))}
              </select>
            </label>

            {form.papel === "cliente" && (
              <label className="bg-surface px-4 py-3">
                <span className="label-caps">Locadora vinculada</span>
                <select
                  value={form.locadoraId}
                  onChange={(e) => setForm((f) => ({ ...f, locadoraId: e.target.value }))}
                  className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] outline-none focus:border-primary"
                >
                  <option value="" className="bg-surface">Selecione…</option>
                  {banco.locadoras.map((l) => (
                    <option key={l.id} value={l.id} className="bg-surface">{l.nome}</option>
                  ))}
                </select>
              </label>
            )}

            {form.papel === "agente" && (
              <label className="bg-surface px-4 py-3">
                <span className="label-caps">Agente vinculado</span>
                <select
                  value={form.agenteId}
                  onChange={(e) => setForm((f) => ({ ...f, agenteId: e.target.value }))}
                  className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] outline-none focus:border-primary"
                >
                  <option value="" className="bg-surface">Selecione…</option>
                  {banco.agentes.map((a) => (
                    <option key={a.id} value={a.id} className="bg-surface">{a.nome}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="flex justify-end border-t border-border px-4 py-3">
            <Botao onClick={salvar}>Criar acesso</Botao>
          </div>
        </motion.div>
      )}

      {outros.length === 0 ? (
        <Vazio
          titulo="Só existe a conta mestre"
          texto="Crie acessos para os operadores da central, para as locadoras clientes e para os agentes de campo."
        />
      ) : (
        <div className="border border-border">
          <div className="hidden grid-cols-[1.4fr_1.6fr_1fr_1.2fr_auto] gap-4 border-b border-border bg-surface px-4 py-2.5 md:grid">
            {["Nome", "E-mail", "Perfil", "Vínculo", ""].map((c) => (
              <span key={c} className="label-caps">{c}</span>
            ))}
          </div>
          <ul className="divide-y divide-border">
            {outros.map((u, i) => {
              const vinculo =
                banco.locadoras.find((l) => l.id === u.locadoraId)?.nome ??
                banco.agentes.find((a) => a.id === u.agenteId)?.nome ??
                "Central";
              return (
                <motion.li
                  key={u.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...suave, delay: i * 0.035 }}
                  className="grid gap-1 px-4 py-3 text-[13px] transition-colors hover:bg-surface-raised md:grid-cols-[1.4fr_1.6fr_1fr_1.2fr_auto] md:items-center md:gap-4"
                >
                  <span className="text-foreground">{u.nome}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">{u.email}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                    {ROTULO_PAPEL[u.papel]}
                  </span>
                  <span className="text-muted-foreground">{vinculo}</span>
                  <div className="flex items-center gap-3 justify-self-start md:justify-self-end">
                    {ehAdmin && <AcessoConta id={u.id} nome={u.nome} email={u.email} />}
                    <button
                      onClick={() => void remover(u.id, u.nome)}
                      aria-label={`Remover ${u.nome}`}
                      className="press text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
      {dialogo}
    </Pagina>
  );
}
