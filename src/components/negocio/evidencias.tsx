/**
 * Evidências da captura: galeria com links assinados, visualizador profissional,
 * envio de arquivos com marca d'água e linha do tempo visual — usada tanto na
 * ficha interna quanto no portal da locadora.
 */
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, FileText, Film, Mic, PenLine, Receipt, Upload } from "lucide-react";
import { Visualizador, useGaleria, type ItemVisual } from "@/components/app/visualizador";
import { EASE } from "@/lib/animacao";
import { obterGps, processarFotoBlob } from "@/lib/foto";
import { useBanco, useFotosDaOrdem, useSessao, useSincronizar } from "@/lib/sessao";
import { EvidenciasService } from "@/services/evidencias.service";
import type { Evidencia, Ordem, TipoEvidencia } from "@/domain/types";

const ICONE: Record<TipoEvidencia, typeof Camera> = {
  foto: Camera,
  video: Film,
  audio: Mic,
  documento: FileText,
  assinatura: PenLine,
  comprovante: Receipt,
};

const ROTULO: Record<TipoEvidencia, string> = {
  foto: "Foto",
  video: "Vídeo",
  audio: "Áudio",
  documento: "Documento",
  assinatura: "Assinatura",
  comprovante: "Comprovante",
};

const visualiza = (e: Evidencia) =>
  e.tipo === "foto" || e.tipo === "assinatura" || e.tipo === "comprovante" || e.tipo === "video";

/**
 * Resolve os links assinados das evidências da ordem.
 * Fica em cache pela lista de arquivos: antes, cada atualização em tempo real
 * gerava links novos, o navegador descartava as imagens já baixadas e tudo
 * piscava/recarregava sem necessidade.
 */
function useLinks(evidencias: Evidencia[]) {
  const chave = evidencias.map((e) => e.id).join(",");
  const consulta = useQuery({
    queryKey: ["links-evidencias", chave],
    enabled: chave.length > 0,
    // Os links assinados duram bem mais do que isso.
    staleTime: 30 * 60_000,
    gcTime: 45 * 60_000,
    queryFn: async () => {
      const pares = await Promise.all(
        evidencias.map(
          async (e) => [e.id, await EvidenciasService.link(e).catch(() => "")] as const,
        ),
      );
      return Object.fromEntries(pares) as Record<string, string>;
    },
  });
  return consulta.data ?? {};
}

