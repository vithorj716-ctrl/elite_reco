import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Metrica, Pagina, Status, Vazio, suave } from "@/components/app/ui";
import {
  contasAPagar,
  contasAReceber,
  custosPorCidade,
  custosPorLocadora,
  dinheiro,
  pagamentosRealizados,
  rankingAgentes,
  resumoFinanceiro,
  valorReceber,
} from "@/domain/services/financeiro";
import { useBanco } from "@/lib/sessao";
import { ROTULO_STATUS, type StatusOrdem } from "@/domain/types";
import { catalogoAtivo, nomeServico, servicoDaOrdem } from "@/domain/services/catalogo";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Recolhe" },
      { name: "description", content: "Relatórios operacionais, financeiros, por cliente e por agente." },
      { property: "og:title", content: "Relatórios — Recolhe" },
      { property: "og:description", content: "Produtividade, cidades, status, faturamento e margem da operação." },
    ],
  }),
  component: Relatorios,
});

function Relatorios() {
  const banco = useBanco();
  const resumo = resumoFinanceiro(banco);

  const dados = useMemo(() => {
    const porStatus = ([
      "pendente_definicao",
      "liberada",
      "distribuida",
      "em_andamento",
      "concluida",
      "cancelada",
    ] as StatusOrdem[]).map(
      (s) => ({ rotulo: ROTULO_STATUS[s], total: banco.ordens.filter((o) => o.status === s).length }),
    );

    const cidades = new Map<string, number>();
    banco.ordens.forEach((o) => cidades.set(o.cidade || "—", (cidades.get(o.cidade || "—") ?? 0) + 1));

    const servicos = catalogoAtivo(banco).map((s) => ({
      rotulo: s.nome,
      total: banco.ordens.filter((o) => servicoDaOrdem(banco, o)?.id === s.id).length,
    }));

    const clientes = banco.locadoras.map((l) => {
      const ordens = banco.ordens.filter((o) => o.locadoraId === l.id);
      const concluidas = ordens.filter((o) => o.status === "concluida");
      return {
        nome: l.nome,
        total: ordens.length,
        concluidas: concluidas.length,
        // inclui taxas de cancelamento — o relatório usa a mesma soma do financeiro
        valor: ordens.reduce((s, o) => s + valorReceber(banco, o), 0),
      };
    });

    return {
      porStatus,
      cidades: [...cidades.entries()].sort((a, b) => b[1] - a[1]),
      servicos,
      clientes,
    };
  }, [banco]);

  const semDados = banco.ordens.length === 0;

  return (
    <Pagina titulo="Relatórios" descricao="Consolidação operacional, financeira, por cliente e por agente.">
      <PesquisaOrdens />
      {semDados ? (
        <Vazio
          titulo="Ainda não há dados"
          texto="Os relatórios são montados a partir das ordens importadas e executadas em campo."
        />
      ) : (
        <>
          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
            <Metrica rotulo="Ordens totais" valor={banco.ordens.length} nota="desde o início" destaque />
            <Metrica rotulo="Faturamento" valor={dinheiro(resumo.receita)} nota="contas a receber" />
            <Metrica rotulo="Custo de campo" valor={dinheiro(resumo.despesa)} nota="repasse aos agentes" />
            <Metrica rotulo="Margem" valor={`${(resumo.margem * 100).toFixed(1)}%`} nota="lucro sobre receita" />
          </div>

          <div className="mt-px grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
            <Metrica rotulo="Serviços" valor={dinheiro(resumo.servicos)} nota="recolhimentos concluídos" />
            <Metrica rotulo="Taxas de cancelamento" valor={dinheiro(resumo.taxas)} nota={`${dinheiro(resumo.taxasPendentes)} a faturar`} />
            <Metrica rotulo="Cobranças adicionais" valor={dinheiro(resumo.adicionais)} nota="lançadas nas fichas" />
            <Metrica rotulo="Em aberto" valor={dinheiro(resumo.pendente)} nota={`${dinheiro(resumo.faturado)} recebido`} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <Quadro titulo="Ordens por status" itens={dados.porStatus.map((s) => [s.rotulo, String(s.total)])} />
            <Quadro titulo="Ordens por tipo de serviço" itens={dados.servicos.map((s) => [s.rotulo, String(s.total)])} />
            <Quadro titulo="Ordens por cidade" itens={dados.cidades.map(([c, n]) => [c, String(n)])} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Quadro
              titulo="Clientes"
              itens={dados.clientes.map((c) => [
                `${c.nome} · ${c.concluidas}/${c.total}`,
                dinheiro(c.valor),
              ])}
            />
            <Quadro
              titulo="Agentes"
              itens={contasAPagar(banco).map((a) => [`${a.nome} · ${a.quantidade} captura(s)`, dinheiro(a.total)])}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Quadro
              titulo="Agentes que mais produziram"
              itens={rankingAgentes(banco)
                .slice(0, 10)
                .map((r) => [`${r.agente.nome} · ${r.concluidas} ordem(ns)`, dinheiro(r.produzido)])}
            />
            <Quadro
              titulo="Maior saldo pendente"
              itens={[...rankingAgentes(banco)]
                .sort((a, b) => b.pendente - a.pendente)
                .filter((r) => r.pendente > 0)
                .map((r) => [r.agente.nome, dinheiro(r.pendente)])}
            />
            <Quadro
              titulo="Pagamentos realizados"
              itens={pagamentosRealizados(banco)
                .slice(0, 10)
                .map((p) => [
                  `${p.agente} · ${new Date(p.data).toLocaleDateString("pt-BR")}`,
                  dinheiro(p.valor),
                ])}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Quadro
              titulo="Custos por locadora"
              itens={custosPorLocadora(banco).map((l) => [
                `${l.nome} · custo ${dinheiro(l.custo)}`,
                dinheiro(l.lucro),
              ])}
            />
            <Quadro
              titulo="Custos por cidade"
              itens={custosPorCidade(banco).map((c) => [
                `${c.cidade} · custo ${dinheiro(c.custo)}`,
                dinheiro(c.lucro),
              ])}
            />
            <Quadro
              titulo="Contas a receber em aberto"
              itens={contasAReceber(banco).map((l) => [l.nome, dinheiro(l.aberto)])}
            />
          </div>
        </>
      )}
    </Pagina>
  );
}

