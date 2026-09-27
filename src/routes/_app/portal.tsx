import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Metrica, Pagina, Status, Vazio, suave } from "@/components/app/ui";
import { dinheiro, valorReceber } from "@/domain/services/financeiro";
import { useBanco, useSessao } from "@/lib/sessao";
import { LinhaTempoCaptura, PainelEvidencias } from "@/components/negocio/evidencias";
import { FinanceiroOrdem } from "@/components/negocio/financeiro-ordem";
import { AcoesOrdem } from "@/components/negocio/acoes-ordem";

import { itensDaLocadora, nomeServico } from "@/domain/services/catalogo";
import { LEGENDA_VISUAL, estadoVisual } from "@/domain/services/status-visual";
import {
  LINHA_PRAZO,
  ROTULO_PRAZO,
  TOM_PRAZO,
  diasRestantes,
  statusPrazo,
} from "@/domain/services/vistorias";
import { ROTULO_SITUACAO_MOTO } from "@/domain/types";
import { GaleriaVistoria } from "@/components/negocio/galeria-vistoria";
import { Selo } from "@/components/app/ui";

type Aba = "solicitacoes" | "motocicletas" | "financeiro";


export const Route = createFileRoute("/_app/portal")({
  head: () => ({
    meta: [
      { title: "Portal do cliente — Recolhe" },
      { name: "description", content: "Acompanhe em tempo real o andamento dos recolhimentos solicitados." },
      { property: "og:title", content: "Portal do cliente — Recolhe" },
      { property: "og:description", content: "Transparência total: status, evidências, valores e prazos por motocicleta." },
    ],
  }),
  validateSearch: (busca: Record<string, unknown>): { aba?: Aba } => {
    const valor = busca["aba"];
    return valor === "motocicletas" || valor === "financeiro" || valor === "solicitacoes"
      ? { aba: valor }
      : {};
  },
  component: Portal,
});

