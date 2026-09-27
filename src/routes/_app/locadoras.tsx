import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Building2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Botao, Metrica, Pagina, Vazio, suave } from "@/components/app/ui";
import { useConfirmacao } from "@/components/app/confirmar";
import { AcessoConta } from "@/components/negocio/acesso-conta";
import { avisarErros, limparErro } from "@/lib/validacao";
import { AreaTexto, BlocoCampos, Entrada, Grade, Leitura, Selecao } from "@/components/negocio/formulario";
import {
  LOCADORA_EM_BRANCO,
  LocadorasService,
  paraFormulario,
  type DadosLocadora,
} from "@/services/locadoras.service";
import { consultarCnpj, formatarCnpj, formatarTelefone, soDigitos } from "@/lib/brasilapi";
import { dinheiro } from "@/domain/services/financeiro";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import type { Locadora } from "@/domain/types";

export const Route = createFileRoute("/_app/locadoras")({
  head: () => ({
    meta: [
      { title: "Locadoras clientes — Recolhe" },
      { name: "description", content: "Cadastro inteligente de locadoras por CNPJ, com dados comerciais e volume de recolhimentos." },
      { property: "og:title", content: "Locadoras clientes — Recolhe" },
      { property: "og:description", content: "Gestão de contas clientes da operação de recolhimento." },
    ],
  }),
  component: Locadoras,
});

const FORMAS = [
  { valor: "boleto", rotulo: "Boleto" },
  { valor: "pix", rotulo: "PIX" },
  { valor: "ted", rotulo: "Transferência (TED)" },
  { valor: "faturado", rotulo: "Faturado mensal" },
];

