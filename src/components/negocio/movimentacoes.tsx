/**
 * Movimentações financeiras dos agentes: adiantamentos, pagamentos com
 * compensação automática, descontos e bonificações. Nada é editado depois de
 * lançado — cada movimento é definitivo e aparece no extrato.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  Botao,
  CabecalhoTabela,
  CorpoTabela,
  LinhaTabela as Linha,
  Modal,
  Tabela as TabelaBase,
  Vazio,
  suave,
} from "@/components/app/ui";
import { useConfirmacao } from "@/components/app/confirmar";
import { CampoMoeda } from "@/components/negocio/campo-moeda";
import { LancamentosService } from "@/services/lancamentos.service";
import {
  adiantamentos,
  dinheiro,
  dinheiroExato,
  pagamentosRealizados,
  saldoAgente,
} from "@/domain/services/financeiro";
import { useSincronizar } from "@/lib/sessao";
import type { Banco, TipoLancamento } from "@/domain/types";
import type { MovimentoFinanceiro } from "@/domain/services/financeiro";

const hoje = () => new Date().toISOString().slice(0, 10);

const TIPOS: Array<{
  valor: Exclude<TipoLancamento, "producao" | "compensacao">;
  rotulo: string;
  nota: string;
}> = [
  {
    valor: "adiantamento",
    rotulo: "Adiantamento",
    nota: "fica pendente até ser compensado por um pagamento",
  },
  {
    valor: "pagamento",
    rotulo: "Pagamento",
    nota: "compensa automaticamente adiantamentos em aberto",
  },
  { valor: "desconto", rotulo: "Desconto", nota: "abate do saldo produzido" },
  { valor: "bonificacao", rotulo: "Bonificação", nota: "soma ao saldo produzido" },
];

const FORMAS = ["pix", "ted", "dinheiro", "outro"];

export function Movimentacoes({ banco }: { banco: Banco }) {
  const sincronizar = useSincronizar();
  const { pedir, pedirMotivo, dialogo } = useConfirmacao();
  const [edicao, setEdicao] = useState<MovimentoFinanceiro | null>(null);
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["valor"]>("adiantamento");
  const [agenteId, setAgenteId] = useState("");
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hoje());
  const [forma, setForma] = useState("pix");
  const [observacao, setObservacao] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

  const saldo = useMemo(() => (agenteId ? saldoAgente(banco, agenteId) : null), [banco, agenteId]);
  const lista = useMemo(() => adiantamentos(banco), [banco]);
  const pagos = useMemo(() => pagamentosRealizados(banco), [banco]);

  const lancar = async () => {
    if (!agenteId) {
      toast.error("Selecione o agente.");
      return;
    }
    if (!(valor > 0)) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSalvando(true);
    try {
      const dados = { agenteId, valor, data, forma, observacao, comprovante };
      if (tipo === "pagamento") {
        const r = await LancamentosService.pagar(banco, dados);
        toast.success(
          r.abatido > 0
            ? `Pagamento registrado. ${dinheiro(r.abatido)} abatidos de adiantamentos.`
            : "Pagamento registrado.",
        );
      } else if (tipo === "adiantamento") {
        await LancamentosService.adiantar(dados);
        toast.success("Adiantamento registrado — permanece pendente até a compensação.");
      } else if (tipo === "desconto") {
        await LancamentosService.desconto(dados);
        toast.success("Desconto registrado.");
      } else {
        await LancamentosService.bonificacao(dados);
        toast.success("Bonificação registrada.");
      }
      await sincronizar("lancamentos_agente");
      setValor(0);
      setObservacao("");
      setComprovante(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const excluirMovimento = async (m: MovimentoFinanceiro) => {
    if (LancamentosService.utilizado(banco, m.id)) {
      toast.error("Já utilizado em um pagamento. Use o estorno.");
      return;
    }
    const ok = await pedir({
      titulo: "Excluir lançamento?",
      texto: `${dinheiroExato(m.valor)} de ${m.agente}. A exclusão é definitiva.`,
      confirmar: "Excluir",
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await LancamentosService.excluir(banco, m.id);
      await sincronizar("lancamentos_agente");
      toast.success("Lançamento excluído.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const estornarMovimento = async (m: MovimentoFinanceiro) => {
    const motivo = await pedirMotivo({
      titulo: "Estornar lançamento?",
      texto: `${dinheiroExato(m.valor)} de ${m.agente}. O lançamento continua no extrato, marcado como estornado.`,
      confirmar: "Estornar",
      destrutivo: true,
      motivo: "Motivo do estorno",
    });
    if (motivo === null) return;
    try {
      await LancamentosService.estornar(banco, m.id, motivo);
      await sincronizar("lancamentos_agente");
      toast.success("Lançamento estornado e saldo devolvido ao agente.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (banco.agentes.length === 0) {
    return (
      <Vazio
        titulo="Nenhum agente cadastrado"
        texto="Cadastre agentes para lançar adiantamentos e pagamentos."
      />
    );
  }

  const escolhido = TIPOS.find((t) => t.valor === tipo)!;

  return (
    <div className="space-y-6">
      <section className="border border-border">
        <div className="flex gap-px rolagem-x bg-border">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              onClick={() => setTipo(t.valor)}
              className={`press relative whitespace-nowrap bg-surface px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                tipo === t.valor ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.rotulo}
              {tipo === t.valor && (
                <motion.span
                  layoutId="aba-mov"
                  transition={suave}
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-primary"
                />
              )}
            </button>
          ))}
        </div>

        <p className="border-b border-border px-4 py-2 text-[12px] text-muted-foreground">
          {escolhido.nota}
        </p>

        <div className="grid gap-px bg-border md:grid-cols-3 xl:grid-cols-5">
          <label className="bg-surface px-4 py-3">
            <span className="label-caps">Agente</span>
            <select
              value={agenteId}
              onChange={(e) => setAgenteId(e.target.value)}
              className="mt-1.5 w-full cursor-pointer border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
            >
              <option value="" className="bg-surface">
                Selecione
              </option>
              {banco.agentes.map((a) => (
                <option key={a.id} value={a.id} className="bg-surface">
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="bg-surface px-4 py-3">
            <span className="label-caps">Data</span>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1.5 w-full border-b border-border bg-transparent pb-1 font-mono text-[13px] text-foreground outline-none focus:border-primary"
            />
          </label>
          <div className="bg-surface px-4 py-3">
            <span className="label-caps">Valor</span>
            <div className="mt-1.5">
              <CampoMoeda valor={valor} aoAlterar={setValor} />
            </div>
          </div>
          <label className="bg-surface px-4 py-3">
            <span className="label-caps">Forma</span>
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              className="mt-1.5 w-full cursor-pointer border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
            >
              {FORMAS.map((f) => (
                <option key={f} value={f} className="bg-surface">
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="bg-surface px-4 py-3">
            <span className="label-caps">Comprovante</span>
            <input
              type="file"
              onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
              className="mt-1.5 w-full text-[11px] text-muted-foreground file:mr-2 file:border file:border-border-strong file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.12em] file:text-muted-foreground"
            />
          </label>
          <label className="bg-surface px-4 py-3 md:col-span-2 xl:col-span-4">
            <span className="label-caps">Observação</span>
            <input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Motivo, referência ou combinado com o agente"
              className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-end bg-surface px-4 py-3">
            <Botao onClick={lancar} carregando={salvando}>
              Lançar {escolhido.rotulo.toLowerCase()}
            </Botao>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {saldo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-border bg-surface-raised"
            >
              <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-5">
                {[
                  ["Produzido", dinheiroExato(saldo.produzido), "text-foreground"],
                  ["Bonificações", dinheiroExato(saldo.bonificacoes), "text-success"],
                  ["Descontos", dinheiroExato(saldo.descontos), "text-danger"],
                  [
                    "Adiantamento em aberto",
                    dinheiroExato(saldo.adiantamentoAberto),
                    "text-warning",
                  ],
                  [
                    "Disponível para pagar",
                    dinheiroExato(Math.max(saldo.pendente, 0)),
                    "text-primary",
                  ],
                ].map(([r, v, cor]) => (
                  <div key={r} className="bg-surface px-4 py-3">
                    <p className="label-caps">{r}</p>
                    <p className={`mt-1 font-mono text-[15px] tabular-nums ${cor}`}>{v}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <Tabela
        titulo="Adiantamentos"
        nota="Um adiantamento nunca desaparece: fica pendente até ser compensado por um pagamento."
        vazio="Nenhum adiantamento concedido."
        linhas={lista.map((m) => ({
          id: m.id,
          agenteId: m.agenteId,
          celulas: [
            new Date(m.data).toLocaleDateString("pt-BR"),
            m.agente,
            m.forma.toUpperCase(),
            m.responsavel || "—",
            m.observacao || "—",
          ],
          marca: m.compensado
            ? { texto: "compensado", classe: "border-success/40 text-success" }
            : { texto: "em aberto", classe: "border-warning/40 text-warning" },
          valor: dinheiroExato(m.valor),
          corValor: "text-warning",
          situacao: m.situacao,
          motivo: m.motivo,
          movimento: m,
        }))}
        aoEditar={setEdicao}
        aoExcluir={excluirMovimento}
        aoEstornar={estornarMovimento}
      />

      <Tabela
        titulo="Pagamentos realizados"
        nota="Valores líquidos entregues ao agente, já descontados os adiantamentos compensados."
        vazio="Nenhum pagamento registrado."
        recibo
        linhas={pagos.map((m) => ({
          id: m.id,
          agenteId: m.agenteId,
          celulas: [
            new Date(m.data).toLocaleDateString("pt-BR"),
            m.agente,
            (m.forma || "—").toUpperCase(),
            m.responsavel || "—",
            m.observacao || "—",
          ],
          valor: dinheiroExato(m.valor),
          corValor: "text-success",
          situacao: m.situacao,
          motivo: m.motivo,
          movimento: m,
        }))}
        aoEstornar={estornarMovimento}
      />

      <EdicaoLancamento
        banco={banco}
        movimento={edicao}
        aoFechar={() => setEdicao(null)}
        aoSalvar={async () => {
          await sincronizar("lancamentos_agente");
          setEdicao(null);
        }}
      />
      {dialogo}
    </div>
  );
}

/** Ajuste de um adiantamento ainda não compensado. */
function EdicaoLancamento({
  banco,
  movimento,
  aoFechar,
  aoSalvar,
}: {
  banco: Banco;
  movimento: MovimentoFinanceiro | null;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(hoje());
  const [forma, setForma] = useState("pix");
  const [observacao, setObservacao] = useState("");
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [chave, setChave] = useState("");

  if (movimento && chave !== movimento.id) {
    setChave(movimento.id);
    setValor(movimento.valor);
    setData(movimento.data.slice(0, 10));
    setForma(movimento.forma || "pix");
    setObservacao(movimento.observacao);
    setComprovante(null);
  }

  const salvar = async () => {
    if (!movimento) return;
    setSalvando(true);
    try {
      await LancamentosService.editar(banco, movimento.id, {
        valor,
        data,
        forma,
        observacao,
        comprovante,
      });
      toast.success("Lançamento atualizado.");
      await aoSalvar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      aberto={!!movimento}
      aoFechar={aoFechar}
      titulo="Editar lançamento"
      descricao={movimento ? `${movimento.agente} — ${dinheiroExato(movimento.valor)}` : ""}
      rodape={
        <>
          <Botao variante="linha" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao onClick={() => void salvar()} carregando={salvando}>
            Salvar
          </Botao>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="label-caps">Valor</span>
          <div className="mt-1.5">
            <CampoMoeda valor={valor} aoAlterar={setValor} />
          </div>
        </div>
        <label className="block">
          <span className="label-caps">Data</span>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1.5 w-full border-b border-border bg-transparent pb-1 font-mono text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="label-caps">Forma</span>
          <select
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            className="mt-1.5 w-full cursor-pointer border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
          >
            {FORMAS.map((f) => (
              <option key={f} value={f} className="bg-surface">
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-caps">Novo comprovante</span>
          <input
            type="file"
            onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
            className="mt-1.5 w-full text-[11px] text-muted-foreground file:mr-2 file:border file:border-border-strong file:bg-transparent file:px-2 file:py-1 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.12em] file:text-muted-foreground"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="label-caps">Observação</span>
          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
      </div>
    </Modal>
  );
}

interface LinhaTabela {
  id: string;
  agenteId: string;
  celulas: string[];
  marca?: { texto: string; classe: string };
  valor: string;
  corValor: string;
  situacao: string;
  motivo: string;
  movimento: MovimentoFinanceiro;
}

function Tabela({
  titulo,
  nota,
  vazio,
  linhas,
  recibo,
  aoEditar,
  aoExcluir,
  aoEstornar,
}: {
  titulo: string;
  nota: string;
  vazio: string;
  linhas: LinhaTabela[];
  recibo?: boolean;
  aoEditar?: (m: MovimentoFinanceiro) => void;
  aoExcluir?: (m: MovimentoFinanceiro) => void | Promise<void>;
  aoEstornar?: (m: MovimentoFinanceiro) => void | Promise<void>;
}) {
  return (
    <section className="border border-border">
      <header className="border-b border-border px-4 py-3">
        <p className="label-caps">{titulo}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">{nota}</p>
      </header>
      {linhas.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted-foreground">{vazio}</p>
      ) : (
        <TabelaBase minLargura={820} className="border-0">
          <CabecalhoTabela
            colunas={[
              "Data",
              "Agente",
              "Forma",
              "Responsável",
              "Observação",
              "Situação",
              { rotulo: "Valor", alinhar: "direita" },
              { rotulo: "Ações", alinhar: "direita" },
            ]}
          />
          <CorpoTabela>
            {linhas.map((l) => (
              <Linha key={l.id}>
                {l.celulas.map((c, k) => (
                  <td
                    key={k}
                    className={`px-4 py-2 text-[12.5px] ${k === 0 ? "whitespace-nowrap font-mono text-[11.5px] text-muted-foreground" : k > 2 ? "text-muted-foreground" : ""}`}
                  >
                    {c}
                  </td>
                ))}
                <td className="px-4 py-2">
                  {l.situacao !== "ativo" ? (
                    <span
                      title={l.motivo || undefined}
                      className="border border-destructive/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-destructive"
                    >
                      {l.situacao}
                    </span>
                  ) : l.marca ? (
                    <span
                      className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${l.marca.classe}`}
                    >
                      {l.marca.texto}
                    </span>
                  ) : recibo ? (
                    <Link
                      to="/documentos/$tipo/$id"
                      params={{ tipo: "recibo", id: l.id }}
                      className="press border border-border-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      recibo
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td
                  className={`px-4 py-2 text-right font-mono text-[12.5px] ${l.situacao === "ativo" ? l.corValor : "text-muted-foreground line-through"}`}
                >
                  {l.valor}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  {l.situacao !== "ativo" ? (
                    <span className="text-[11.5px] text-muted-foreground">—</span>
                  ) : (
                    <div className="inline-flex gap-1.5">
                      {aoEditar && (
                        <BotaoLinha rotulo="editar" aoClicar={() => aoEditar(l.movimento)} />
                      )}
                      {aoEstornar && (
                        <BotaoLinha
                          rotulo="estornar"
                          destrutivo
                          aoClicar={() => void aoEstornar(l.movimento)}
                        />
                      )}
                      {aoExcluir && (
                        <BotaoLinha
                          rotulo="excluir"
                          destrutivo
                          aoClicar={() => void aoExcluir(l.movimento)}
                        />
                      )}
                    </div>
                  )}
                </td>
              </Linha>
            ))}
          </CorpoTabela>
        </TabelaBase>
      )}
    </section>
  );
}

function BotaoLinha({
  rotulo,
  aoClicar,
  destrutivo,
}: {
  rotulo: string;
  aoClicar: () => void;
  destrutivo?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={aoClicar}
      className={`press border border-border-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
        destrutivo
          ? "text-muted-foreground hover:border-destructive hover:text-destructive"
          : "text-muted-foreground hover:border-primary hover:text-primary"
      }`}
    >
      {rotulo}
    </motion.button>
  );
}