function Portal() {
  const banco = useBanco();
  const { usuario } = useSessao();
  const navegar = useNavigate({ from: "/portal" });
  const { aba = "solicitacoes" } = Route.useSearch();
  const setAba = (valor: Aba) => void navegar({ search: { aba: valor }, replace: true });
  const [aberta, setAberta] = useState<string | null>(null);

  const minhas = banco.ordens.filter((o) => o.locadoraId === usuario?.locadoraId);
  const loc = banco.locadoras.find((l) => l.id === usuario?.locadoraId);

  const abertas = minhas.filter((o) => o.status !== "concluida" && o.status !== "cancelada").length;
  const concluidas = minhas.filter((o) => o.status === "concluida");
  const total = concluidas.reduce((s, o) => s + valorReceber(banco, o), 0);
  const emAberto = concluidas
    .filter((o) => !o.recebimentoPago)
    .reduce((s, o) => s + valorReceber(banco, o), 0);
  const precos = usuario?.locadoraId ? itensDaLocadora(banco, usuario.locadoraId) : [];
  const frota = banco.motos.filter((m) => m.locadoraId === usuario?.locadoraId);
  const frotaAtiva = frota.filter((m) => m.situacao === "ativa").length;
  const idsFrota = new Set(frota.map((m) => m.id));
  const vistoriasFrota = banco.vistorias.filter((v) => idsFrota.has(v.motoId));
  const vistoriasAbertasFrota = vistoriasFrota.filter(
    (v) => v.status !== "concluida" && v.status !== "cancelada",
  ).length;
  const vistoriasFeitas = vistoriasFrota.filter((v) => v.status === "concluida").length;
  const prazos = frota.filter((m) => m.situacao === "ativa").map((m) => statusPrazo(m));
  const prazoVencidas = prazos.filter((p) => p === "vencida").length;
  const prazoProximas = prazos.filter((p) => p === "proxima").length;
  const taxas = banco.cancelamentos.filter(
    (c) => c.locadoraId === usuario?.locadoraId && c.valorCobranca > 0,
  );

  return (
    <Pagina titulo={loc?.nome ?? "Portal do cliente"} descricao="Acompanhamento das suas solicitações." fundo="minimal">
      <div className="grid gap-px bg-border sm:grid-cols-4">
        <Metrica rotulo="Solicitações" valor={minhas.length} nota="desde o início" />
        <Metrica rotulo="Em andamento" valor={abertas} nota="com a nossa operação" destaque />
        <Metrica rotulo="Recolhidas" valor={concluidas.length} nota="com evidências anexadas" />
        <Metrica rotulo="Em aberto" valor={dinheiro(emAberto)} nota={`faturado ${dinheiro(total)}`} />
      </div>

      <div className="mt-px grid gap-px bg-border sm:grid-cols-4">
        <Metrica rotulo="Motocicletas" valor={frota.length} nota={`${frotaAtiva} ativa(s)`} />
        <Metrica
          rotulo="Vistorias pendentes"
          valor={vistoriasAbertasFrota}
          nota="aguardando execução"
        />
        <Metrica rotulo="Vistorias concluídas" valor={vistoriasFeitas} nota="com laudo disponível" />
        <Metrica
          rotulo="Prazo de vistoria"
          valor={`${prazoVencidas} / ${prazoProximas}`}
          nota="vencidas / a vencer"
          destaque={prazoVencidas > 0}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border border-border bg-surface px-4 py-3">
        <span className="label-caps">Como ler o status</span>
        {LEGENDA_VISUAL.map((e) => (
          <span key={e.chave} className={`flex items-center gap-1.5 text-[12px] ${e.texto}`}>
            <span className="size-1.5 rounded-full bg-current" /> {e.rotulo}
          </span>
        ))}
      </div>


      <div className="mt-8 flex gap-px bg-border">
        {(
          [
            ["solicitacoes", "Solicitações"],
            ["motocicletas", "Minhas motocicletas"],
            ["financeiro", "Financeiro"],
          ] as [Aba, string][]
        ).map(([chave, rotulo]) => (
          <button
            key={chave}
            onClick={() => setAba(chave)}
            className={`press relative flex-1 bg-surface px-4 py-2.5 text-left text-[12px] uppercase tracking-[0.12em] transition-colors ${
              aba === chave ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {aba === chave && (
              <motion.span layoutId="aba-portal" transition={suave} className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />
            )}
            {rotulo}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={aba}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={suave}
          className="mt-6"
        >
          {aba === "solicitacoes" ? (
            minhas.length === 0 ? (
              <Vazio titulo="Nenhuma solicitação" texto="Importe a planilha de motocicletas para abrir os primeiros recolhimentos." />
            ) : (
              <ul className="space-y-px bg-border">
                {minhas.map((o, i) => {
                  const fotos = banco.fotos.filter((f) => f.ordemId === o.id).length;
                  const visual = estadoVisual(o);
                  return (
                    <motion.li
                      key={o.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...suave, delay: Math.min(i, 8) * 0.04 }}
                      className={`border-l-4 bg-surface transition-colors duration-500 ${visual.barra} ${visual.fundo}`}
                    >
                      <div className="flex items-center gap-2 pr-3">

                        <Link
                          to="/ordens/$id"
                          params={{ id: o.id }}
                          className="press flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-raised"
                        >
                          <span className="font-mono text-[14px] text-primary">{o.placa}</span>
                          <span className="text-[13px] text-foreground">{o.marca} {o.modelo}</span>
                          <span className="text-[12px] text-muted-foreground">{o.cidade}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{fotos} foto(s)</span>
                          {valorReceber(banco, o) > 0 && (
                            <span className="font-mono text-[12px] text-foreground">
                              {dinheiro(valorReceber(banco, o))}
                            </span>
                          )}
                          {(() => {
                            const c = banco.cancelamentos.find((x) => x.ordemId === o.id);
                            return c && c.valorCobranca > 0 ? (
                              <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-destructive">
                                taxa {c.percentual}% · {dinheiro(c.valorCobranca)}
                              </span>
                            ) : null;
                          })()}
                          <span className="ml-auto flex items-center gap-3">
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={visual.chave}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.28 }}
                                className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${visual.texto}`}
                              >
                                <span className="size-2 rounded-full bg-current" />
                                {visual.rotulo}
                              </motion.span>
                            </AnimatePresence>
                            <Status valor={o.status} />
                          </span>

                        </Link>
                        <AcoesOrdem ordem={o} />
                      </div>
                      <button
                        onClick={() => setAberta((atual) => (atual === o.id ? null : o.id))}
                        className="press w-full border-t border-border px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
                        aria-expanded={aberta === o.id}
                      >
                        {aberta === o.id ? "ocultar linha do tempo" : "ver linha do tempo e evidências"}
                      </button>

                      <AnimatePresence initial={false}>
                        {aberta === o.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={suave}
                            className="overflow-hidden"
                          >
                            <div className="grid gap-px bg-border p-px lg:grid-cols-2">
                              <PainelEvidencias ordem={o} />
                              <FinanceiroOrdem ordem={o} podeEditar={false} />
                              <LinhaTempoCaptura ordem={o} />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  );
                })}
              </ul>
            )
          ) : aba === "motocicletas" ? (
            <MinhasMotos />
          ) : concluidas.length === 0 && taxas.length === 0 ? (
            <Vazio titulo="Sem faturamento" texto="Os valores aparecem aqui assim que os recolhimentos forem concluídos." />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <section className="border border-border">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="label-caps">Recolhimentos faturados</p>
                </div>
                <ul className="divide-y divide-border">
                  {concluidas.map((o, i) => (
                    <motion.li
                      key={o.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...suave, delay: Math.min(i, 10) * 0.03 }}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
                    >
                      <Link to="/ordens/$id" params={{ id: o.id }} className="font-mono text-[13px] text-primary hover:underline">
                        {o.placa}
                      </Link>
                      <span className="text-[12px] text-muted-foreground">{nomeServico(banco, o)}</span>
                      <span className="font-mono text-[13px] text-foreground">{dinheiro(valorReceber(banco, o))}</span>
                      <span
                        className={`ml-auto border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${
                          o.recebimentoPago ? "border-success/40 text-success" : "border-border-strong text-muted-foreground"
                        }`}
                      >
                        {o.recebimentoPago ? "pago" : "em aberto"}
                      </span>
                    </motion.li>
                  ))}
                </ul>
                {taxas.length > 0 && (
                  <>
                    <div className="border-y border-border px-4 py-2.5">
                      <p className="label-caps">Taxas de cancelamento</p>
                    </div>
                    <ul className="divide-y divide-border">
                      {taxas.map((c) => {
                        const ordem = minhas.find((o) => o.id === c.ordemId);
                        return (
                          <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                            <Link
                              to="/ordens/$id"
                              params={{ id: c.ordemId }}
                              className="font-mono text-[13px] text-primary hover:underline"
                            >
                              {ordem?.placa ?? "—"}
                            </Link>
                            <span className="text-[12px] text-muted-foreground">
                              cancelada após início do deslocamento · {c.percentual}% de{" "}
                              {dinheiro(c.valorOriginal)}
                            </span>
                            <span className="ml-auto font-mono text-[13px] text-destructive">
                              {dinheiro(c.valorCobranca)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>

              <section className="border border-border">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="label-caps">Sua tabela de preços</p>
                </div>
                <ul className="divide-y divide-border">
                  {precos.length === 0 && (
                    <li className="px-4 py-3 text-[13px] text-muted-foreground">
                      Nenhuma tabela de preços vinculada à sua conta.
                    </li>
                  )}
                  {precos.map((i) => (
                    <li key={i.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[13px] text-muted-foreground">{i.nome}</span>
                      <span className="font-mono text-[13px] text-foreground">
                        {dinheiro(i.valor)}
                        {i.unidade === "km" ? " / km" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Pagina>
  );
}

/** Frota da locadora — cada moto abre a própria ficha com histórico e evidências. */
function MinhasMotos() {
  const banco = useBanco();
  const { usuario } = useSessao();
  const [busca, setBusca] = useState("");

  const frota = banco.motos
    .filter((m) => m.locadoraId === usuario?.locadoraId)
    .filter((m) =>
      `${m.placa} ${m.marca} ${m.modelo}`.toLowerCase().includes(busca.trim().toLowerCase()),
    )
    .sort((a, b) => a.placa.localeCompare(b.placa));

  if (banco.motos.filter((m) => m.locadoraId === usuario?.locadoraId).length === 0) {
    return (
      <Vazio
        titulo="Nenhuma motocicleta"
        texto="Assim que a central cadastrar suas motos elas aparecem aqui com histórico e vistorias."
      />
    );
  }

  return (
    <div>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por placa, marca ou modelo"
        aria-label="Buscar motocicleta"
        className="mb-4 w-full border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-primary"
      />

      {frota.length === 0 ? (
        <Vazio compacto titulo="Nada encontrado" texto="Ajuste a busca para ver outras motos." />
      ) : (
        <ul className="grid gap-px bg-border">
          {frota.map((m) => {
            const prazo = statusPrazo(m);
            const dias = diasRestantes(m);
            const vistorias = banco.vistorias.filter((v) => v.motoId === m.id);
            const fotos = banco.evidenciasVistoria
              .filter((e) => e.motoId === m.id)
              .sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
              .slice(0, 6);
            return (
              <li key={m.id} className={`bg-surface ${LINHA_PRAZO[prazo]}`}>
                <Link
                  to="/moto/$id"
                  params={{ id: m.id }}
                  className="press flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-raised"
                >
                  <span className="font-mono text-[14px] text-primary">{m.placa}</span>
                  <span className="text-[13px] text-foreground">
                    {m.marca} {m.modelo}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {ROTULO_SITUACAO_MOTO[m.situacao]}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {vistorias.length} vistoria(s)
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <Selo tom={TOM_PRAZO[prazo]}>{ROTULO_PRAZO[prazo]}</Selo>
                    {dias !== null && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {dias} dia(s)
                      </span>
                    )}
                  </span>
                </Link>
                <div className="border-t border-border px-4 py-3">
                  <p className="label-caps mb-2">
                    Fotos das vistorias{fotos.length > 0 ? ` (${fotos.length} mais recentes)` : ""}
                  </p>
                  <GaleriaVistoria
                    fotos={fotos}
                    compacta
                    vazioTexto="Esta motocicleta ainda não possui fotos de vistoria."
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