function Locadoras() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { usuario } = useSessao();
  const { pedir, dialogo } = useConfirmacao();
  const podeExcluir = usuario?.papel === "super_admin";

  const [form, setForm] = useState<DadosLocadora>(LOCADORA_EM_BRANCO);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [consultado, setConsultado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");
  const ultimoCnpj = useRef("");

  const alterar = <K extends keyof DadosLocadora>(campo: K, valor: DadosLocadora[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  /** Contas de login vinculadas a uma locadora. */
  const contas = (locadoraId: string) => banco.usuarios.filter((u) => u.locadoraId === locadoraId);

  /** Consulta automática assim que o CNPJ fica completo. */
  useEffect(() => {
    const limpo = soDigitos(form.cnpj);
    if (!aberto || editando || limpo.length !== 14 || ultimoCnpj.current === limpo) return;
    ultimoCnpj.current = limpo;
    let vivo = true;
    setConsultando(true);
    consultarCnpj(limpo)
      .then((d) => {
        if (!vivo) return;
        setForm((f) => ({
          ...f,
          ...d,
          nome: d.nomeFantasia || d.razaoSocial,
          telefone: d.telefone || f.telefone,
          email: d.email || f.email,
        }));
        setConsultado(true);
        toast.success(`${d.razaoSocial || "Empresa"} encontrada na Receita Federal.`);
      })
      .catch((e: Error) => {
        if (!vivo) return;
        setConsultado(false);
        toast.error(e.message);
      })
      .finally(() => vivo && setConsultando(false));
    return () => {
      vivo = false;
    };
  }, [form.cnpj, aberto, editando]);

  function novo() {
    ultimoCnpj.current = "";
    setForm(LOCADORA_EM_BRANCO);
    setEditando(null);
    setConsultado(false);
    setAberto(true);
  }

  function editar(l: Locadora) {
    ultimoCnpj.current = soDigitos(l.cnpj);
    setForm(paraFormulario(l));
    setEditando(l.id);
    setConsultado(true);
    setAberto(true);
  }

  async function salvar() {
    const e: Record<string, string> = {};
    if (soDigitos(form.cnpj).length !== 14)
      e["cnpj"] = "CNPJ: informe os 14 dígitos para iniciar o cadastro.";
    if (!form.nome.trim() && !form.razaoSocial.trim())
      e["nome"] = "Nome de exibição: consulte o CNPJ ou preencha manualmente.";
    setErros(e);
    if (!avisarErros(e)) return;
    setSalvando(true);
    try {
      if (editando) await LocadorasService.atualizar(editando, form);
      else await LocadorasService.criar(form);
      await sincronizar("locadoras");
      setAberto(false);
      setEditando(null);
      setForm(LOCADORA_EM_BRANCO);
      toast.success(editando ? "Cadastro atualizado." : "Locadora cadastrada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(l: Locadora) {
    try {
      await LocadorasService.alternarAtiva(l.id, !l.ativa);
      await sincronizar("locadoras");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /** Exclusão definitiva — só faz sentido para contas sem histórico de ordens. */
  async function excluir(l: Locadora, ordens: number) {
    if (ordens > 0) {
      toast.error(
        `${l.nome} possui ${ordens} ordem(ns) no histórico. Marque como inativa em vez de excluir.`,
      );
      return;
    }
    const ok = await pedir({
      titulo: "Excluir esta locadora?",
      texto: `${l.nome} sairá definitivamente do cadastro.`,
    });
    if (!ok) return;
    try {
      await LocadorasService.remover(l.id);
      await sincronizar("locadoras");
      toast.success("Locadora excluída.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }


  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return banco.locadoras;
    return banco.locadoras.filter((l) =>
      [l.nome, l.razaoSocial, l.cnpj, l.cidade, l.responsavel].join(" ").toLowerCase().includes(t),
    );
  }, [banco.locadoras, busca]);

  const ativas = banco.locadoras.filter((l) => l.ativa).length;
  const credito = banco.locadoras.reduce((s, l) => s + l.limiteCredito, 0);

  return (
    <Pagina
      titulo="Locadoras"
      descricao="Cadastro inteligente: informe o CNPJ e o restante vem preenchido automaticamente."
      acoes={
        <>
          <label className="flex min-h-9 w-full items-center gap-2 border border-border bg-surface px-3 py-1.5 transition-colors focus-within:border-primary sm:w-auto">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="buscar por nome, CNPJ, cidade"
              className="w-full min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/60 sm:w-52"
            />
          </label>
          <Botao variante={aberto ? "linha" : "solido"} onClick={() => (aberto ? setAberto(false) : novo())}>
            <Plus className="size-4" /> {aberto ? "Fechar" : "Nova locadora"}
          </Botao>
        </>
      }
    >
      {dialogo}
      <div className="grid gap-px bg-border sm:grid-cols-3">

        <Metrica rotulo="Locadoras" valor={banco.locadoras.length} nota="contas cadastradas" destaque />
        <Metrica rotulo="Ativas" valor={ativas} nota="recebendo demandas" />
        <Metrica rotulo="Limite de crédito" valor={dinheiro(credito)} nota="somatório concedido" />
      </div>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={suave}
            className="mt-6 overflow-hidden"
          >
            <div className="grid gap-6">
              <BlocoCampos
                titulo="Identificação pela Receita Federal"
                descricao="digite o CNPJ e aguarde a consulta"
              >
                <Grade colunas={3}>
                  <Entrada
                    rotulo="CNPJ"
                    value={form.cnpj}
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    {...(erros["cnpj"] ? { erro: erros["cnpj"] } : {})}
                    onChange={(e) => {
                      alterar("cnpj", formatarCnpj(e.target.value));
                      setErros(limparErro("cnpj"));
                    }}
                  />
                  <div className="bg-surface px-4 py-3">
                    <span className="label-caps">Consulta</span>
                    <p className="mt-1.5 flex items-center gap-2 text-[13px]">
                      {consultando ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin text-primary" />
                          <span className="text-muted-foreground">consultando BrasilAPI…</span>
                        </>
                      ) : consultado ? (
                        <span className="text-success">dados preenchidos automaticamente</span>
                      ) : (
                        <span className="text-muted-foreground">aguardando 14 dígitos</span>
                      )}
                    </p>
                  </div>
                  <Leitura rotulo="Situação cadastral" valor={form.situacaoCadastral} />
                  <Leitura rotulo="Razão social" valor={form.razaoSocial} />
                  <Leitura rotulo="Nome fantasia" valor={form.nomeFantasia} />
                  <Leitura rotulo="Data de abertura" valor={form.dataAbertura} />
                  <Leitura rotulo="Natureza jurídica" valor={form.naturezaJuridica} />
                  <Leitura rotulo="CNAE" valor={form.cnae} />
                  <Entrada
                    rotulo="Nome de exibição"
                    value={form.nome}
                    {...(erros["nome"] ? { erro: erros["nome"] } : {})}
                    onChange={(e) => {
                      alterar("nome", e.target.value);
                      setErros(limparErro("nome"));
                    }}
                  />
                </Grade>
              </BlocoCampos>

              <BlocoCampos titulo="Endereço" descricao="preenchido pela consulta — ajuste se necessário">
                <Grade colunas={4}>
                  <Leitura rotulo="CEP" valor={form.cep} />
                  <Leitura rotulo="Estado" valor={form.uf} />
                  <Leitura rotulo="Cidade" valor={form.cidade} />
                  <Leitura rotulo="Bairro" valor={form.bairro} />
                  <Leitura rotulo="Rua" valor={form.rua} />
                  <Entrada rotulo="Número" value={form.numero} onChange={(e) => alterar("numero", e.target.value)} />
                  <Entrada
                    rotulo="Complemento"
                    value={form.complemento}
                    onChange={(e) => alterar("complemento", e.target.value)}
                  />
                  <Entrada
                    rotulo="Telefone da empresa"
                    value={form.telefone}
                    onChange={(e) => alterar("telefone", formatarTelefone(e.target.value))}
                  />
                </Grade>
              </BlocoCampos>

              <BlocoCampos titulo="Relacionamento comercial" descricao="informações internas da operação">
                <Grade colunas={4}>
                  <Entrada
                    rotulo="Responsável"
                    value={form.responsavel}
                    onChange={(e) => alterar("responsavel", e.target.value)}
                  />
                  <Entrada
                    rotulo="Telefone do responsável"
                    value={form.telefone}
                    onChange={(e) => alterar("telefone", formatarTelefone(e.target.value))}
                  />
                  <Entrada
                    rotulo="E-mail do responsável"
                    value={form.email}
                    type="email"
                    onChange={(e) => alterar("email", e.target.value)}
                  />
                  <Entrada
                    rotulo="Limite de crédito (R$)"
                    value={String(form.limiteCredito)}
                    inputMode="numeric"
                    onChange={(e) => alterar("limiteCredito", Number(soDigitos(e.target.value)) || 0)}
                  />
                  <Selecao
                    rotulo="Forma de pagamento"
                    value={form.formaPagamento}
                    opcoes={FORMAS}
                    onChange={(e) => alterar("formaPagamento", e.target.value)}
                  />
                  <Entrada
                    rotulo="Prazo de pagamento (dias)"
                    value={String(form.prazoPagamento)}
                    inputMode="numeric"
                    onChange={(e) => alterar("prazoPagamento", Number(soDigitos(e.target.value)) || 0)}
                  />
                  <Selecao
                    rotulo="Status"
                    value={form.ativa ? "sim" : "nao"}
                    opcoes={[
                      { valor: "sim", rotulo: "Ativa" },
                      { valor: "nao", rotulo: "Inativa" },
                    ]}
                    onChange={(e) => alterar("ativa", e.target.value === "sim")}
                  />
                  <AreaTexto
                    rotulo="Observações"
                    value={form.observacoes}
                    areaClassName="sm:col-span-2 lg:col-span-4"
                    onChange={(e) => alterar("observacoes", e.target.value)}
                  />
                </Grade>
                <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
                  <Botao variante="fantasma" onClick={() => setAberto(false)}>
                    Cancelar
                  </Botao>
                  <Botao onClick={salvar} carregando={salvando}>
                    {editando ? "Salvar alterações" : "Salvar cadastro"}
                  </Botao>
                </div>
              </BlocoCampos>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6">
        {lista.length === 0 ? (
          <Vazio
            icone={Building2}
            titulo={busca ? "Nenhum resultado" : "Nenhuma locadora"}
            texto={
              busca
                ? "Ajuste a busca para encontrar a conta desejada."
                : "Cadastre a primeira conta cliente informando apenas o CNPJ."
            }
          />
        ) : (
          <ul className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3">
            {lista.map((l, i) => {
              const total = banco.ordens.filter((o) => o.locadoraId === l.id).length;
              const abertas = banco.ordens.filter(
                (o) => o.locadoraId === l.id && o.status !== "concluida" && o.status !== "cancelada",
              ).length;
              return (
                <motion.li
                  key={l.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...suave, delay: Math.min(i * 0.04, 0.3) }}
                  className="group bg-surface p-5 transition-colors hover:bg-surface-raised"
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="mt-0.5 size-4 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-display text-[16px] uppercase tracking-[0.04em] text-foreground">
                        {l.nome}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">{l.cnpj || "sem CNPJ"}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => editar(l)}
                        aria-label={`Editar ${l.nome}`}
                        className="press text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      {podeExcluir && (
                        <button
                          onClick={() => void excluir(l, total)}
                          aria-label={`Excluir ${l.nome}`}
                          className="press text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => alternar(l)}
                        className={`press font-mono text-[10px] uppercase tracking-[0.14em] ${l.ativa ? "text-success" : "text-muted-foreground"}`}
                      >
                        {l.ativa ? "ativa" : "inativa"}
                      </button>
                    </div>

                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3">
                    <div>
                      <dt className="label-caps">Responsável</dt>
                      <dd className="truncate text-[13px]">{l.responsavel || "—"}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Praça</dt>
                      <dd className="truncate text-[13px]">
                        {l.cidade || "—"}
                        {l.uf && `/${l.uf}`}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-caps">Pagamento</dt>
                      <dd className="text-[13px]">
                        {l.formaPagamento || "—"}
                        {l.prazoPagamento ? ` · ${l.prazoPagamento}d` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-caps">Limite</dt>
                      <dd className="text-[13px]">{dinheiro(l.limiteCredito)}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Ordens totais</dt>
                      <dd className="font-display text-[18px] text-foreground">{total}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Em aberto</dt>
                      <dd className="font-display text-[18px] text-primary">{abertas}</dd>
                    </div>
                  </dl>
                  {podeExcluir && (
                    <div className="mt-3 border-t border-border pt-3">
                      <span className="label-caps">Acessos da locadora</span>
                      {contas(l.id).length === 0 ? (
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                          Nenhum usuário vinculado.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1.5">
                          {contas(l.id).map((u) => (
                            <li key={u.id} className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted-foreground">
                                {u.email}
                              </span>
                              <AcessoConta id={u.id} nome={u.nome} email={u.email} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </Pagina>
  );
}
