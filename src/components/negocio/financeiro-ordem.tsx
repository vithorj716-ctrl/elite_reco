/**
 * Card FINANCEIRO da ordem.
 *
 * Mostra a trilha completa do dinheiro daquela ordem: o serviço (congelado na
 * conclusão) e cada cobrança lançada — taxa de cancelamento, quilometragem,
 * adicionais. Nada aqui é "visual": cada linha é um lançamento financeiro real
 * que entra no faturamento da locadora.
 *
 * Excluir ≠ estornar. A taxa de cancelamento nunca é apagada: só estornada.
 */
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Lock, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Botao } from "@/components/app/ui";
import { useConfirmacao } from "@/components/app/confirmar";
import { CampoMoeda } from "@/components/negocio/campo-moeda";
import { EASE, varItem, varLista } from "@/lib/animacao";
import { moedaBR } from "@/lib/moeda";
import { useBanco, useSincronizar } from "@/lib/sessao";
import { CobrancasService } from "@/services/cobrancas.service";
import { lancamentosDaOrdem, rotuloTipoCobranca } from "@/domain/services/financeiro";
import {
  COBRANCAS_SUGERIDAS,
  ROTULO_TIPO_COBRANCA,
  type Cobranca,
  type Ordem,
  type TipoCobranca,
} from "@/domain/types";

const CAMPO =
  "w-full border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary";

const TIPOS_MANUAIS: TipoCobranca[] = ["adicional", "km", "viagem", "outros"];

