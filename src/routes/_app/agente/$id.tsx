import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Camera, Check, Loader2, Lock } from "lucide-react";
import { Botao, Pagina, Vazio, suave } from "@/components/app/ui";
import { PainelCampo } from "@/components/negocio/painel-campo";

import { OrdensService } from "@/services/ordens.service";
import { obterGps, processarFoto } from "@/lib/foto";
import {
  valorPagar,
  valorPagarAuxiliar,
  valorPagarPrincipal,
  valorServico,
} from "@/domain/services/financeiro";
import { useBanco, useFotosDaOrdem, useSessao, useSincronizar } from "@/lib/sessao";
import { ITENS_CHECKLIST, type Conceito, type ChecklistItem, type Ordem } from "@/domain/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/agente/$id")({
  head: () => ({
    meta: [
      { title: "Execução do recolhimento — Recolhe" },
      {
        name: "description",
        content: "Registro de fotos com marca d'água, checklist e finalização do recolhimento.",
      },
      { property: "og:title", content: "Execução do recolhimento — Recolhe" },
      {
        property: "og:description",
        content: "Fluxo de campo do agente com GPS e evidências obrigatórias.",
      },
    ],
  }),
  component: Execucao,
});

const ETAPAS = ["Frontal", "Traseira", "Lateral esquerda", "Lateral direita", "Painel"];

/** Sequência obrigatória de campo — nenhuma etapa pode ser pulada. */
const PASSOS: Array<{ rotulo: string; feito: (o: Ordem) => boolean }> = [
  { rotulo: "Aceite", feito: (o) => !!o.aceitaEm },
  { rotulo: "Deslocamento", feito: (o) => !!o.iniciadaEm },
  { rotulo: "Chegada", feito: (o) => !!o.chegadaEm },
  { rotulo: "Captura", feito: (o) => o.status === "concluida" },
];

