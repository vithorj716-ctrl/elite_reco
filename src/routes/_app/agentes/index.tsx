import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, UserRound } from "lucide-react";
import { Botao, Metrica, Modal, Pagina, Vazio, suave } from "@/components/app/ui";
import { AreaTexto, BlocoCampos, Entrada, Grade, Selecao } from "@/components/negocio/formulario";
import { avisarErros, limparErro } from "@/lib/validacao";
import { CardAgente } from "@/components/negocio/card-agente";
import { SeletorFotoAgente } from "@/components/negocio/foto-agente";
import {
  AGENTE_EM_BRANCO,
  AgentesService,
  FotoAgenteService,
  type DadosAgente,
} from "@/services/agentes.service";
import {
  consultarCep,
  formatarCep,
  formatarCpf,
  formatarTelefone,
  soDigitos,
} from "@/lib/brasilapi";
import { dinheiro, saldoAgente } from "@/domain/services/financeiro";
import { varLista } from "@/lib/animacao";
import { useBanco, useSincronizar } from "@/lib/sessao";
import type { Agente, SituacaoAgente } from "@/domain/types";

export const Route = createFileRoute("/_app/agentes/")({
  head: () => ({
    meta: [
      { title: "Agentes de campo — Recolhe" },
      {
        name: "description",
        content: "Ficha profissional dos agentes de recolhimento, disponibilidade e saldo a pagar.",
      },
      { property: "og:title", content: "Agentes de campo — Recolhe" },
      {
        property: "og:description",
        content: "Cadastro completo e produtividade da equipe de campo.",
      },
    ],
  }),
  component: Agentes,
});

const SITUACOES = [
  { valor: "ativo", rotulo: "Ativo" },
  { valor: "inativo", rotulo: "Inativo" },
  { valor: "bloqueado", rotulo: "Bloqueado" },
];