export function PainelEvidencias({
  ordem,
  podeEnviar = false,
  permitirDownload = true,
}: {
  ordem: Ordem;
  podeEnviar?: boolean;
  permitirDownload?: boolean;
}) {
  const banco = useBanco();
  const { usuario } = useSessao();
  const sincronizar = useSincronizar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const galeria = useGaleria();

  const evidencias = useMemo(
    () =>
      (banco.evidencias ?? [])
        .filter((e) => e.ordemId === ordem.id)
        .sort((a, b) => (a.criadaEm < b.criadaEm ? 1 : -1)),
    [banco.evidencias, ordem.id],
  );

  const links = useLinks(evidencias);

  const abriveis = evidencias.filter(visualiza);
  const itens: ItemVisual[] = abriveis.map((e) => ({
    id: e.id,
    url: links[e.id] ?? "",
    titulo: `${ROTULO[e.tipo]} — ${ordem.placa}`,
    legenda: `${e.etapa || "captura"}${e.gps ? ` • GPS ${e.gps}` : ""} • ${new Date(
      e.criadaEm,
    ).toLocaleString("pt-BR")}`,
    video: e.tipo === "video",
  }));

  async function enviar(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    setEnviando(true);
    try {
      const locadora = banco.locadoras.find((l) => l.id === ordem.locadoraId)?.nome ?? "";
      const gps = await obterGps();
      for (const arquivo of Array.from(arquivos)) {
        const imagem = arquivo.type.startsWith("image/");
        const conteudo = imagem
          ? await processarFotoBlob(arquivo, {
              empresa: "Recolhe",
              agente: usuario?.nome ?? "Operação",
              placa: ordem.placa,
              gps,
              locadora,
              cidade: [ordem.cidade, ordem.uf].filter(Boolean).join("/"),
              endereco: [ordem.endereco, ordem.bairro].filter(Boolean).join(", "),
            }).catch(() => arquivo)
          : arquivo;

        await EvidenciasService.enviar(
          conteudo,
          {
            ordemId: ordem.id,
            locadoraId: ordem.locadoraId,
            agenteId: ordem.agenteId ?? undefined,
            usuarioId: usuario?.id,
            etapa: "anexo",
            gps,
          },
          imagem
            ? { tipo: "foto", nome: arquivo.name.replace(/\.[^.]+$/, "") + ".webp" }
            : { nome: arquivo.name },
        );
      }
      await sincronizar("ordem_evidencias");
      toast.success(`${arquivos.length} evidência(s) anexada(s).`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="border border-border">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <p className="label-caps">Evidências da captura</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {evidencias.length} arquivo(s)
        </span>
        {podeEnviar && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void enviar(e.target.files)}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="press ml-auto flex items-center gap-1.5 border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Upload className="size-3" aria-hidden /> {enviando ? "enviando…" : "anexar"}
            </button>
          </>
        )}
      </div>

      {evidencias.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted-foreground">
          Nenhuma evidência registrada até o momento.
        </p>
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          <AnimatePresence initial={false}>
            {evidencias.map((e, i) => {
              const Icone = ICONE[e.tipo];
              const link = links[e.id] ?? "";
              const indiceGaleria = abriveis.findIndex((a) => a.id === e.id);
              const abrivel = indiceGaleria >= 0;
              return (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 8) * 0.04 }}
                >
                  <motion.button
                    type="button"
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    onClick={() =>
                      abrivel ? galeria.abrir(indiceGaleria) : window.open(link, "_blank")
                    }
                    className="group block w-full bg-surface text-left"
                  >
                    {e.tipo === "foto" || e.tipo === "assinatura" ? (
                      link ? (
                        <img
                          src={link}
                          alt={`${ROTULO[e.tipo]} — ${e.etapa}`}
                          loading="lazy"
                          className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-85"
                        />
                      ) : (
                        <div className="aspect-[4/3] w-full animate-pulse bg-surface-raised" />
                      )
                    ) : (
                      <div className="flex aspect-[4/3] items-center justify-center border-b border-border">
                        <Icone className="size-5 text-primary" aria-hidden />
                      </div>
                    )}
                    <p className="truncate px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground group-hover:text-primary">
                      {ROTULO[e.tipo]} • {e.etapa || "captura"}
                    </p>
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {galeria.indice !== null && itens.length > 0 && (
        <Visualizador
          itens={itens}
          indice={galeria.indice}
          aoTrocar={galeria.trocar}
          aoFechar={galeria.fechar}
          permitirDownload={permitirDownload}
        />
      )}
    </section>
  );
}

/** Linha do tempo visual da captura — histórico e evidências no mesmo eixo. */
export function LinhaTempoCaptura({ ordem }: { ordem: Ordem }) {
  const banco = useBanco();

  const marcos = useMemo(() => {
    const eventos = banco.historico
      .filter((h) => h.ordemId === ordem.id)
      .map((h) => ({
        id: h.id,
        quando: h.quando,
        titulo: h.acao,
        detalhe: h.detalhe ?? "",
        rodape: `${h.quem}${h.gps ? ` • GPS ${h.gps}` : ""}`,
        tipo: "evento" as const,
      }));
    const arquivos = (banco.evidencias ?? [])
      .filter((e) => e.ordemId === ordem.id)
      .map((e) => ({
        id: e.id,
        quando: e.criadaEm,
        titulo: `${ROTULO[e.tipo]} registrada`,
        detalhe: e.etapa || "",
        rodape: e.observacao || (e.gps ? `GPS ${e.gps}` : ""),
        tipo: "evidencia" as const,
      }));
    return [...eventos, ...arquivos].sort((a, b) => (a.quando < b.quando ? 1 : -1));
  }, [banco.historico, banco.evidencias, ordem.id]);

  return (
    <section className="border border-border">
      <p className="label-caps border-b border-border px-4 py-2.5">Linha do tempo da captura</p>
      {marcos.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted-foreground">
          A movimentação aparece aqui assim que o agente iniciar o atendimento.
        </p>
      ) : (
        <ol className="relative px-4 py-4">
          <span className="absolute bottom-4 left-[22px] top-6 w-px bg-border" aria-hidden />
          {marcos.map((m, i) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.32, ease: EASE, delay: Math.min(i, 10) * 0.045 }}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              <span
                className={`relative z-10 mt-1 size-2 shrink-0 rounded-full ${
                  m.tipo === "evidencia" ? "bg-cromo" : "bg-primary"
                }`}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[13px] text-foreground">{m.titulo}</p>
                {m.detalhe && (
                  <p className="whitespace-pre-line text-[12px] text-muted-foreground">
                    {m.detalhe}
                  </p>
                )}
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {m.rodape ? `${m.rodape} • ` : ""}
                  {new Date(m.quando).toLocaleString("pt-BR")}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Galeria das fotos legadas (data URL) com o mesmo visualizador. */
export function GaleriaFotos({ ordem }: { ordem: Ordem }) {
  const galeria = useGaleria();
  // As imagens vêm sob demanda apenas desta ordem.
  const { fotos } = useFotosDaOrdem(ordem.id);

  const itens: ItemVisual[] = fotos.map((f) => ({
    id: f.id,
    url: f.dataUrl,
    titulo: `${ordem.placa} — ${f.etapa}`,
    legenda: new Date(f.criadaEm).toLocaleString("pt-BR"),
  }));

  return (
    <section className="border border-border">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <p className="label-caps">Evidências fotográficas</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {fotos.length} foto(s)
        </span>
      </div>
      {fotos.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted-foreground">
          Nenhuma foto registrada até o momento.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
          {fotos.map((f, i) => (
            <motion.button
              key={f.id}
              type="button"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.22, ease: EASE }}
              onClick={() => galeria.abrir(i)}
              className="group bg-surface text-left"
            >
              <img
                src={f.dataUrl}
                alt={`Evidência ${f.etapa}`}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-85"
              />
              <p className="truncate px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground group-hover:text-primary">
                {f.etapa}
              </p>
            </motion.button>
          ))}
        </div>
      )}
      {galeria.indice !== null && itens.length > 0 && (
        <Visualizador
          itens={itens}
          indice={galeria.indice}
          aoTrocar={galeria.trocar}
          aoFechar={galeria.fechar}
        />
      )}
    </section>
  );
}