function Execucao() {
  const { id } = Route.useParams();
  const banco = useBanco();
  const { usuario } = useSessao();
  const navigate = useNavigate();
  const sincronizar = useSincronizar();
  const ordem = banco.ordens.find((o) => o.id === id);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    ordem?.checklist ?? ITENS_CHECKLIST.map((item) => ({ item, conceito: "bom" as Conceito })),
  );
  const [termo, setTermo] = useState(false);
  // Imagens só da ordem aberta — carregar todas as fotos do sistema travava
  // a sincronização e deixava telas vazias.
  const { fotos } = useFotosDaOrdem(id);

  if (!ordem) {
    return (
      <Pagina titulo="Ordem indisponível">
        <Vazio titulo="Não encontramos esta ordem" texto="Volte para a lista e tente novamente." />
      </Pagina>
    );
  }

  const nome = usuario?.nome ?? "Agente";

  async function marcarEtapa(acao: string, campo: "aceita_em" | "iniciada_em" | "chegada_em") {
    try {
      const gps = await obterGps();
      await OrdensService.marcarEtapa(ordem!, campo);
      await OrdensService.registrarHistorico(id, nome, acao, undefined, gps);
      await sincronizar("ordens");
      toast.success(acao);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function enviarFoto(etapa: string, file: File) {
    if (!ordem!.chegadaEm) {
      toast.error("Antes de continuar é necessário informar sua chegada ao local.");
      return;
    }
    setEnviando(etapa);
    try {
      const gps = await obterGps();
      const locadora = banco.locadoras.find((l) => l.id === ordem!.locadoraId)?.nome ?? "";
      const dataUrl = await processarFoto(file, {
        empresa: "Recolhe",
        agente: nome,
        placa: ordem!.placa,
        gps,
        locadora,
        cidade: [ordem!.cidade, ordem!.uf].filter(Boolean).join("/"),
        endereco: [ordem!.endereco, ordem!.bairro].filter(Boolean).join(", "),
      });
      await OrdensService.registrarFoto(id, etapa, dataUrl);
      await OrdensService.registrarHistorico(id, nome, `Foto registrada: ${etapa}`, undefined, gps);
      await sincronizar(["ordens", "ordem_fotos", "ordem_historico"]);
    } catch {
      toast.error("Falha ao processar a imagem.");
    } finally {
      setEnviando(null);
    }
  }

  const ruinsSemFoto = checklist.filter(
    (c) => c.conceito === "ruim" && !fotos.some((f) => f.etapa === `Avaria · ${c.item}`),
  );
  const faltamObrigatorias = ETAPAS.filter((e) => !fotos.some((f) => f.etapa === e));

  async function finalizar() {
    if (!ordem!.chegadaEm) {
      toast.error("Antes de continuar é necessário informar sua chegada ao local.");
      return;
    }
    if (faltamObrigatorias.length > 0) {
      toast.error(`Faltam fotos: ${faltamObrigatorias.join(", ")}.`);
      return;
    }
    if (ruinsSemFoto.length > 0) {
      toast.error(`Itens "ruim" exigem foto: ${ruinsSemFoto.map((c) => c.item).join(", ")}.`);
      return;
    }
    if (!termo) {
      toast.error("Aceite o termo de responsabilidade.");
      return;
    }
    try {
      const gps = await obterGps();
      // Valores congelados na conclusão: mudança futura de tabela não reescreve o passado
      await OrdensService.concluir(ordem!, checklist, {
        cobranca: valorServico(banco, ordem!),
        pagamento: valorPagar(banco, ordem!),
        principal: valorPagarPrincipal(banco, ordem!),
        auxiliar: valorPagarAuxiliar(banco, ordem!),
      });
      await OrdensService.registrarHistorico(
        id,
        nome,
        "Recolhimento concluído",
        "Checklist e termo registrados",
        gps,
      );
      await sincronizar("ordens");
      toast.success("Recolhimento concluído.");
      void navigate({ to: "/agente" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Pagina
      titulo={ordem.placa}
      descricao={`${ordem.marca} ${ordem.modelo} · ${ordem.cor}`}
      acoes={
        <Link
          to="/agente"
          className="press inline-flex items-center gap-1.5 border border-border-strong px-3 py-2 text-[13px] hover:border-primary hover:text-primary"
        >
          <ArrowLeft className="size-3.5" /> Voltar
        </Link>
      }
    >
      <ol className="mt-1 mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {PASSOS.map((p, i) => {
          const feito = p.feito(ordem);
          const atual = !feito && PASSOS.slice(0, i).every((x) => x.feito(ordem));
          return (
            <li
              key={p.rotulo}
              className={cn(
                "flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                feito ? "text-success" : atual ? "text-primary" : "text-muted-foreground/60",
              )}
            >
              {feito ? (
                <Check className="size-3" />
              ) : (
                <span className="tabular-nums">{i + 1}.</span>
              )}
              {p.rotulo}
            </li>
          );
        })}
      </ol>

      <PainelCampo ordem={ordem} rastreamentoBloqueado={!ordem.iniciadaEm} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Botao
          variante={ordem.aceitaEm ? "linha" : "solido"}
          disabled={!!ordem.aceitaEm}
          onClick={() => void marcarEtapa("Ordem aceita pelo agente", "aceita_em")}
        >
          {ordem.aceitaEm ? "Ordem aceita" : "Aceitar ordem"}
        </Botao>
        <Botao
          variante="linha"
          disabled={!ordem.aceitaEm || !!ordem.iniciadaEm}
          onClick={() => void marcarEtapa("Deslocamento iniciado", "iniciada_em")}
        >
          Iniciar deslocamento
        </Botao>
        <Botao
          variante="linha"
          disabled={!ordem.iniciadaEm || !!ordem.chegadaEm}
          onClick={() => void marcarEtapa("Chegada ao local", "chegada_em")}
        >
          Anunciar chegada
        </Botao>
      </div>

      {!ordem.chegadaEm && (
        <p className="mt-6 flex items-center gap-2 border-l-2 border-warning bg-warning/8 px-4 py-3 text-[13px] text-warning">
          <Lock className="size-4 shrink-0" />
          Antes de continuar é necessário informar sua chegada ao local.
        </p>
      )}

      <section
        className={cn(
          "mt-8 transition-opacity",
          !ordem.chegadaEm && "pointer-events-none opacity-40",
        )}
      >
        <p className="label-caps">Fotos obrigatórias</p>
        <div className="mt-3 grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          {ETAPAS.map((etapa) => {
            const foto = fotos.find((f) => f.etapa === etapa);
            return (
              <label
                key={etapa}
                className={cn(
                  "press relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 bg-surface text-center transition-colors hover:bg-surface-raised",
                  foto && "p-0",
                )}
              >
                {foto ? (
                  <img src={foto.dataUrl} alt={etapa} className="size-full object-cover" />
                ) : enviando === etapa ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <>
                    <Camera className="size-4 text-primary" />
                    <span className="px-2 text-[12px] text-muted-foreground">{etapa}</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void enviarFoto(etapa, f);
                  }}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section
        className={cn(
          "mt-8 transition-opacity",
          !ordem.chegadaEm && "pointer-events-none opacity-40",
        )}
      >
        <p className="label-caps">Checklist de vistoria</p>
        <ul className="mt-3 divide-y divide-border border border-border">
          {checklist.map((c, i) => {
            const fotoAvaria = fotos.find((f) => f.etapa === `Avaria · ${c.item}`);
            return (
              <li key={c.item} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[13px] text-foreground">{c.item}</span>
                  <div className="ml-auto flex gap-px bg-border">
                    {(["bom", "regular", "ruim"] as Conceito[]).map((cc) => (
                      <button
                        key={cc}
                        onClick={() =>
                          setChecklist((lista) =>
                            lista.map((x, xi) => (xi === i ? { ...x, conceito: cc } : x)),
                          )
                        }
                        className={cn(
                          "press bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                          c.conceito === cc
                            ? cc === "bom"
                              ? "bg-success/15 text-success"
                              : cc === "regular"
                                ? "bg-warning/15 text-warning"
                                : "bg-destructive/15 text-destructive"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {cc}
                      </button>
                    ))}
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {c.conceito === "ruim" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={suave}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-l-2 border-destructive pl-3">
                        <input
                          value={c.descricao ?? ""}
                          onChange={(e) =>
                            setChecklist((lista) =>
                              lista.map((x, xi) =>
                                xi === i ? { ...x, descricao: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="Descreva a avaria"
                          className="flex-1 border-b border-border bg-transparent pb-1 text-[13px] outline-none focus:border-primary"
                        />
                        <label className="press inline-flex cursor-pointer items-center gap-1.5 border border-border-strong px-3 py-1.5 text-[12px] hover:border-primary hover:text-primary">
                          <Camera className="size-3.5" />
                          {fotoAvaria ? "foto anexada" : "anexar foto"}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void enviarFoto(`Avaria · ${c.item}`, f);
                            }}
                          />
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className={cn(
          "mt-6 border border-border bg-surface p-4 transition-opacity",
          !ordem.chegadaEm && "pointer-events-none opacity-40",
        )}
      >
        <label className="flex cursor-pointer items-start gap-3 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={termo}
            onChange={(e) => setTermo(e.target.checked)}
            className="mt-0.5 accent-[oklch(0.783_0.145_68)]"
          />
          Confirmo que as informações, fotos e o estado registrado da motocicleta são verdadeiros e
          assumo a responsabilidade pela guarda do veículo a partir deste momento.
        </label>
        <div className="mt-4 flex justify-end">
          <Botao variante="solido" onClick={() => void finalizar()}>
            Concluir recolhimento
          </Botao>
        </div>
      </section>
    </Pagina>
  );
}
