import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Paperclip, Trash2, UserRound } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as GraficoDica,
  XAxis,
  YAxis,
} from "recharts";
import {
  Botao,
  CabecalhoTabela,
  CorpoTabela,
  LinhaTabela,
  Metrica,
  Pagina,
  Tabela,
  Vazio,
  suave,
} from "@/components/app/ui";
import {
  Abas,
  AreaTexto,
  BlocoCampos,
  Entrada,
  Grade,
  Selecao,
} from "@/components/negocio/formulario";
import { AvatarAgente, SeletorFotoAgente, useInvalidarFoto } from "@/components/negocio/foto-agente";
import { SeloSituacao } from "@/components/negocio/card-agente";
import {
  AgentesService,
  FotoAgenteService,
  paraFormularioAgente,
  type DadosAgente,
} from "@/services/agentes.service";
import { LancamentosService } from "@/services/lancamentos.service";
import { formatarCep, formatarCpf, formatarTelefone } from "@/lib/brasilapi";
import {
  dinheiro,
  dinheiroExato,
  extratoAgente,
  produtividadeAgente,
  saldoAgente,
} from "@/domain/services/financeiro";
import { varItem, varLista } from "@/lib/animacao";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import { nomeServico } from "@/domain/services/catalogo";
import {
  ROTULO_DOCUMENTO,
  ROTULO_FORMA_PAGAMENTO,
  ROTULO_LANCAMENTO,
  type FormaPagamento,
  type SituacaoAgente,
  type TipoDocumento,
} from "@/domain/types";

export const Route = createFileRoute("/_app/agentes/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do agente — Recolhe" },
      {
        name: "description",
        content:
          "Painel individual do agente: produtividade, extrato financeiro, documentos e pagamentos.",
      },
      { property: "og:title", content: "Ficha do agente — Recolhe" },
      {
        property: "og:description",
        content: "Produtividade, saldo e documentação do agente de campo.",
      },
    ],
  }),
  component: FichaAgente,
});

type Aba = "painel" | "extrato" | "documentos" | "ficha";

const data = (v: string) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const dataHora = (v: string) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

