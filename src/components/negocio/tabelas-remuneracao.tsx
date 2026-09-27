/**
 * Editor de tabelas de remuneração. Nenhum nome ou valor é fixo: o
 * administrador cria tabelas, adiciona linhas livres, duplica e exclui.
 */
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Trash2 } from "lucide-react";
import { Botao, Vazio, suave } from "@/components/app/ui";
import { useConfirmacao } from "@/components/app/confirmar";
import { CampoMoeda } from "@/components/negocio/campo-moeda";
import { RemuneracaoService } from "@/services/remuneracao.service";
import { itensDa } from "@/domain/services/remuneracao";
import { useSincronizar } from "@/lib/sessao";
import { dinheiroExato } from "@/domain/services/financeiro";
import { catalogoAtivo } from "@/domain/services/catalogo";
import {
  type Banco,
  type EscopoTabela,
  type ItemRemuneracao,
  type Servico,
  type TabelaRemuneracao,
  type UnidadeItem,
} from "@/domain/types";

/** Grade única da planilha — cabeçalho e linhas usam exatamente as mesmas colunas. */
const GRADE =
  "grid grid-cols-[minmax(160px,1.4fr)_minmax(140px,1.1fr)_minmax(160px,1.5fr)_96px_minmax(120px,0.9fr)_auto] gap-3 px-4";

const ESCOPOS: Array<{ valor: EscopoTabela; rotulo: string; nota: string }> = [
  { valor: "cobranca", rotulo: "Cobrança", nota: "o que a locadora paga" },
  { valor: "pagamento", rotulo: "Pagamento", nota: "o que o agente recebe" },
];

