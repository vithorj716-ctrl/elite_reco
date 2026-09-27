import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  ClipboardPaste,
  Copy,
  ScanLine,
  Trash2,
} from "lucide-react";
import { Botao, Modal, Pagina, Vazio } from "@/components/app/ui";
import { Entrada, Grade, Selecao } from "@/components/negocio/formulario";
import { EASE } from "@/lib/animacao";
import { useBanco, useSessao, useSincronizar } from "@/lib/sessao";
import {
  criarSolicitacoes,
  conferirHistoricoDaPlaca,
  encontrarDuplicidade,
  interpretar,
  type Duplicidade,
} from "@/services/importador.service";
import { OrdensService } from "@/services/ordens.service";
import { CAMPOS_CONFERENCIA, type ItemImportado } from "@/domain/types/importacao";
import { ROTULO_PRIORIDADE, type Prioridade } from "@/domain/types";
import { servicosDaLocadora } from "@/domain/services/catalogo";

export const Route = createFileRoute("/_app/importador")({
  head: () => ({
    meta: [
      { title: "Importador inteligente — Recolhe" },
      {
        name: "description",
        content:
          "Cole a mensagem do WhatsApp e o sistema interpreta com IA, confere os dados e cria as solicitações de recolhimento.",
      },
      { property: "og:title", content: "Importador inteligente — Recolhe" },
      {
        property: "og:description",
        content: "Interpretação automática de mensagens em solicitações de recolhimento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Importador,
});

const PRIORIDADES: Prioridade[] = ["baixa", "normal", "alta", "urgente"];

function Importador() {
  const banco = useBanco();
  const { usuario } = useSessao();
  const sincronizar = useSincronizar();
  const navegar = useNavigate();

  const locadoraFixa = usuario?.papel === "cliente" ? (usuario.locadoraId ?? "") : "";
  const locadorasVisiveis = useMemo(
    () => (locadoraFixa ? banco.locadoras.filter((l) => l.id === locadoraFixa) : banco.locadoras),
    [banco.locadoras, locadoraFixa],
  );

  const [texto, setTexto] = useState("");
  const [itens, setItens] = useState<ItemImportado[] | null>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [conflito, setConflito] = useState<{ indice: number; dup: Duplicidade } | null>(null);

  async function colar() {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) {
        setTexto(t);
        toast.success("Mensagem colada da área de transferência.");
      }
    } catch {
      toast.error("Permita o acesso à área de transferência ou cole manualmente.");
    }
  }

  async function analisar() {
    if (!texto.trim()) return;
    setLendo(true);
    try {
      const r = await interpretar(texto, banco.locadoras, banco.apelidos, locadoraFixa);
      const prontos = r.itens.map((i) => ({ ...i, locadoraId: locadoraFixa || i.locadoraId }));
      setItens(prontos);
      if (r.aviso) toast.warning(r.aviso);
      toast.success(
        `${prontos.length} solicitação(ões) identificada(s). Confira antes de salvar.`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLendo(false);
    }
  }

  function alterar(indice: number, chave: keyof ItemImportado, valor: string) {
    setItens((atual) =>
      (atual ?? []).map((item, i) =>
        i === indice
          ? {
              ...item,
              [chave]: valor,
              faltantes: item.faltantes.filter((c) => c !== chave || !valor.trim()),
            }
          : item,
      ),
    );
  }

  function remover(indice: number) {
    setItens((atual) => (atual ?? []).filter((_, i) => i !== indice));
  }

  async function confirmar() {
    const lista = itens ?? [];
    if (lista.length === 0) return;

    const semLocadora = lista.find((i) => !i.locadoraId);
    if (semLocadora) {
      toast.error("Selecione a locadora de cada solicitação antes de salvar.");
      return;
    }

    // Nenhuma ordem entra na fila com campo obrigatório em branco: sem isso a
    // operação recebe registros com "SEM PLACA"/"—" indistinguíveis de dados reais.
    const incompletos = lista
      .map((item, i) => ({ i, faltantes: item.faltantes }))
      .filter((r) => r.faltantes.length > 0);
    if (incompletos.length > 0) {
      const detalhe = incompletos
        .slice(0, 3)
        .map((r) => `#${r.i + 1}: ${r.faltantes.join(", ")}`)
        .join(" · ");
      toast.error(`Complete os campos obrigatórios antes de salvar — ${detalhe}`);
      return;
    }

    for (const [indice, item] of lista.entries()) {
      const dup = encontrarDuplicidade(item, banco.ordens);
      if (dup) {
        setConflito({ indice, dup });
        return;
      }
    }

    await salvar(lista);
  }

  async function salvar(lista: ItemImportado[]) {
    setSalvando(true);
    try {
      const criadas = await criarSolicitacoes(lista, {
        autor: usuario?.nome ?? "Operador",
        textoOrigem: texto,
      });
      await sincronizar(["ordens", "importacoes"]);
      setItens(null);
      setTexto("");
      toast.success(`${criadas.length} solicitação(ões) criada(s) na fila.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarExistente(dup: Duplicidade, item: ItemImportado) {
    setSalvando(true);
    try {
      await OrdensService.registrarHistorico(
        dup.ordem.id,
        usuario?.nome ?? "Operador",
        "Nova mensagem recebida para esta ocorrência",
        item.resumo || texto.slice(0, 400),
      );
      await sincronizar(["ordens", "ordem_historico"]);
      setConflito(null);
      setItens((atual) => (atual ?? []).filter((i) => i !== item));
      toast.success(`Ocorrência ${dup.ordem.codigo} atualizada com a nova mensagem.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Pagina
      titulo="Importador inteligente"
      descricao="Cole qualquer mensagem — WhatsApp, e-mail, PDF ou planilha. A IA interpreta, você confere e o sistema cria as solicitações."
      acoes={
        itens && itens.length > 0 ? (
          <Botao variante="solido" onClick={confirmar} carregando={salvando}>
            Confirmar {itens.length} solicitação(ões)
          </Botao>
        ) : null
      }
    >
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="border border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <ScanLine className="size-3.5 text-primary" aria-hidden />
            <p className="label-caps">Mensagem recebida</p>
            <button
              onClick={colar}
              className="press ml-auto flex items-center gap-1.5 border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
            >
              <ClipboardPaste className="size-3" aria-hidden /> colar
            </button>
          </div>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={18}
            spellCheck={false}
            placeholder={"Cole aqui a mensagem…\n\nEx.: Moto da Liberta 🏍️ Placa ABC1D23 Honda CG 160 vermelha\nLocatário João da Silva (11) 98888-7777 CPF 123.456.789-00\nHost 8620000123 PIN 4477 — cliente inadimplente, não atende\nRua das Palmeiras 200, Centro, Campinas/SP"}
            className="w-full resize-y bg-transparent px-4 py-3 font-mono text-[12px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          <div className="flex items-center gap-3 border-t border-border px-4 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {texto.trim() ? `${texto.trim().length} caracteres` : "aguardando texto"}
            </p>
            <Botao variante="solido" tamanho="sm" className="ml-auto" onClick={analisar} carregando={lendo}>
              <Brain className="size-3.5" aria-hidden /> Interpretar
            </Botao>
          </div>
        </section>

        <section className="min-w-0">
          {lendo && <EsqueletoConferencia />}

          {!lendo && !itens && (
            <Vazio
              titulo="Nada interpretado ainda"
              texto="Cole a mensagem ao lado e clique em interpretar. Mensagens com várias motos viram uma solicitação para cada uma."
            />
          )}

          {!lendo && itens && itens.length === 0 && (
            <Vazio
              titulo="Nenhuma moto identificada"
              texto="Revise o texto colado — não encontramos dados suficientes para abrir uma solicitação."
            />
          )}

          <motion.div layout className="flex flex-col gap-5">
            <AnimatePresence initial={false}>
              {(itens ?? []).map((item, indice) => (
                <motion.article
                  key={`${item.placa}-${indice}`}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.34, ease: EASE, delay: indice * 0.05 }}
                  className="border border-border"
                >
                  <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
                    <p className="label-caps">Solicitação {indice + 1}</p>
                    <span className="font-mono text-[13px] text-primary">
                      {item.placa || "sem placa"}
                    </span>
                    {item.faltantes.length > 0 && (
                      <span className="flex items-center gap-1 border border-primary/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-primary">
                        <AlertTriangle className="size-3" aria-hidden /> {item.faltantes.length} campo(s) faltando
                      </span>
                    )}
                    <button
                      onClick={() => remover(indice)}
                      className="press ml-auto flex items-center gap-1.5 border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3" aria-hidden /> descartar
                    </button>
                  </header>

                  <AvisoHistoricoPlaca item={item} />

                  <div className="px-4 py-4">
                    <Grade>
                      <Selecao
                        rotulo="Locadora"
                        value={item.locadoraId}
                        disabled={Boolean(locadoraFixa)}
                        onChange={(e) => alterar(indice, "locadoraId", e.target.value)}
                        opcoes={[
                          { valor: "", rotulo: "— selecione —" },
                          ...locadorasVisiveis.map((l) => ({ valor: l.id, rotulo: l.nome })),
                        ]}
                        {...(item.locadoraTexto
                          ? { dica: `Reconhecida no texto: ${item.locadoraTexto}` }
                          : {})}
                      />
                      <Selecao
                        rotulo="Prioridade"
                        value={item.prioridade}
                        onChange={(e) => alterar(indice, "prioridade", e.target.value)}
                        opcoes={PRIORIDADES.map((p) => ({ valor: p, rotulo: ROTULO_PRIORIDADE[p] }))}
                      />
                      <Selecao
                        rotulo="Serviço"
                        value={item.servicoId}
                        onChange={(e) => alterar(indice, "servicoId", e.target.value)}
                        opcoes={[
                          { valor: "", rotulo: "— selecione —" },
                          ...servicosDaLocadora(banco, item.locadoraId).map((s) => ({
                            valor: s.id,
                            rotulo: s.nome,
                          })),
                        ]}
                        dica={
                          item.locadoraId
                            ? "Serviços da tabela vinculada a esta locadora."
                            : "Escolha a locadora para listar os serviços."
                        }
                      />
                      <Entrada
                        rotulo="Valor pendente"
                        value={String(item.valorPendente || "")}
                        onChange={(e) => alterar(indice, "valorPendente", e.target.value)}
                        inputMode="decimal"
                      />

                      {CAMPOS_CONFERENCIA.map((campo) => {
                        const faltando = item.faltantes.includes(campo.chave);
                        return (
                          <Entrada
                            key={campo.chave}
                            rotulo={campo.rotulo}
                            value={String(item[campo.chave] ?? "")}
                            onChange={(e) => alterar(indice, campo.chave, e.target.value)}
                            className={faltando ? "border-primary/60 text-primary" : undefined}
                            {...(faltando ? { dica: "não encontrado na mensagem" } : {})}
                          />
                        );
                      })}
                    </Grade>

                    {item.resumo && (
                      <div className="mt-4 border-l-2 border-primary bg-surface px-3 py-2.5">
                        <p className="label-caps mb-1">Resumo operacional</p>
                        <p className="whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">
                          {item.resumo}
                        </p>
                      </div>
                    )}
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        </section>
      </div>

      <Modal
        aberto={!!conflito}
        aoFechar={() => setConflito(null)}
        titulo="Ocorrência já existente"
        largura="max-w-lg"
        rodape={
          conflito ? (
            <>
              <Botao
                variante="linha"
                tamanho="sm"
                onClick={() => {
                  const id = conflito.dup.ordem.id;
                  setConflito(null);
                  void navegar({ to: "/ordens/$id", params: { id } });
                }}
              >
                Abrir existente
              </Botao>
              <Botao
                variante="linha"
                tamanho="sm"
                carregando={salvando}
                onClick={() => void atualizarExistente(conflito.dup, (itens ?? [])[conflito.indice]!)}
              >
                Atualizar existente
              </Botao>
              <Botao
                variante="solido"
                tamanho="sm"
                carregando={salvando}
                onClick={() => {
                  const lista = itens ?? [];
                  setConflito(null);
                  void salvar(lista);
                }}
              >
                Criar mesmo assim
              </Botao>
            </>
          ) : null
        }
      >
        {conflito && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Já existe uma ocorrência aberta com o mesmo{" "}
            <span className="text-foreground">{conflito.dup.campo}</span>:{" "}
            <span className="font-mono text-primary">{conflito.dup.ordem.codigo}</span> ·{" "}
            {conflito.dup.ordem.placa} · {conflito.dup.ordem.cidade}. O que deseja fazer?
          </p>
        )}
      </Modal>
    </Pagina>
  );
}

/**
 * Aviso — nunca bloqueio. A mesma placa pode ter vários recolhimentos; o
 * operador só é informado quando os dados divergem do último registro.
 */
function AvisoHistoricoPlaca({ item }: { item: ItemImportado }) {
  const banco = useBanco();
  const historico = useMemo(
    () => conferirHistoricoDaPlaca(item, banco.ordens),
    [item, banco.ordens],
  );
  if (!historico) return null;

  return (
    <div className="border-b border-border bg-surface px-4 py-2.5">
      <p className="text-[12px] text-muted-foreground">
        Esta placa já possui{" "}
        <span className="text-foreground">{historico.total} operação(ões) anterior(es)</span> — a
        nova captura é registrada de forma independente, sem alterar o histórico.{" "}
        <Link
          to="/ordens/$id"
          params={{ id: historico.ordem.id }}
          className="text-primary underline-offset-2 hover:underline"
        >
          ver {historico.ordem.codigo}
        </Link>
      </p>
      {historico.diferencas.length > 0 && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-warning">
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          Esta placa já possui registros anteriores com informações diferentes:{" "}
          {historico.diferencas
            .map((d) => `${d.campo}: ${d.anterior} → ${d.novo}`)
            .join(" · ")}
          . Revise os dados ao lado ou continue mesmo assim.
        </p>
      )}
    </div>
  );
}

function EsqueletoConferencia() {
  return (
    <div className="flex flex-col gap-5" role="status" aria-live="polite">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border border-border" style={{ opacity: 1 - i * 0.25 }}>
          <div className="h-10 animate-pulse border-b border-border bg-surface" />
          <div className="grid gap-px bg-border p-px sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((__, k) => (
              <div
                key={k}
                className="h-14 animate-pulse bg-surface"
                style={{ animationDelay: `${k * 60}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
