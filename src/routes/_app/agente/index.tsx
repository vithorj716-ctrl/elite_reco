import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ChevronRight, MapPin, Wallet } from "lucide-react";
import { Pagina, Prioridade_, Status, Vazio, suave } from "@/components/app/ui";
import { useBanco, useSessao } from "@/lib/sessao";
import { dinheiroExato, saldoAgente } from "@/domain/services/financeiro";
import { nomeServico } from "@/domain/services/catalogo";
import { OfertasAgente } from "@/components/negocio/oferta-agente";
import { ControleDisponibilidade } from "@/components/negocio/disponibilidade";
import { ServicosAceitos } from "@/components/negocio/servicos-aceitos";


export const Route = createFileRoute("/_app/agente/")({
  head: () => ({
    meta: [
      { title: "Minhas ordens em campo — Recolhe" },
      { name: "description", content: "Ordens de recolhimento atribuídas ao agente, com endereço e prioridade." },
      { property: "og:title", content: "Minhas ordens em campo — Recolhe" },
      { property: "og:description", content: "Execução de recolhimentos com fotos, checklist e GPS." },
    ],
  }),
  component: Campo,
});

function Campo() {
  const banco = useBanco();
  const { usuario } = useSessao();
  const meuId = usuario?.agenteId;

  const minhas = banco.ordens
    .filter((o) => o.agenteId === meuId && o.status !== "concluida" && o.status !== "cancelada")
    .sort((a, b) => (a.prioridade === "urgente" ? -1 : b.prioridade === "urgente" ? 1 : 0));

  const feitas = banco.ordens.filter((o) => o.agenteId === meuId && o.status === "concluida");
  const aReceber = meuId ? Math.max(saldoAgente(banco, meuId).pendente, 0) : 0;

  return (
    <Pagina titulo="Minhas ordens" descricao="Execute o recolhimento diretamente pelo celular." fundo="operacional" intensidadeFundo="low">
      <ControleDisponibilidade />
      <ServicosAceitos />
      <OfertasAgente />

      {meuId && (
        <Link
          to="/agente/financeiro"
          className="press mb-4 flex items-center gap-3 border border-border border-l-2 border-l-primary bg-surface p-4 hover:bg-surface-raised"
        >
          <Wallet className="size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="label-caps">Você tem a receber</p>
            <p className="mt-1 font-mono text-[16px] tabular-nums text-foreground">
              {dinheiroExato(aReceber)}
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1 text-[12px] text-primary">
            Ver meu financeiro <ChevronRight className="size-3.5" aria-hidden />
          </span>
        </Link>
      )}

      {minhas.length === 0 ? (
        <Vazio

          titulo="Nenhuma ordem atribuída"
          texto="Assim que a central distribuir um recolhimento para você, ele aparece aqui."
        />
      ) : (
        <ul className="space-y-px bg-border">
          {minhas.map((o, i) => (
            <motion.li
              key={o.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...suave, delay: i * 0.05 }}
              className="bg-surface"
            >
              <Link
                to="/agente/$id"
                params={{ id: o.id }}
                className="press flex items-start gap-4 p-4 transition-colors hover:bg-surface-raised"
              >
                <span className="w-[2px] self-stretch bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[15px] text-foreground">{o.placa}</span>
                    <Prioridade_ valor={o.prioridade} />
                    <Status valor={o.status} />
                  </div>
                  <p className="mt-1 text-[13px] text-foreground">{o.marca} {o.modelo} · {o.cor}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-[12px] text-muted-foreground">
                    <MapPin className="mt-0.5 size-3 shrink-0" /> {o.endereco} — {o.cidade}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {nomeServico(banco, o)}
                  </p>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </Link>
            </motion.li>
          ))}
        </ul>
      )}

      {feitas.length > 0 && (
        <section className="mt-8 border border-border">
          <p className="label-caps border-b border-border px-4 py-2.5">Concluídas por você · {feitas.length}</p>
          <ul className="divide-y divide-border">
            {feitas.slice(0, 8).map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="font-mono text-[13px]">{o.placa}</span>
                <span className="text-[12px] text-muted-foreground">{o.cidade}</span>
                <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {o.concluidaEm ? new Date(o.concluidaEm).toLocaleDateString("pt-BR") : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Pagina>
  );
}