function Agentes() {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const [form, setForm] = useState<DadosAgente>(AGENTE_EM_BRANCO);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | SituacaoAgente>("todos");
  const ultimoCep = useRef("");
  const [foto, setFoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [emEdicao, setEmEdicao] = useState<Agente | null>(null);

  const alterar = <K extends keyof DadosAgente>(campo: K, valor: DadosAgente[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  /** Endereço preenchido automaticamente pelo CEP. */
  useEffect(() => {
    const limpo = soDigitos(form.cep);
    if (!aberto || limpo.length !== 8 || ultimoCep.current === limpo) return;
    ultimoCep.current = limpo;
    let vivo = true;
    consultarCep(limpo)
      .then((d) => {
        if (!vivo) return;
        setForm((f) => ({ ...f, rua: d.rua, bairro: d.bairro, cidade: d.cidade, uf: d.uf }));
        toast.success("Endereço preenchido pelo CEP.");
      })
      .catch((e: Error) => vivo && toast.error(e.message));
    return () => {
      vivo = false;
    };
  }, [form.cep, aberto]);

  async function salvar() {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e["nome"] = "Nome completo: campo obrigatório.";
    if (!foto) e["foto"] = "Foto do agente: obrigatória para concluir o cadastro.";
    setErros(e);
    if (!avisarErros(e) || !foto) return;
    setSalvando(true);
    try {
      const criado = await AgentesService.criar(form);
      await FotoAgenteService.enviar(criado.id, foto.blob);
      await sincronizar("agentes");
      URL.revokeObjectURL(foto.url);
      setFoto(null);
      setForm(AGENTE_EM_BRANCO);
      ultimoCep.current = "";
      setAberto(false);
      toast.success("Agente cadastrado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const resumos = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof saldoAgente>>();
    for (const a of banco.agentes) mapa.set(a.id, saldoAgente(banco, a.id));
    return mapa;
  }, [banco]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return banco.agentes
      .filter((a) => (filtro === "todos" ? true : a.situacao === filtro))
      .filter((a) =>
        t
          ? [a.nome, a.cpf, a.cidade, a.regiao, a.motoPlaca].join(" ").toLowerCase().includes(t)
          : true,
      );
  }, [banco.agentes, busca, filtro]);

  const totalPendente = banco.agentes.reduce((s, a) => s + (resumos.get(a.id)?.pendente ?? 0), 0);
  const emCampo = banco.agentes.filter((a) => (resumos.get(a.id)?.abertas ?? 0) > 0).length;

  return (
    <Pagina
      titulo="Agentes"
      descricao="Ficha profissional, documentação e saldo de cada agente de campo."
      acoes={
        <>
          <label className="flex min-h-9 w-full items-center gap-2 border border-border bg-surface px-3 py-1.5 transition-colors focus-within:border-primary sm:w-auto">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="buscar por nome, CPF, placa"
              className="w-full min-w-0 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground/60 sm:w-52"
            />
          </label>
          <Botao variante={aberto ? "linha" : "solido"} onClick={() => setAberto((v) => !v)}>
            <Plus className="size-4" /> {aberto ? "Fechar" : "Novo agente"}
          </Botao>
        </>
      }
    >
      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="Agentes" valor={banco.agentes.length} nota="fichas cadastradas" destaque />
        <Metrica
          rotulo="Ativos"
          valor={banco.agentes.filter((a) => a.situacao === "ativo").length}
          nota="aptos a receber ordens"
        />
        <Metrica rotulo="Em campo" valor={emCampo} nota="com ordem em execução" />
        <Metrica
          rotulo="Saldo a pagar"
          valor={dinheiro(totalPendente)}
          nota="calculado automaticamente"
        />
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
                titulo="Foto do agente"
                descricao="obrigatória para concluir o cadastro"
              >
                <div
                  {...(erros["foto"] ? { "data-campo-invalido": "1" } : {})}
                  className={
                    erros["foto"] ? "ring-1 ring-inset ring-destructive/60 bg-destructive/10" : ""
                  }
                >
                  <SeletorFotoAgente
                    foto={foto?.url}
                    nome={form.nome}
                    aoConfirmar={(blob) => {
                      if (foto) URL.revokeObjectURL(foto.url);
                      setFoto({ blob, url: URL.createObjectURL(blob) });
                      setErros(limparErro("foto"));
                    }}
                  />
                  {erros["foto"] && (
                    <p className="px-4 pb-3 text-[11px] font-medium text-destructive">
                      {erros["foto"]}
                    </p>
                  )}
                </div>
              </BlocoCampos>

              <BlocoCampos titulo="Dados pessoais">
                <Grade colunas={4}>
                  <Entrada
                    rotulo="Nome completo"
                    value={form.nome}
                    {...(erros["nome"] ? { erro: erros["nome"] } : {})}
                    onChange={(e) => {
                      alterar("nome", e.target.value);
                      setErros(limparErro("nome"));
                    }}
                  />
                  <Entrada
                    rotulo="CPF"
                    value={form.cpf}
                    inputMode="numeric"
                    onChange={(e) => alterar("cpf", formatarCpf(e.target.value))}
                  />
                  <Entrada
                    rotulo="RG"
                    value={form.rg}
                    onChange={(e) => alterar("rg", e.target.value)}
                  />
                  <Entrada
                    rotulo="Data de nascimento"
                    type="date"
                    value={form.nascimento}
                    onChange={(e) => alterar("nascimento", e.target.value)}
                  />
                  <Selecao
                    rotulo="Sexo"
                    value={form.sexo}
                    opcoes={[
                      { valor: "", rotulo: "—" },
                      { valor: "masculino", rotulo: "Masculino" },
                      { valor: "feminino", rotulo: "Feminino" },
                      { valor: "outro", rotulo: "Outro" },
                    ]}
                    onChange={(e) => alterar("sexo", e.target.value)}
                  />
                  <Selecao
                    rotulo="Estado civil"
                    value={form.estadoCivil}
                    opcoes={[
                      { valor: "", rotulo: "—" },
                      { valor: "solteiro", rotulo: "Solteiro(a)" },
                      { valor: "casado", rotulo: "Casado(a)" },
                      { valor: "divorciado", rotulo: "Divorciado(a)" },
                      { valor: "viuvo", rotulo: "Viúvo(a)" },
                    ]}
                    onChange={(e) => alterar("estadoCivil", e.target.value)}
                  />
                  <Entrada
                    rotulo="Telefone"
                    value={form.telefone}
                    onChange={(e) => alterar("telefone", formatarTelefone(e.target.value))}
                  />
                  <Entrada
                    rotulo="WhatsApp"
                    value={form.whatsapp}
                    onChange={(e) => alterar("whatsapp", formatarTelefone(e.target.value))}
                  />
                  <Entrada
                    rotulo="E-mail"
                    type="email"
                    value={form.email}
                    onChange={(e) => alterar("email", e.target.value)}
                  />
                </Grade>
              </BlocoCampos>

              <BlocoCampos
                titulo="Endereço"
                descricao="informe o CEP para preencher automaticamente"
              >
                <Grade colunas={4}>
                  <Entrada
                    rotulo="CEP"
                    value={form.cep}
                    inputMode="numeric"
                    onChange={(e) => alterar("cep", formatarCep(e.target.value))}
                  />
                  <Entrada
                    rotulo="Rua"
                    value={form.rua}
                    onChange={(e) => alterar("rua", e.target.value)}
                  />
                  <Entrada
                    rotulo="Número"
                    value={form.numero}
                    onChange={(e) => alterar("numero", e.target.value)}
                  />
                  <Entrada
                    rotulo="Bairro"
                    value={form.bairro}
                    onChange={(e) => alterar("bairro", e.target.value)}
                  />
                  <Entrada
                    rotulo="Cidade"
                    value={form.cidade}
                    onChange={(e) => alterar("cidade", e.target.value)}
                  />
                  <Entrada
                    rotulo="Estado"
                    value={form.uf}
                    onChange={(e) => alterar("uf", e.target.value.toUpperCase())}
                  />
                </Grade>
              </BlocoCampos>

              <BlocoCampos titulo="Documentação e habilitação">
                <Grade colunas={4}>
                  <Entrada
                    rotulo="CNH"
                    value={form.cnh}
                    onChange={(e) => alterar("cnh", e.target.value)}
                  />
                  <Selecao
                    rotulo="Categoria"
                    value={form.cnhCategoria}
                    opcoes={["A", "B", "AB", "AC", "AD", "AE"].map((c) => ({
                      valor: c,
                      rotulo: c,
                    }))}
                    onChange={(e) => alterar("cnhCategoria", e.target.value)}
                  />
                  <Entrada
                    rotulo="Validade da CNH"
                    type="date"
                    value={form.cnhValidade}
                    onChange={(e) => alterar("cnhValidade", e.target.value)}
                  />
                  <Entrada
                    rotulo="Data de contratação"
                    type="date"
                    value={form.contratadoEm}
                    onChange={(e) => alterar("contratadoEm", e.target.value)}
                  />
                </Grade>
              </BlocoCampos>

              <BlocoCampos
                titulo="Operação e veículo"
                descricao="arquivos podem ser anexados na ficha do agente"
              >
                <Grade colunas={4}>
                  <Selecao
                    rotulo="Situação"
                    value={form.situacao}
                    opcoes={SITUACOES}
                    onChange={(e) => alterar("situacao", e.target.value as SituacaoAgente)}
                  />
                  <Entrada
                    rotulo="Região de atuação"
                    value={form.regiao}
                    onChange={(e) => alterar("regiao", e.target.value)}
                  />
                  <Entrada
                    rotulo="Cidades atendidas"
                    value={form.cidadesAtendidas.join(", ")}
                    dica="separe por vírgula"
                    onChange={(e) =>
                      alterar(
                        "cidadesAtendidas",
                        e.target.value
                          .split(",")
                          .map((c) => c.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                  <Entrada
                    rotulo="Placa da moto"
                    value={form.motoPlaca}
                    onChange={(e) => alterar("motoPlaca", e.target.value.toUpperCase())}
                  />
                  <Entrada
                    rotulo="Modelo"
                    value={form.motoModelo}
                    onChange={(e) => alterar("motoModelo", e.target.value)}
                  />
                  <Entrada
                    rotulo="Ano"
                    value={form.motoAno}
                    onChange={(e) => alterar("motoAno", e.target.value)}
                  />
                  <Entrada
                    rotulo="Cor"
                    value={form.motoCor}
                    onChange={(e) => alterar("motoCor", e.target.value)}
                  />
                  <Entrada
                    rotulo="Renavam"
                    value={form.motoRenavam}
                    onChange={(e) => alterar("motoRenavam", e.target.value)}
                  />
                  <Entrada
                    rotulo="Seguro"
                    value={form.seguro}
                    onChange={(e) => alterar("seguro", e.target.value)}
                  />
                  <AreaTexto
                    rotulo="Observações"
                    value={form.observacoes}
                    areaClassName="sm:col-span-2 lg:col-span-3"
                    onChange={(e) => alterar("observacoes", e.target.value)}
                  />
                </Grade>
                <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
                  <Botao variante="fantasma" onClick={() => setAberto(false)}>
                    Cancelar
                  </Botao>
                  <Botao onClick={salvar} carregando={salvando}>
                    Salvar ficha
                  </Botao>
                </div>
              </BlocoCampos>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 flex gap-px bg-border">
        {(["todos", "ativo", "inativo", "bloqueado"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`press bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
              filtro === f ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-px">
        {lista.length === 0 ? (
          <Vazio
            icone={UserRound}
            titulo={
              busca || filtro !== "todos" ? "Nenhum agente encontrado" : "Nenhum agente cadastrado"
            }
            texto="Cadastre a equipe de campo para poder distribuir os recolhimentos."
          />
        ) : (
          <motion.ul
            variants={varLista()}
            initial="inicial"
            animate="animar"
            className="grid gap-px bg-border md:grid-cols-2 xl:grid-cols-3"
          >
            {lista.map((a) => {
              const s = resumos.get(a.id);
              return (
                <CardAgente
                  key={a.id}
                  agente={a}
                  resumo={{
                    abertas: s?.abertas ?? 0,
                    concluidas: s?.concluidas ?? 0,
                    pendente: s?.pendente ?? 0,
                    produzido: s?.produzido ?? 0,
                  }}
                  aoEditar={() => setEmEdicao(a)}
                />
              );
            })}
          </motion.ul>
        )}
      </div>

      <ModalEdicaoAgente agente={emEdicao} aoFechar={() => setEmEdicao(null)} />
    </Pagina>
  );
}

/**
 * Edição do agente já cadastrado: nome, telefone, cidade de atuação e situação.
 * Atualiza o mesmo registro — o id, as ordens vinculadas, o usuário de acesso e
 * o histórico já escrito continuam intactos.
 */
function ModalEdicaoAgente({ agente, aoFechar }: { agente: Agente | null; aoFechar: () => void }) {
  const sincronizar = useSincronizar();
  const [f, setF] = useState({ nome: "", telefone: "", cidade: "", situacao: "ativo" as SituacaoAgente });
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const idCarregado = useRef<string | null>(null);

  useEffect(() => {
    if (!agente || idCarregado.current === agente.id) return;
    idCarregado.current = agente.id;
    setF({
      nome: agente.nome,
      telefone: agente.telefone,
      cidade: agente.cidade,
      situacao: agente.situacao,
    });
    setErros({});
  }, [agente]);

  function fechar() {
    idCarregado.current = null;
    aoFechar();
  }

  async function salvar() {
    if (!agente) return;
    const e: Record<string, string> = {};
    if (!f.nome.trim()) e["nome"] = "Nome do agente: campo obrigatório.";
    setErros(e);
    if (!avisarErros(e)) return;
    setSalvando(true);
    try {
      await AgentesService.editarCadastro(agente.id, f);
      sincronizar("agentes");
      toast.success("Cadastro do agente atualizado.");
      fechar();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!agente}
      aoFechar={fechar}
      titulo="Editar agente"
      descricao={agente ? `Ficha de ${agente.nome} · o mesmo cadastro é atualizado` : ""}
      rodape={
        <div className="flex justify-end gap-2">
          <Botao variante="linha" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao variante="solido" carregando={salvando} onClick={() => void salvar()}>
            Salvar alterações
          </Botao>
        </div>
      }
    >
      <Grade colunas={2}>
        <Entrada
          rotulo="Nome"
          value={f.nome}
          {...(erros["nome"] ? { erro: erros["nome"] } : {})}
          onChange={(e) => {
            setF((s) => ({ ...s, nome: e.target.value }));
            setErros(limparErro("nome"));
          }}
        />
        <Entrada
          rotulo="Telefone"
          value={f.telefone}
          onChange={(e) => setF((s) => ({ ...s, telefone: formatarTelefone(e.target.value) }))}
        />
        <Entrada
          rotulo="Cidade de atuação"
          value={f.cidade}
          onChange={(e) => setF((s) => ({ ...s, cidade: e.target.value }))}
        />
        <Selecao
          rotulo="Situação"
          value={f.situacao}
          opcoes={SITUACOES}
          onChange={(e) => setF((s) => ({ ...s, situacao: e.target.value as SituacaoAgente }))}
        />
      </Grade>
      <p className="mt-3 text-[12px] text-muted-foreground">
        A ficha completa (documentos, moto, endereço e foto) fica na página do agente. Agentes com
        ordens no histórico nunca são apagados: use a situação Inativo ou Bloqueado.
      </p>
    </Modal>
  );
}
