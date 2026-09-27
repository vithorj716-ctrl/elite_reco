import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ListChecks, UsersRound } from "lucide-react";
import { ItemLista, Lista, Metrica, Pagina, Status, Vazio } from "@/components/app/ui";

import { dinheiro, resumoFinanceiro } from "@/domain/services/financeiro";
import { podeReceberOrdem } from "@/domain/services/presenca";
import { useBanco } from "@/lib/sessao";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel operacional — Recolhe" },
      { name: "description", content: "Indicadores diários da operação de recolhimento de motocicletas." },
      { property: "og:title", content: "Painel operacional — Recolhe" },
      { property: "og:description", content: "Pendentes, em atendimento, recolhidas hoje e produtividade dos agentes." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const banco = useBanco();

  const dados = useMemo(() => {
    const hoje = new Date().toDateString();
    const pendentes = banco.ordens.filter(
      (o) => o.status === "pendente_definicao" || o.status === "liberada",
    ).length;
    const andamento = banco.ordens.filter((o) => o.status === "em_andamento" || o.status === "distribuida").length;
    const hojeConcluidas = banco.ordens.filter(
      (o) => o.concluidaEm && new Date(o.concluidaEm).toDateString() === hoje,
    ).length;
    const online = banco.agentes.filter((a) => podeReceberOrdem(banco, a)).length;

    const porDia = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const rotulo = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const total = banco.ordens.filter(
        (o) => o.concluidaEm && new Date(o.concluidaEm).toDateString() === d.toDateString(),
      ).length;
      return { dia: rotulo, recolhidas: total };
    });

    const ranking = banco.agentes
      .map((a) => ({
        nome: a.nome,
        total: banco.ordens.filter((o) => o.agenteId === a.id && o.status === "concluida").length,
        online: podeReceberOrdem(banco, a),
      }))
      .sort((x, y) => y.total - x.total);

    return { pendentes, andamento, hojeConcluidas, online, porDia, ranking };
  }, [banco]);

  const recentes = [...banco.ordens]
    .sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1))
    .slice(0, 6);

  const fin = resumoFinanceiro(banco);

  return (
    <Pagina titulo="Painel operacional" descricao="Situação da operação em tempo real." fundo="dashboard">
      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="Motos pendentes" valor={dados.pendentes} nota="aguardando distribuição" destaque />
        <Metrica rotulo="Em atendimento" valor={dados.andamento} nota="com agentes em campo" />
        <Metrica rotulo="Recolhidas hoje" valor={dados.hojeConcluidas} nota="ordens finalizadas" />
        <Metrica rotulo="Agentes disponíveis" valor={`${dados.online}/${banco.agentes.length}`} nota="online, conectados e livres" />
      </div>

      <div className="mt-px grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        <Metrica rotulo="A receber" valor={dinheiro(fin.receita)} nota={`${dinheiro(fin.taxas)} em taxas`} />
        <Metrica rotulo="Pendente" valor={dinheiro(fin.pendente)} nota={`${dinheiro(fin.faturado)} já recebido`} />
        <Metrica rotulo="A pagar a agentes" valor={dinheiro(fin.aPagarAgentes)} nota="repasse de campo" />
        <Metrica rotulo="Lucro" valor={dinheiro(fin.lucro)} nota={`margem ${(fin.margem * 100).toFixed(1)}%`} destaque />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="border border-border bg-surface p-5">
          <p className="label-caps">Recolhimentos concluídos · 7 dias</p>
          <div className="mt-5 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.porDia} margin={{ left: -22, right: 4 }}>
                <CartesianGrid stroke="oklch(1 0 0 / 6%)" vertical={false} />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "oklch(0.66 0.008 285)" }} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "oklch(0.66 0.008 285)" }} />
                <Tooltip
                  cursor={{ fill: "oklch(1 0 0 / 4%)" }}
                  contentStyle={{
                    background: "oklch(0.222 0.005 285)",
                    border: "1px solid oklch(0.3 0.005 285)",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="recolhidas" fill="var(--primary)" radius={[2, 2, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="border border-border bg-surface p-5">
          <p className="label-caps">Ranking de agentes</p>
          {dados.ranking.length === 0 ? (
            <div className="mt-4">
              <Vazio
                compacto
                icone={UsersRound}
                titulo="Sem agentes ativos"
                texto="Cadastre agentes de campo para acompanhar produtividade e disponibilidade aqui."
                acao={
                  <Link to="/agentes" className="press text-[12px] text-primary hover:underline">
                    cadastrar agente
                  </Link>
                }
              />
            </div>
          ) : (
            <Lista className="mt-4 divide-y divide-border">
              {dados.ranking.map((a, i) => (
                <ItemLista key={a.nome} className="flex items-center gap-3 py-2.5">
                  <span className="font-mono text-[11px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[13px] text-foreground">{a.nome}</span>
                  <span
                    className={`ml-auto size-1.5 rounded-full ${a.online ? "bg-success" : "bg-border-strong"}`}
                    title={a.online ? "Online" : "Offline"}
                  />
                  <span className="w-8 text-right font-display text-[16px] text-primary">{a.total}</span>
                </ItemLista>
              ))}
            </Lista>
          )}
        </section>
      </div>

      <section className="mt-8 border border-border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="label-caps">Últimas solicitações</p>
          <Link to="/ordens" className="press text-[12px] text-primary hover:underline">
            ver fila completa
          </Link>
        </div>
        {recentes.length === 0 ? (
          <div className="p-4">
            <Vazio
              compacto
              icone={ListChecks}
              titulo="Nenhuma solicitação registrada"
              texto="Importe uma planilha da locadora ou crie uma ordem manualmente para iniciar a operação."
              acao={
                <Link to="/importacoes" className="press text-[12px] text-primary hover:underline">
                  importar planilha
                </Link>
              }
            />
          </div>
        ) : (
          <Lista className="divide-y divide-border">
            {recentes.map((o) => {
              const loc = banco.locadoras.find((l) => l.id === o.locadoraId);
              return (
                <ItemLista key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface">
                  <Link to="/ordens/$id" params={{ id: o.id }} className="font-mono text-[13px] text-primary hover:underline">
                    {o.placa}
                  </Link>
                  <span className="text-[13px] text-foreground">{o.marca} {o.modelo}</span>
                  <span className="text-[12px] text-muted-foreground">{loc?.nome}</span>
                  <span className="text-[12px] text-muted-foreground">{o.cidade}</span>
                  <span className="ml-auto"><Status valor={o.status} /></span>
                </ItemLista>
              );
            })}
          </Lista>
        )}
      </section>

    </Pagina>
  );
}