export function TabelasRemuneracao({ banco }: { banco: Banco }) {
  const sincronizar = useSincronizar();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [escopo, setEscopo] = useState<EscopoTabela>("cobranca");
  const [vinculo, setVinculo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const criar = async () => {
    setSalvando(true);
    try {
      const [tipo, id] = vinculo ? vinculo.split(":") : ["", ""];
      await RemuneracaoService.criarTabela({
        nome,
        escopo,
        padrao: !vinculo,
        locadoraId: tipo === "locadora" ? (id ?? null) : null,
        agenteId: tipo === "agente" ? (id ?? null) : null,
      });
      await sincronizar("tabelas_remuneracao");
      toast.success("Tabela criada.");
      setNome("");
      setVinculo("");
      setCriando(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="label-caps">Tabelas de remuneração</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Crie quantas tabelas quiser. Uma tabela sem vínculo vira o padrão da operação.
            </p>
          </div>
          <Botao variante="linha" onClick={() => setCriando((v) => !v)}>
            {criando ? "Cancelar" : "Nova tabela"}
          </Botao>
        </div>

        <AnimatePresence initial={false}>
          {criando && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden bg-surface"
            >
              <div className="grid gap-px bg-border md:grid-cols-[2fr_1fr_1.4fr_auto]">
                <label className="bg-surface px-4 py-3">
                  <span className="label-caps">Nome da tabela</span>
                  <input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Tabela Motoclub 2026"
                    className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
                  />
                </label>
                <label className="bg-surface px-4 py-3">
                  <span className="label-caps">Tipo</span>
                  <select
                    value={escopo}
                    onChange={(e) => setEscopo(e.target.value as EscopoTabela)}
                    className="mt-1.5 w-full cursor-pointer border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
                  >
                    {ESCOPOS.map((e) => (
                      <option key={e.valor} value={e.valor} className="bg-surface">
                        {e.rotulo} — {e.nota}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="bg-surface px-4 py-3">
                  <span className="label-caps">Vínculo</span>
                  <select
                    value={vinculo}
                    onChange={(e) => setVinculo(e.target.value)}
                    className="mt-1.5 w-full cursor-pointer border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
                  >
                    <option value="" className="bg-surface">
                      Padrão da operação
                    </option>
                    {banco.locadoras.map((l) => (
                      <option key={l.id} value={`locadora:${l.id}`} className="bg-surface">
                        Locadora · {l.nome}
                      </option>
                    ))}
                    {escopo === "pagamento" &&
                      banco.agentes.map((a) => (
                        <option key={a.id} value={`agente:${a.id}`} className="bg-surface">
                          Agente · {a.nome}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="flex items-end bg-surface px-4 py-3">
                  <Botao onClick={criar} carregando={salvando} disabled={!nome.trim()}>
                    Criar
                  </Botao>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {banco.tabelas.length === 0 ? (
        <Vazio
          titulo="Nenhuma tabela criada"
          texto="Crie a primeira tabela de remuneração para começar a precificar serviços."
        />
      ) : (
        <div className="space-y-6">
          {banco.tabelas.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...suave, delay: Math.min(i, 6) * 0.04 }}
            >
              <CartaoTabela banco={banco} tabela={t} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function CartaoTabela({ banco, tabela }: { banco: Banco; tabela: TabelaRemuneracao }) {
  const sincronizar = useSincronizar();
  const itens = itensDa(banco, tabela.id);
  const { pedir, dialogo } = useConfirmacao();
  const catalogo = catalogoAtivo(banco);
  const [novo, setNovo] = useState({
    nome: "",
    servicoId: "",
    descricao: "",
    valor: 0,
    unidade: "fixo" as UnidadeItem,
    observacao: "",
  });
  const [ocupado, setOcupado] = useState(false);

  const vinculada =
    (tabela.locadoraId && banco.locadoras.find((l) => l.id === tabela.locadoraId)?.nome) ||
    (tabela.agenteId && banco.agentes.find((a) => a.id === tabela.agenteId)?.nome) ||
    "Padrão da operação";

  const executar = async (acao: () => Promise<unknown>, mensagem?: string) => {
    setOcupado(true);
    try {
      await acao();
      await sincronizar(["tabelas_remuneracao", "itens_remuneracao"]);
      if (mensagem) toast.success(mensagem);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="border border-border">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <input
              defaultValue={tabela.nome}
              onBlur={(e) => {
                const valor = e.target.value.trim();
                if (valor && valor !== tabela.nome)
                  void executar(() =>
                    RemuneracaoService.atualizarTabela(tabela.id, { nome: valor }),
                  );
              }}
              className="border-b border-transparent bg-transparent text-[14px] text-foreground outline-none hover:border-border focus:border-primary"
            />
            <span className="border border-border-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {tabela.escopo === "cobranca" ? "cobrança" : "pagamento"}
            </span>
            {tabela.padrao && (
              <span className="border border-primary/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                padrão
              </span>
            )}
            {!tabela.ativa && (
              <span className="border border-warning/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-warning">
                inativa
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[12px] text-muted-foreground">{vinculada}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Botao
            variante="linha"
            disabled={ocupado}
            onClick={() =>
              void executar(
                () => RemuneracaoService.duplicarTabela(tabela, itens),
                "Tabela duplicada.",
              )
            }
          >
            Duplicar
          </Botao>
          <Botao
            variante="linha"
            disabled={ocupado}
            onClick={() =>
              void executar(() =>
                RemuneracaoService.atualizarTabela(tabela.id, { ativa: !tabela.ativa }),
              )
            }
          >
            {tabela.ativa ? "Desativar" : "Ativar"}
          </Botao>
          <Botao
            variante="linha"
            disabled={ocupado}
            onClick={() => {
              void (async () => {
                const ok = await pedir({
                  titulo: "Excluir tabela?",
                  texto: `"${tabela.nome}" e todas as suas linhas serão removidas.`,
                  confirmar: "Excluir",
                  destrutivo: true,
                });
                if (!ok) return;
                await executar(
                  () => RemuneracaoService.excluirTabela(tabela.id),
                  "Tabela excluída.",
                );
              })();
            }}
          >
            Excluir
          </Botao>
        </div>
      </header>

      {itens.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-muted-foreground">
          Nenhuma linha ainda — adicione o primeiro serviço abaixo.
        </p>
      ) : (
        <div className="rolagem-x">
          <div
            className={`${GRADE} border-b border-border bg-surface-raised py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground`}
          >
            <span>Serviço</span>
            <span>Tipo de ordem</span>
            <span>Descrição</span>
            <span>Unidade</span>
            <span className="text-right">Valor</span>
            <span className="text-right">Ações</span>
          </div>
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {itens.map((item, i) => (
                <LinhaItem
                  key={item.id}
                  item={item}
                  catalogo={catalogo}
                  aoExecutar={executar}
                  ocupado={ocupado}
                  aoPedir={pedir}
                  aoMover={(direcao) => {
                    const destino = i + direcao;
                    if (destino < 0 || destino >= itens.length) return;
                    const ordenado = [...itens];
                    const [movido] = ordenado.splice(i, 1);
                    ordenado.splice(destino, 0, movido!);
                    void executar(() => RemuneracaoService.reordenar(ordenado));
                  }}
                  primeiro={i === 0}
                  ultimo={i === itens.length - 1}
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <div className="grid gap-px border-t border-border bg-border md:grid-cols-[1.4fr_1.1fr_1.5fr_0.7fr_0.9fr_auto]">
        <label className="bg-surface px-4 py-3">
          <span className="label-caps">Serviço</span>
          <input
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            placeholder="Ex.: Desbloqueio"
            className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="bg-surface px-4 py-3">
          <span className="label-caps">Serviço do catálogo</span>
          <select
            value={novo.servicoId}
            onChange={(e) => {
              const escolhido = catalogo.find((s) => s.id === e.target.value);
              setNovo({
                ...novo,
                servicoId: e.target.value,
                nome: novo.nome.trim() ? novo.nome : (escolhido?.nome ?? ""),
                unidade: escolhido?.unidade ?? novo.unidade,
              });
            }}
            className="mt-1.5 w-full cursor-pointer border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
          >
            <option value="" className="bg-surface">
              Avulso (sem vínculo)
            </option>
            {catalogo.map((s) => (
              <option key={s.id} value={s.id} className="bg-surface">
                {s.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="bg-surface px-4 py-3">
          <span className="label-caps">Descrição</span>
          <input
            value={novo.descricao}
            onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
            className="mt-1.5 w-full border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </label>
        <label className="bg-surface px-4 py-3">
          <span className="label-caps">Unidade</span>
          <select
            value={novo.unidade}
            onChange={(e) => setNovo({ ...novo, unidade: e.target.value as UnidadeItem })}
            className="mt-1.5 w-full cursor-pointer border-b border-border bg-transparent pb-1 text-[13px] text-foreground outline-none focus:border-primary"
          >
            <option value="fixo" className="bg-surface">
              Valor fechado
            </option>
            <option value="km" className="bg-surface">
              Por quilômetro
            </option>
          </select>
        </label>
        <div className="bg-surface px-4 py-3">
          <span className="label-caps">Valor</span>
          <div className="mt-1.5">
            <CampoMoeda valor={novo.valor} aoAlterar={(v) => setNovo({ ...novo, valor: v })} />
          </div>
        </div>
        <div className="flex items-end bg-surface px-4 py-3">
          <Botao
            disabled={!novo.nome.trim() || ocupado}
            onClick={() =>
              void executar(async () => {
                await RemuneracaoService.adicionarItem(tabela.id, {
                  ...novo,
                  posicao: itens.length,
                });
                setNovo({
                  nome: "",
                  servicoId: "",
                  descricao: "",
                  valor: 0,
                  unidade: "fixo",
                  observacao: "",
                });
              }, "Linha adicionada.")
            }
          >
            Adicionar
          </Botao>
        </div>
      </div>
      {dialogo}
    </section>
  );
}

function LinhaItem({
  item,
  catalogo,
  aoExecutar,
  ocupado,
  aoMover,
  aoPedir,
  primeiro,
  ultimo,
}: {
  item: ItemRemuneracao;
  catalogo: Servico[];
  aoExecutar: (acao: () => Promise<unknown>, mensagem?: string) => Promise<void>;
  ocupado: boolean;
  aoMover: (direcao: -1 | 1) => void;
  aoPedir: (p: {
    titulo: string;
    texto?: string;
    confirmar?: string;
    destrutivo?: boolean;
  }) => Promise<boolean>;
  primeiro: boolean;
  ultimo: boolean;
}) {
  const [valor, setValor] = useState(item.valor);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={suave}
      className={`${GRADE} items-center py-2.5 transition-colors hover:bg-surface-raised ${
        item.ativo ? "" : "opacity-55"
      }`}
    >
      <input
        defaultValue={item.nome}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== item.nome)
            void aoExecutar(() => RemuneracaoService.atualizarItem(item.id, { nome: v }));
        }}
        className="w-full border-b border-transparent bg-transparent text-[13px] text-foreground outline-none hover:border-border focus:border-primary"
      />
      <select
        defaultValue={item.servicoId ?? ""}
        onChange={(e) =>
          void aoExecutar(() =>
            RemuneracaoService.atualizarItem(item.id, { servicoId: e.target.value || undefined }),
          )
        }
        className="w-full cursor-pointer border-b border-transparent bg-transparent pb-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground outline-none hover:border-border focus:border-primary"
      >
        <option value="" className="bg-surface">
          avulso
        </option>
        {catalogo.map((sv) => (
          <option key={sv.id} value={sv.id} className="bg-surface">
            {sv.nome}
          </option>
        ))}
      </select>
      <input
        defaultValue={item.descricao}
        placeholder="—"
        onBlur={(e) => {
          if (e.target.value !== item.descricao)
            void aoExecutar(() =>
              RemuneracaoService.atualizarItem(item.id, { descricao: e.target.value }),
            );
        }}
        className="w-full border-b border-transparent bg-transparent text-[12px] text-muted-foreground outline-none hover:border-border focus:border-primary"
      />
      <select
        defaultValue={item.unidade}
        onChange={(e) =>
          void aoExecutar(() =>
            RemuneracaoService.atualizarItem(item.id, {
              unidade: e.target.value as UnidadeItem,
            }),
          )
        }
        className="w-full cursor-pointer border-b border-transparent bg-transparent pb-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground outline-none hover:border-border focus:border-primary"
      >
        <option value="fixo" className="bg-surface">
          fixo
        </option>
        <option value="km" className="bg-surface">
          por km
        </option>
      </select>
      <div className="text-right">
        <CampoMoeda
          valor={valor}
          aoAlterar={setValor}
          aoConfirmar={(v) => {
            if (v !== item.valor)
              void aoExecutar(() => RemuneracaoService.atualizarItem(item.id, { valor: v }));
          }}
        />
        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
          {dinheiroExato(item.valor)}
          {item.unidade === "km" ? " / km" : ""}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1">
        <IconeLinha
          rotulo="Subir"
          disabled={ocupado || primeiro}
          aoClicar={() => aoMover(-1)}
          icone={<ArrowUp className="size-3.5" />}
        />
        <IconeLinha
          rotulo="Descer"
          disabled={ocupado || ultimo}
          aoClicar={() => aoMover(1)}
          icone={<ArrowDown className="size-3.5" />}
        />
        <IconeLinha
          rotulo="Duplicar"
          disabled={ocupado}
          aoClicar={() =>
            void aoExecutar(() => RemuneracaoService.duplicarItem(item), "Linha duplicada.")
          }
          icone={<Copy className="size-3.5" />}
        />
        <button
          disabled={ocupado}
          onClick={() =>
            void aoExecutar(() => RemuneracaoService.atualizarItem(item.id, { ativo: !item.ativo }))
          }
          className={`press border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
            item.ativo
              ? "border-success/40 text-success"
              : "border-border-strong text-muted-foreground"
          }`}
        >
          {item.ativo ? "ativo" : "inativo"}
        </button>
        <IconeLinha
          rotulo="Remover"
          destrutivo
          disabled={ocupado}
          aoClicar={() => {
            void (async () => {
              const ok = await aoPedir({
                titulo: "Remover linha?",
                texto: `"${item.nome}" será excluída desta tabela.`,
                confirmar: "Remover",
                destrutivo: true,
              });
              if (!ok) return;
              await aoExecutar(() => RemuneracaoService.excluirItem(item.id), "Linha removida.");
            })();
          }}
          icone={<Trash2 className="size-3.5" />}
        />
      </div>
    </motion.li>
  );
}

function IconeLinha({
  rotulo,
  icone,
  aoClicar,
  disabled,
  destrutivo,
}: {
  rotulo: string;
  icone: React.ReactNode;
  aoClicar: () => void;
  disabled?: boolean;
  destrutivo?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      title={rotulo}
      aria-label={rotulo}
      disabled={disabled}
      onClick={aoClicar}
      className={`press border border-border-strong p-1.5 text-muted-foreground transition-colors disabled:opacity-35 ${
        destrutivo
          ? "hover:border-destructive hover:text-destructive"
          : "hover:border-primary hover:text-primary"
      }`}
    >
      {icone}
    </motion.button>
  );
}