/** Chave de comparação: ignora pontuação, espaços e caixa. */
const chave = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, "");

/**
 * Pesquisa operacional detalhada por placa, locadora e locatário (o cliente
 * registrado na ordem). A placa é normalizada apenas para comparar — o valor
 * gravado na ordem nunca é alterado.
 */
function PesquisaOrdens() {
  const banco = useBanco();
  const [termo, setTermo] = useState("");
  const [locadoraId, setLocadoraId] = useState("todas");

  const resultados = useMemo(() => {
    const t = chave(termo);
    const texto = termo.trim().toLowerCase();
    if (!t && locadoraId === "todas") return [];
    return banco.ordens
      .filter((o) => (locadoraId === "todas" ? true : o.locadoraId === locadoraId))
      .filter((o) => {
        if (!t) return true;
        const loc = banco.locadoras.find((l) => l.id === o.locadoraId);
        return (
          chave(o.placa).includes(t) ||
          chave(o.codigo).includes(t) ||
          (o.locatario ?? "").toLowerCase().includes(texto) ||
          (o.cpf ? chave(o.cpf).includes(t) : false) ||
          (loc?.nome ?? "").toLowerCase().includes(texto)
        );
      })
      .sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1))
      .slice(0, 20);
  }, [banco.ordens, banco.locadoras, termo, locadoraId]);

  const data = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

  return (
    <section className="mt-6 border border-border">
      <div className="border-b border-border px-4 py-2.5">
        <p className="label-caps">Pesquisa por placa, locadora ou cliente</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <label className="flex min-h-9 flex-1 items-center gap-2 border border-border px-3 py-1.5 focus-within:border-primary">
          <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="ABC1D23, ABC-1D23, código, cliente ou locadora"
            aria-label="Pesquisar ordem"
            className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
        </label>
        <select
          value={locadoraId}
          onChange={(e) => setLocadoraId(e.target.value)}
          aria-label="Filtrar por locadora"
          className="campo w-full sm:w-auto"
        >
          <option value="todas">Todas as locadoras</option>
          {banco.locadoras.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
      </div>

      {!termo.trim() && locadoraId === "todas" ? (
        <p className="px-4 py-5 text-[13px] text-muted-foreground">
          Digite a placa com ou sem formatação para abrir a ocorrência completa.
        </p>
      ) : resultados.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-muted-foreground">
          Nenhuma ordem encontrada para esta pesquisa.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {resultados.map((o) => {
            const loc = banco.locadoras.find((l) => l.id === o.locadoraId);
            const ag = banco.agentes.find((a) => a.id === o.agenteId);
            const campos: [string, string][] = [
              ["Placa", o.placa],
              ["Código", o.codigo],
              ["Locadora", loc?.nome ?? "—"],
              ["Cliente / locatário", o.locatario || "—"],
              ["Telefone", o.telefone || "—"],
              ["Motocicleta", `${o.marca} ${o.modelo} ${o.ano}`.trim() || "—"],
              ["Cidade", o.cidade || "—"],
              ["Agente atual", ag?.nome ?? "sem agente"],
              ["Status", ROTULO_STATUS[o.status]],
              ["Prioridade", o.prioridade],
              ["Serviço", nomeServico(banco, o) || "—"],
              ["Criada em", data(o.criadaEm)],
              ["Distribuída em", data(o.distribuidaEm)],
              ["Iniciada em", data(o.iniciadaEm)],
              ["Chegada em", data(o.chegadaEm)],
              ["Concluída em", data(o.concluidaEm)],
            ];
            return (
              <li key={o.id} className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[14px] text-foreground">{o.placa}</span>
                  <Status valor={o.status} />
                  <Link
                    to="/ordens/$id"
                    params={{ id: o.id }}
                    className="press ml-auto inline-flex items-center gap-1.5 border border-primary/50 px-3 py-1.5 text-[12.5px] text-primary hover:bg-primary/10"
                  >
                    Abrir ficha completa <ArrowUpRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                  {campos.map(([k, v]) => (
                    <div key={k} className="bg-surface px-3 py-2">
                      <dt className="label-caps">{k}</dt>
                      <dd className="mt-0.5 truncate text-[12.5px] text-foreground" title={v}>
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  As transferências entre agentes ficam registradas no histórico da ficha — este
                  campo mostra apenas o responsável atual.
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Quadro({ titulo, itens }: { titulo: string; itens: [string, string][] }) {
  return (
    <section className="border border-border">
      <div className="border-b border-border px-4 py-2.5">
        <p className="label-caps">{titulo}</p>
      </div>
      {itens.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-muted-foreground">Sem registros.</p>
      ) : (
        <ul className="divide-y divide-border">
          {itens.map(([rotulo, valor], i) => (
            <motion.li
              key={rotulo + i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...suave, delay: Math.min(i, 10) * 0.03 }}
              className="flex items-center justify-between gap-4 px-4 py-2.5"
            >
              <span className="truncate text-[13px] text-muted-foreground">{rotulo}</span>
              <span className="font-mono text-[13px] text-foreground">{valor}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