export function FinanceiroOrdem({ ordem, podeEditar }: { ordem: Ordem; podeEditar: boolean }) {
  const banco = useBanco();
  const sincronizar = useSincronizar();
  const { pedir, dialogo } = useConfirmacao();

  const cobrancas = useMemo(
    () => (banco.cobrancas ?? []).filter((c) => c.ordemId === ordem.id),
    [banco.cobrancas, ordem.id],
  );
  const linhas = useMemo(() => lancamentosDaOrdem(banco, ordem), [banco, ordem]);
  const total = linhas.filter((l) => l.situacao === "ativa").reduce((s, l) => s + l.valor, 0);
  const estornado = linhas
    .filter((l) => l.situacao === "estornada")
    .reduce((s, l) => s + l.valor, 0);

  const faturada = ordem.recebimentoPago;
  const cancelada = ordem.status === "cancelada";
  const liberado = podeEditar && !faturada && !cancelada;

  const [abrindo, setAbrindo] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoCobranca>("adicional");
  const [valor, setValor] = useState(0);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<Cobranca | null>(null);

  function limpar() {
    setNome("");
    setValor(0);
    setTipo("adicional");
    setObservacao("");
    setAbrindo(false);
  }

  async function salvar() {
    if (!nome.trim()) {
      toast.error("Informe o nome da cobrança.");
      return;
    }
    setSalvando(true);
    try {
      await CobrancasService.criar({ ordem, nome, valor, observacao, tipo });
      await sincronizar("ordem_cobrancas");
      limpar();
      toast.success("Cobrança lançada no financeiro da locadora.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarEdicao(c: Cobranca) {
    const original = cobrancas.find((x) => x.id === c.id);
    if (!original) return;
    try {
      await CobrancasService.atualizar(ordem, original, {
        nome: c.nome,
        valor: c.valor,
        observacao: c.observacao,
        tipo: c.tipo,
      });
      await sincronizar("ordem_cobrancas");
      setEditando(null);
      toast.success("Cobrança atualizada — o faturamento acompanha o novo valor.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function estornar(c: Cobranca) {
    const ok = await pedir({
      titulo: `Estornar “${c.nome}”?`,
      texto: `A cobrança de ${moedaBR(c.valor)} sai do faturamento, mas continua registrada no histórico da ordem.`,
    });
    if (!ok) return;
    try {
      await CobrancasService.estornar(ordem, c, "Estorno lançado pela central.");
      await sincronizar("ordem_cobrancas");
      toast.success("Cobrança estornada. O histórico foi preservado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function excluir(c: Cobranca) {
    const ok = await pedir({
      titulo: `Excluir “${c.nome}”?`,
      texto: `A cobrança de ${moedaBR(c.valor)} será removida desta ordem.`,
    });
    if (!ok) return;
    try {
      await CobrancasService.excluir(ordem, c);
      await sincronizar("ordem_cobrancas");
      toast.success("Cobrança excluída.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="border border-border">
      {dialogo}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <p className="label-caps">Financeiro</p>
        {faturada && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-warning">
            <Lock className="size-3" aria-hidden /> faturada
          </span>
        )}
        <span className="ml-auto font-mono text-[13px] tabular-nums text-primary">
          {moedaBR(total)}
        </span>
      </div>

      {linhas.length === 0 && !abrindo ? (
        <p className="px-4 py-5 text-[13px] text-muted-foreground">
          Nenhum valor lançado nesta ordem.
        </p>
      ) : (
        <motion.ul
          variants={varLista(0.035)}
          initial="inicial"
          animate="animar"
          className="grid gap-px bg-border"
        >
          <AnimatePresence initial={false}>
            {linhas.map((l) => {
              const c = cobrancas.find((x) => x.id === l.id) ?? null;
              if (c && editando?.id === c.id) {
                return (
                  <motion.li key={l.id} variants={varItem} className="bg-surface px-4 py-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                      <input
                        className={CAMPO}
                        value={editando.nome}
                        onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                      />
                      <CampoMoeda
                        valor={editando.valor}
                        aoAlterar={(v) => setEditando({ ...editando, valor: v })}
                      />
                    </div>
                    <input
                      className={`${CAMPO} mt-3`}
                      placeholder="Observação"
                      value={editando.observacao}
                      onChange={(e) => setEditando({ ...editando, observacao: e.target.value })}
                    />
                    <div className="mt-3 flex justify-end gap-2">
                      <Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(null)}>
                        <X className="size-3.5" /> Cancelar
                      </Botao>
                      <Botao tamanho="sm" onClick={() => void confirmarEdicao(editando)}>
                        <Check className="size-3.5" /> Salvar
                      </Botao>
                    </div>
                  </motion.li>
                );
              }

              const estornadaLinha = l.situacao === "estornada";
              return (
                <motion.li
                  key={l.id}
                  variants={varItem}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.24, ease: EASE }}
                  className="group flex items-center gap-3 bg-surface px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p
                      className={`truncate text-[13px] ${
                        estornadaLinha ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {l.descricao}
                    </p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {rotuloTipoCobranca(l.tipo)}
                      {estornadaLinha
                        ? " · estornada"
                        : l.estado === "faturada"
                          ? " · faturada"
                          : " · pendente"}
                      {c?.observacao ? ` · ${c.observacao}` : ""}
                    </p>
                  </div>
                  <span
                    className={`ml-auto font-mono text-[13px] tabular-nums ${
                      estornadaLinha ? "text-muted-foreground line-through" : "text-foreground"
                    }`}
                  >
                    {moedaBR(l.valor)}
                  </span>
                  {c && !faturada && podeEditar && !estornadaLinha && (
                    <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                      {c.tipo !== "taxa_cancelamento" && !cancelada && (
                        <button
                          onClick={() => setEditando(c)}
                          aria-label={`Editar ${c.nome}`}
                          className="press p-1 text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => void estornar(c)}
                        aria-label={`Estornar ${c.nome}`}
                        title="Estornar (preserva o histórico)"
                        className="press p-1 text-muted-foreground hover:text-warning"
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                      {c.tipo !== "taxa_cancelamento" && (
                        <button
                          onClick={() => void excluir(c)}
                          aria-label={`Excluir ${c.nome}`}
                          className="press p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      {estornado > 0 && (
        <p className="border-t border-border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          estornado nesta ordem · {moedaBR(estornado)}
        </p>
      )}

      {liberado && (
        <div className="border-t border-border px-4 py-3">
          <AnimatePresence mode="wait" initial={false}>
            {abrindo ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: EASE }}
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <div>
                    <label className="label-caps" htmlFor="cobranca-nome">
                      Nome da cobrança
                    </label>
                    <input
                      id="cobranca-nome"
                      autoFocus
                      className={`${CAMPO} mt-1`}
                      placeholder="Recolhimento"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label-caps" htmlFor="cobranca-valor">
                      Valor
                    </label>
                    <div className="mt-1">
                      <CampoMoeda id="cobranca-valor" valor={valor} aoAlterar={setValor} />
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="label-caps" htmlFor="cobranca-tipo">
                    Tipo financeiro
                  </label>
                  <select
                    id="cobranca-tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as TipoCobranca)}
                    className={`${CAMPO} mt-1`}
                  >
                    {TIPOS_MANUAIS.map((t) => (
                      <option key={t} value={t}>
                        {ROTULO_TIPO_COBRANCA[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {COBRANCAS_SUGERIDAS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setNome(s)}
                      className="press border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  className={`${CAMPO} mt-3`}
                  placeholder="Observação (opcional)"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void salvar()}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Botao variante="fantasma" tamanho="sm" onClick={limpar}>
                    Cancelar
                  </Botao>
                  <Botao tamanho="sm" carregando={salvando} onClick={() => void salvar()}>
                    <Check className="size-3.5" /> Salvar cobrança
                  </Botao>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="botao"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <Botao tamanho="sm" onClick={() => setAbrindo(true)}>
                  <Plus className="size-3.5" /> Adicionar cobrança
                </Botao>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