function FichaAgente() {
  const { id } = Route.useParams();
  const banco = useBanco();
  const sessao = useSessao();
  const sincronizar = useSincronizar();
  const [aba, setAba] = useState<Aba>("painel");

  const agente = banco.agentes.find((a) => a.id === id);
  const saldo = useMemo(() => (agente ? saldoAgente(banco, agente.id) : null), [banco, agente]);
  const producao = useMemo(
    () => (agente ? produtividadeAgente(banco, agente.id) : []),
    [banco, agente],
  );

  if (!agente || !saldo) {
    return (
      <Pagina
        titulo="Agente não encontrado"
        descricao="A ficha solicitada não existe ou foi removida."
      >
        <Vazio
          icone={UserRound}
          titulo="Ficha indisponível"
          texto="Volte para a lista de agentes e selecione um registro válido."
          acao={
            <Link to="/agentes">
              <Botao variante="linha">
                <ArrowLeft className="size-4" /> Voltar aos agentes
              </Botao>
            </Link>
          }
        />
      </Pagina>
    );
  }

  const documentos = banco.documentos.filter((d) => d.agenteId === agente.id);

  return (
    <Pagina
      titulo={agente.nome}
      descricao={`${agente.regiao || agente.cidade || "praça não definida"} · ${agente.motoPlaca || "sem moto"} · desde ${data(agente.contratadoEm)}`}
      acoes={
        <>
          <SeloSituacao valor={agente.situacao} />
          <Link to="/agentes">
            <Botao variante="fantasma">
              <ArrowLeft className="size-4" /> Agentes
            </Botao>
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-center gap-4 border border-border bg-surface p-4">
        <AvatarAgente foto={agente.foto} nome={agente.nome} tamanho={72} />
        <div className="min-w-0">
          <p className="font-display text-[18px] uppercase tracking-[0.04em]">{agente.nome}</p>
          <p className="text-[12px] text-muted-foreground">
            Agente de campo · {agente.telefone || "sem telefone"}
          </p>
          {!agente.foto && (
            <p className="mt-1 text-[12px] text-warning">Foto não cadastrada.</p>
          )}
        </div>
      </div>

      <motion.div
        variants={varLista()}
        initial="inicial"
        animate="animar"
        className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metrica
          rotulo="Saldo pendente"
          valor={dinheiro(saldo.pendente)}
          nota="disponível para pagamento"
          destaque
        />
        <Metrica
          rotulo="Produzido"
          valor={dinheiro(saldo.produzido)}
          nota={`mês ${dinheiro(saldo.mes)} · hoje ${dinheiro(saldo.hoje)}`}
        />
        <Metrica
          rotulo="Adiantamento em aberto"
          valor={dinheiro(saldo.adiantamentoAberto)}
          nota={`total adiantado ${dinheiro(saldo.adiantamentos)}`}
        />
        <Metrica
          rotulo="Pago"
          valor={dinheiro(saldo.pago)}
          nota={`bônus ${dinheiro(saldo.bonificacoes)} · descontos ${dinheiro(saldo.descontos)}`}
        />
        <Metrica
          rotulo="Ordens concluídas"
          valor={saldo.concluidas}
          nota={`${saldo.abertas} em campo · ${saldo.canceladas} canceladas`}
        />
        <Metrica
          rotulo="Tempo médio"
          valor={saldo.tempoMedio ? `${Math.round(saldo.tempoMedio)} min` : "—"}
          nota="da distribuição à conclusão"
        />
      </motion.div>

      <div className="mt-6">
        <Abas
          valor={aba}
          aoTrocar={setAba}
          itens={[
            { valor: "painel", rotulo: "Painel" },
            { valor: "extrato", rotulo: "Extrato" },
            { valor: "documentos", rotulo: "Documentos", contador: documentos.length },
            { valor: "ficha", rotulo: "Ficha" },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={aba}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={suave}
          className="mt-6"
        >
          {aba === "painel" && <Painel agenteId={agente.id} producao={producao} />}
          {aba === "extrato" && <Extrato agenteId={agente.id} />}
          {aba === "documentos" && <Documentos agenteId={agente.id} />}
          {aba === "ficha" && (
            <Ficha
              agenteId={agente.id}
              inicial={paraFormularioAgente(agente)}
              aoSalvar={async (dados) => {
                await AgentesService.atualizar(agente.id, dados);
                await sincronizar("agentes");
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {aba === "painel" && (
        <RegistrarPagamento
          agenteId={agente.id}
          pendente={saldo.pendente}
          responsavel={sessao.usuario?.nome ?? sessao.usuario?.email ?? "sistema"}
        />
      )}
    </Pagina>
  );
}

/* ─────────────────────────── Painel ─────────────────────────── */

function Painel({
  agenteId,
  producao,
}: {
  agenteId: string;
  producao: Array<{ dia: string; ordens: number; valor: number }>;
}) {
  const banco = useBanco();
  const saldo = saldoAgente(banco, agenteId);
  const ultimasOrdens = saldo.ordens.slice(-6).reverse();
  const ultimosPagamentos = [...saldo.pagamentos]
    .sort((a, b) => b.pagoEm.localeCompare(a.pagoEm))
    .slice(0, 6);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <section className="border border-border bg-surface">
        <header className="flex items-baseline gap-3 border-b border-border px-4 py-2.5">
          <span className="barra-ouro h-[10px] w-[2px]" />
          <p className="label-caps">Produtividade · 14 dias</p>
        </header>
        <div className="h-[240px] px-2 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={producao} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-prod" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 10 }}
                stroke="var(--color-muted-foreground)"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                stroke="var(--color-muted-foreground)"
                tickLine={false}
                axisLine={false}
              />
              <GraficoDica
                contentStyle={{
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-strong)",
                  fontSize: 12,
                }}
                formatter={(v: number, n) => (n === "valor" ? dinheiroExato(v) : v)}
              />
              <Area
                type="monotone"
                dataKey="valor"
                stroke="var(--color-primary)"
                strokeWidth={1.6}
                fill="url(#grad-prod)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-3">
          <Bloco rotulo="Produzido no ano" valor={dinheiro(saldo.ano)} />
          <Bloco rotulo="Total histórico" valor={dinheiro(saldo.produzido)} />
          <Bloco rotulo="Já pago" valor={dinheiro(saldo.pago)} />
        </div>
      </section>

      <div className="grid gap-6">
        <section className="border border-border bg-surface">
          <header className="border-b border-border px-4 py-2.5">
            <p className="label-caps">Últimas rotas</p>
          </header>
          {ultimasOrdens.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-muted-foreground">
              Nenhuma ordem concluída ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {ultimasOrdens.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Link
                    to="/ordens/$id"
                    params={{ id: o.id }}
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    {o.codigo}
                  </Link>
                  <span className="truncate text-[12.5px]">
                    {o.placa} · {nomeServico(banco, o)}
                  </span>
                  <span className="ml-auto font-mono text-[11.5px] text-muted-foreground">
                    {dataHora(o.concluidaEm ?? o.criadaEm)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-border bg-surface">
          <header className="border-b border-border px-4 py-2.5">
            <p className="label-caps">Últimos pagamentos</p>
          </header>
          {ultimosPagamentos.length === 0 ? (
            <p className="px-4 py-6 text-[13px] text-muted-foreground">
              Nenhum pagamento registrado.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {ultimosPagamentos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {data(p.pagoEm)}
                  </span>
                  <span className="text-[12.5px]">{ROTULO_FORMA_PAGAMENTO[p.forma]}</span>
                  <span className="ml-auto font-display text-[15px] text-success">
                    {dinheiroExato(p.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Bloco({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="label-caps">{rotulo}</p>
      <p className="mt-1 font-display text-[18px] text-cromo">{valor}</p>
    </div>
  );
}

/* ─────────────────────────── Extrato ─────────────────────────── */

function Extrato({ agenteId }: { agenteId: string }) {
  const banco = useBanco();
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const linhas = useMemo(
    () => extratoAgente(banco, agenteId, { de, ate }),
    [banco, agenteId, de, ate],
  );

  function exportarCsv() {
    const cabecalho = [
      "Data",
      "Descrição",
      "Tipo",
      "Locadora",
      "Serviço",
      "Produção",
      "Adiantamento",
      "Pagamento",
      "Desconto",
      "Bonificação",
      "Saldo",
    ];
    const corpo = linhas.map((l) => [
      dataHora(l.data),
      l.descricao,
      ROTULO_LANCAMENTO[l.tipo],
      l.locadora,
      l.servico ?? "",
      l.producao.toFixed(2),
      l.adiantamento.toFixed(2),
      l.pagamento.toFixed(2),
      l.desconto.toFixed(2),
      l.bonificacao.toFixed(2),
      l.saldo.toFixed(2),
    ]);
    const csv = [cabecalho, ...corpo]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${agenteId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="barra-ouro h-[10px] w-[2px]" />
        <p className="label-caps">Extrato do agente</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className="border border-border bg-surface-raised px-2 py-1 text-[12px] outline-none focus:border-primary"
          />
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="border border-border bg-surface-raised px-2 py-1 text-[12px] outline-none focus:border-primary"
          />
          <Botao variante="linha" tamanho="sm" onClick={exportarCsv}>
            Exportar Excel
          </Botao>
          <Botao variante="fantasma" tamanho="sm" onClick={() => window.print()}>
            PDF
          </Botao>
        </div>
      </header>

      {linhas.length === 0 ? (
        <p className="px-4 py-8 text-[13px] text-muted-foreground">
          Sem movimentações no período selecionado.
        </p>
      ) : (
        <Tabela minLargura={1040} className="border-0">
          <CabecalhoTabela
            colunas={[
              "Data",
              "Movimentação",
              "Tipo",
              "Locadora",
              "Serviço",
              "Produção",
              "Adiantamento",
              "Pagamento",
              "Desconto",
              "Bonificação",
              { rotulo: "Saldo", alinhar: "direita" },
            ]}
          />
          <CorpoTabela>
            {linhas.map((l) => (
              <LinhaTabela key={l.id}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-[11.5px] text-muted-foreground">
                  {dataHora(l.data)}
                </td>
                <td className="px-4 py-2 text-[12.5px]">{l.descricao}</td>
                <td className="px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  {ROTULO_LANCAMENTO[l.tipo]}
                </td>
                <td className="px-4 py-2 text-[12.5px] text-muted-foreground">{l.locadora}</td>
                <td className="px-4 py-2 text-[12.5px] text-muted-foreground">
                  {l.servico ?? "—"}
                </td>
                <td className="px-4 py-2 font-mono text-[12px] text-success">
                  {l.producao ? dinheiroExato(l.producao) : "—"}
                </td>
                <td className="px-4 py-2 font-mono text-[12px] text-warning">
                  {l.adiantamento ? dinheiroExato(l.adiantamento) : "—"}
                </td>
                <td className="px-4 py-2 font-mono text-[12px] text-foreground">
                  {l.pagamento ? dinheiroExato(l.pagamento) : "—"}
                </td>
                <td className="px-4 py-2 font-mono text-[12px] text-destructive">
                  {l.desconto ? dinheiroExato(l.desconto) : "—"}
                </td>
                <td className="px-4 py-2 font-mono text-[12px] text-success">
                  {l.bonificacao ? dinheiroExato(l.bonificacao) : "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono text-[12px] text-cromo">
                  {dinheiroExato(l.saldo)}
                </td>
              </LinhaTabela>
            ))}
          </CorpoTabela>
        </Tabela>
      )}
    </section>
  );
}

/* ─────────────────────────── Documentos ─────────────────────────── */

const TIPOS: TipoDocumento[] = [
  "cnh",
  "rg",
  "cpf",
  "residencia",
  "contrato",
  "comprovante",
  "outro",
];

function Documentos({ agenteId }: { agenteId: string }) {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const [tipo, setTipo] = useState<TipoDocumento>("cnh");
  const [enviando, setEnviando] = useState(false);
  const documentos = banco.documentos.filter((d) => d.agenteId === agenteId);

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setEnviando(true);
    try {
      await AgentesService.enviarDocumento(agenteId, arquivo, tipo);
      await sincronizar("agente_documentos");
      toast.success("Documento anexado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  async function abrir(url: string) {
    try {
      window.open(await AgentesService.abrirDocumento(url), "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remover(id: string, url: string) {
    try {
      await AgentesService.removerDocumento(id, url);
      await sincronizar("agente_documentos");
      toast.success("Documento removido.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
        <span className="barra-ouro h-[10px] w-[2px]" />
        <p className="label-caps">Arquivos do agente</p>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDocumento)}
            className="cursor-pointer border border-border bg-surface-raised px-2 py-1 text-[12px] outline-none focus:border-primary"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {ROTULO_DOCUMENTO[t]}
              </option>
            ))}
          </select>
          <label className="press inline-flex cursor-pointer items-center gap-2 border border-border-strong px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors hover:border-primary hover:text-primary">
            <FileUp className="size-3.5" />
            {enviando ? "enviando…" : "anexar"}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              disabled={enviando}
              onChange={(e) => void enviar(e.target.files?.[0])}
            />
          </label>
        </div>
      </header>

      {documentos.length === 0 ? (
        <p className="px-4 py-8 text-[13px] text-muted-foreground">
          Nenhum arquivo anexado. Envie CNH, contrato e comprovantes em PDF ou foto.
        </p>
      ) : (
        <motion.ul
          variants={varLista()}
          initial="inicial"
          animate="animar"
          className="divide-y divide-border"
        >
          {documentos.map((d) => (
            <motion.li key={d.id} variants={varItem} className="flex items-center gap-3 px-4 py-3">
              <Paperclip className="size-3.5 text-primary" />
              <button
                onClick={() => abrir(d.url)}
                className="press truncate text-[13px] hover:text-primary"
              >
                {d.nome}
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                {ROTULO_DOCUMENTO[d.tipo]}
              </span>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {data(d.criadoEm)}
              </span>
              <button
                onClick={() => remover(d.id, d.url)}
                aria-label={`Remover ${d.nome}`}
                className="press text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}

/* ─────────────────────────── Ficha (edição) ─────────────────────────── */

function Ficha({
  agenteId,
  inicial,
  aoSalvar,
}: {
  agenteId: string;
  inicial: DadosAgente;
  aoSalvar: (dados: DadosAgente) => Promise<void>;
}) {
  const [form, setForm] = useState<DadosAgente>(inicial);
  const [salvando, setSalvando] = useState(false);
  const alterar = <K extends keyof DadosAgente>(campo: K, valor: DadosAgente[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  async function salvar() {
    setSalvando(true);
    try {
      await aoSalvar(form);
      toast.success("Ficha atualizada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const invalidarFoto = useInvalidarFoto();

  return (
    <div className="grid gap-6">
      <BlocoCampos titulo="Foto do agente" descricao="usada em todas as telas do sistema">
        <SeletorFotoAgente
          foto={form.foto}
          nome={form.nome}
          aoConfirmar={async (blob) => {
            const caminho = await FotoAgenteService.enviar(agenteId, blob);
            alterar("foto", caminho);
            await invalidarFoto();
            toast.success("Foto atualizada.");
          }}
        />
      </BlocoCampos>

      <BlocoCampos titulo="Dados pessoais e contato">
        <Grade colunas={4}>
          <Entrada
            rotulo="Nome completo"
            value={form.nome}
            onChange={(e) => alterar("nome", e.target.value)}
          />
          <Entrada
            rotulo="CPF"
            value={form.cpf}
            onChange={(e) => alterar("cpf", formatarCpf(e.target.value))}
          />
          <Entrada rotulo="RG" value={form.rg} onChange={(e) => alterar("rg", e.target.value)} />
          <Entrada
            rotulo="Data de nascimento"
            type="date"
            value={form.nascimento}
            onChange={(e) => alterar("nascimento", e.target.value)}
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
            value={form.email}
            onChange={(e) => alterar("email", e.target.value)}
          />
          <Entrada
            rotulo="Estado civil"
            value={form.estadoCivil}
            onChange={(e) => alterar("estadoCivil", e.target.value)}
          />
        </Grade>
      </BlocoCampos>

      <BlocoCampos titulo="Endereço">
        <Grade colunas={4}>
          <Entrada
            rotulo="CEP"
            value={form.cep}
            onChange={(e) => alterar("cep", formatarCep(e.target.value))}
          />
          <Entrada rotulo="Rua" value={form.rua} onChange={(e) => alterar("rua", e.target.value)} />
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

      <BlocoCampos titulo="Habilitação, operação e veículo">
        <Grade colunas={4}>
          <Entrada rotulo="CNH" value={form.cnh} onChange={(e) => alterar("cnh", e.target.value)} />
          <Entrada
            rotulo="Categoria"
            value={form.cnhCategoria}
            onChange={(e) => alterar("cnhCategoria", e.target.value.toUpperCase())}
          />
          <Entrada
            rotulo="Validade da CNH"
            type="date"
            value={form.cnhValidade}
            onChange={(e) => alterar("cnhValidade", e.target.value)}
          />
          <Entrada
            rotulo="Contratado em"
            type="date"
            value={form.contratadoEm}
            onChange={(e) => alterar("contratadoEm", e.target.value)}
          />
          <Selecao
            rotulo="Situação"
            value={form.situacao}
            opcoes={[
              { valor: "ativo", rotulo: "Ativo" },
              { valor: "inativo", rotulo: "Inativo" },
              { valor: "bloqueado", rotulo: "Bloqueado" },
            ]}
            onChange={(e) => alterar("situacao", e.target.value as SituacaoAgente)}
          />
          <Entrada
            rotulo="Região"
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
            rotulo="Placa"
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
        <div className="flex justify-end border-t border-border px-4 py-3">
          <Botao onClick={salvar} carregando={salvando}>
            Salvar ficha
          </Botao>
        </div>
      </BlocoCampos>
    </div>
  );
}

/* ─────────────────────────── Pagamento ─────────────────────────── */

function RegistrarPagamento({
  agenteId,
  pendente,
  responsavel,
}: {
  agenteId: string;
  pendente: number;
  responsavel: string;
}) {
  const sincronizar = useSincronizar();
  const banco = useBanco();
  const [valor, setValor] = useState("");
  const [pagoEm, setPagoEm] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [observacao, setObservacao] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function registrar() {
    const numero = Number(valor.replace(",", "."));
    if (!(numero > 0)) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      const r = await LancamentosService.pagar(banco, {
        agenteId,
        valor: numero,
        data: pagoEm,
        forma,
        observacao,
        comprovante,
      });
      await sincronizar(["pagamentos_agente", "lancamentos_agente"]);
      setValor("");
      setObservacao("");
      setComprovante(null);
      toast.success(
        r.abatido > 0
          ? `Pagamento registrado. ${dinheiro(r.abatido)} abatidos de adiantamentos em aberto.`
          : "Pagamento registrado e abatido do saldo.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="mt-6 border border-border bg-surface">
      <header className="flex items-baseline gap-3 border-b border-border px-4 py-2.5">
        <span className="barra-ouro h-[10px] w-[2px]" />
        <p className="label-caps">Registrar pagamento</p>
        <p className="text-[11.5px] text-muted-foreground">saldo pendente {dinheiro(pendente)}</p>
      </header>
      <Grade colunas={4}>
        <Entrada
          rotulo="Valor (R$)"
          value={valor}
          inputMode="decimal"
          placeholder={String(pendente.toFixed(2))}
          onChange={(e) => setValor(e.target.value)}
        />
        <Entrada
          rotulo="Data"
          type="date"
          value={pagoEm}
          onChange={(e) => setPagoEm(e.target.value)}
        />
        <Selecao
          rotulo="Forma"
          value={forma}
          opcoes={[
            { valor: "pix", rotulo: "PIX" },
            { valor: "ted", rotulo: "TED" },
            { valor: "dinheiro", rotulo: "Dinheiro" },
          ]}
          onChange={(e) => setForma(e.target.value as FormaPagamento)}
        />
        <div className="bg-surface px-4 py-3">
          <span className="label-caps">Comprovante</span>
          <label className="press mt-1.5 flex cursor-pointer items-center gap-2 border-b border-border pb-1 text-[13px] hover:border-primary">
            <Paperclip className="size-3.5 text-primary" />
            <span className="truncate text-muted-foreground">
              {comprovante?.name ?? "anexar arquivo"}
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <AreaTexto
          rotulo="Observação"
          value={observacao}
          areaClassName="sm:col-span-2 lg:col-span-4"
          onChange={(e) => setObservacao(e.target.value)}
        />
      </Grade>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <p className="text-[11.5px] text-muted-foreground">
          Responsável: <span className="text-cromo">{responsavel}</span> · o valor apenas abate o
          saldo, nunca altera o cálculo das ordens.
        </p>
        <Botao onClick={registrar} carregando={salvando}>
          Confirmar pagamento
        </Botao>
      </div>
    </section>
  );
}
