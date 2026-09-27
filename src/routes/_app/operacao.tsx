import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useMemo } from "react";
import {
  AlertTriangle,
  Ban,
  CameraOff,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Navigation,
  Receipt,
} from "lucide-react";
import { Metrica, Pagina, Prioridade_, Status, Vazio } from "@/components/app/ui";
import { AcoesOrdem } from "@/components/negocio/acoes-ordem";
import { EASE, varItem, varLista } from "@/lib/animacao";
import { moedaBR } from "@/lib/moeda";
import { useBanco } from "@/lib/sessao";
import { valorReceber } from "@/domain/services/financeiro";
import type { Ordem } from "@/domain/types";

export const Route = createFileRoute("/_app/operacao")({
  head: () => ({
    meta: [
      { title: "Operação do dia — Recolhe" },
      {
        name: "description",
        content:
          "Central em tempo real da operação: fila, agentes em rota, capturas, pendências de evidência e cobrança.",
      },
      { property: "og:title", content: "Operação do dia — Recolhe" },
      {
        property: "og:description",
        content: "Tudo que acontece no dia em uma única tela, atualizado em tempo real.",
      },
    ],
  }),
  component: Operacao,
});

const hoje = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const agora = new Date();
  return (
    d.getDate() === agora.getDate() &&
    d.getMonth() === agora.getMonth() &&
    d.getFullYear() === agora.getFullYear()
  );
};

function Bloco({
  titulo,
  icone: Icone,
  ordens,
  nomeLocadora,
  nomeAgente,
  valor,
}: {
  titulo: string;
  icone: typeof Clock;
  ordens: Ordem[];
  nomeLocadora: (id: string) => string;
  nomeAgente: (id?: string) => string;
  valor?: (o: Ordem) => string;
}) {
  return (
    <section className="border border-border">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
        <Icone className="size-3.5 text-primary" aria-hidden />
        <p className="label-caps">{titulo}</p>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">
          {ordens.length}
        </span>
      </div>
      {ordens.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-muted-foreground">Nada aqui agora.</p>
      ) : (
        <motion.ul
          variants={varLista(0.03)}
          initial="inicial"
          animate="animar"
          className="rolagem-y grid max-h-80 gap-px bg-border"
        >
          {ordens.map((o) => (
            <motion.li key={o.id} variants={varItem} className="group bg-surface">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                <Link
                  to="/ordens/$id"
                  params={{ id: o.id }}
                  className="min-w-0 flex-1 transition-colors hover:text-primary"
                >
                  <p className="flex items-center gap-2 truncate text-[13px] text-foreground group-hover:text-primary">
                    <span className="font-mono tabular-nums">{o.placa}</span>
                    <Prioridade_ valor={o.prioridade} />
                  </p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {nomeLocadora(o.locadoraId)} • {nomeAgente(o.agenteId)} • {o.cidade}
                  </p>
                </Link>
                {valor ? (
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">
                    {valor(o)}
                  </span>
                ) : (
                  <Status valor={o.status} />
                )}
                <AcoesOrdem ordem={o} />
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}

function Operacao() {
  const banco = useBanco();

  const nomeLocadora = (id: string) => banco.locadoras.find((l) => l.id === id)?.nome ?? "—";
  const nomeAgente = (id?: string) =>
    id ? (banco.agentes.find((a) => a.id === id)?.nome ?? "—") : "sem agente";

  const g = useMemo(() => {
    const o = banco.ordens;
    const evidenciaDe = (id: string) =>
      (banco.evidencias ?? []).some((e) => e.ordemId === id) ||
      banco.fotos.some((f) => f.ordemId === id);
    const concluidas = o.filter((x) => x.status === "concluida");
    return {
      aguardando: o.filter((x) => x.status === "pendente_definicao" || x.status === "liberada"),
      distribuidas: o.filter((x) => x.status === "distribuida"),
      andamento: o.filter((x) => x.status === "em_andamento"),
      capturasHoje: concluidas.filter((x) => hoje(x.concluidaEm)),
      semEvidencia: concluidas.filter((x) => !evidenciaDe(x.id)),
      semCobranca: concluidas.filter((x) => valorReceber(banco, x) === 0),
      aguardandoPagamento: concluidas.filter(
        (x) => !x.recebimentoPago && valorReceber(banco, x) > 0,
      ),
      concluidas,
      canceladas: o.filter((x) => x.status === "cancelada"),
    };
  }, [banco]);

  const emRota = new Set(
    [...g.distribuidas, ...g.andamento].map((o) => o.agenteId).filter(Boolean),
  ).size;

  const props = { nomeLocadora, nomeAgente };

  return (
    <Pagina
      titulo="Operação do dia"
      descricao="Fila, campo, evidências e cobranças em tempo real — sem trocar de menu."
      fundo="operacional"
      intensidadeFundo="low"
    >
      {banco.ordens.length === 0 ? (
        <Vazio
          icone={Clock}
          titulo="Nenhum recolhimento em circulação"
          texto="Assim que as solicitações forem importadas, a operação do dia aparece aqui."
        />
      ) : (
        <>
          <motion.div
            variants={varLista(0.04)}
            initial="inicial"
            animate="animar"
            className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4"
          >
            <Metrica rotulo="Aguardando" valor={g.aguardando.length} destaque />
            <Metrica
              rotulo="Em andamento"
              valor={g.andamento.length + g.distribuidas.length}
              nota={`${emRota} agente(s) em rota`}
            />
            <Metrica rotulo="Capturas hoje" valor={g.capturasHoje.length} />
            <Metrica
              rotulo="Pendências"
              valor={g.semEvidencia.length + g.semCobranca.length}
              nota="sem evidência ou sem cobrança"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.08 }}
            className="mt-6 grid gap-6 xl:grid-cols-2"
          >
            <Bloco titulo="Ordens aguardando" icone={Clock} ordens={g.aguardando} {...props} />
            <Bloco
              titulo="Em campo / agentes em rota"
              icone={Navigation}
              ordens={[...g.andamento, ...g.distribuidas]}
              {...props}
            />
            <Bloco
              titulo="Capturas realizadas hoje"
              icone={CheckCircle2}
              ordens={g.capturasHoje}
              {...props}
            />
            <Bloco
              titulo="Ordens sem evidências"
              icone={CameraOff}
              ordens={g.semEvidencia}
              {...props}
            />
            <Bloco
              titulo="Ordens sem cobrança"
              icone={AlertTriangle}
              ordens={g.semCobranca}
              {...props}
            />
            <Bloco
              titulo="Aguardando pagamento"
              icone={CircleDollarSign}
              ordens={g.aguardandoPagamento}
              valor={(o) => moedaBR(valorReceber(banco, o))}
              {...props}
            />
            <Bloco
              titulo="Finalizadas"
              icone={Receipt}
              ordens={g.concluidas}
              valor={(o) => moedaBR(valorReceber(banco, o))}
              {...props}
            />
            <Bloco titulo="Canceladas" icone={Ban} ordens={g.canceladas} {...props} />
          </motion.div>
        </>
      )}
    </Pagina>
  );
}
