/**
 * Galeria de fotos da vistoria com pré-visualização real (miniaturas) e
 * visualizador em tela cheia com botão de voltar.
 *
 * Cada foto resolve o próprio link assinado: se um link falhar, apenas aquela
 * miniatura mostra "Foto indisponível" com opção de tentar de novo — nunca um
 * quadrado cinza infinito e nunca um espaço vazio sem explicação.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, RefreshCw, ImageOff } from "lucide-react";
import { Vazio } from "@/components/app/ui";
import { Visualizador, useGaleria, type ItemVisual } from "@/components/app/visualizador";
import { VistoriasService } from "@/services/vistorias.service";
import { ROTULO_CATEGORIA_FOTO, type EvidenciaVistoria } from "@/domain/types";

const dataHora = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

/** Link assinado de uma foto — renovado sozinho antes de expirar. */
export function useLinkFoto(foto: EvidenciaVistoria) {
  return useQuery({
    queryKey: ["link-vistoria", foto.id, foto.caminho],
    staleTime: 30 * 60_000,
    gcTime: 45 * 60_000,
    retry: 2,
    queryFn: async () => {
      const url = await VistoriasService.link(foto);
      if (!url) throw new Error("Arquivo da foto indisponível.");
      return url;
    },
  });
}

/** Links de várias fotos — usado pelo visualizador em tela cheia e pelo laudo. */
export function useLinksVistoria(fotos: EvidenciaVistoria[]) {
  const chave = fotos.map((f) => f.id).join(",");
  const consulta = useQuery({
    queryKey: ["links-vistoria", chave],
    enabled: chave.length > 0,
    staleTime: 30 * 60_000,
    gcTime: 45 * 60_000,
    retry: 2,
    queryFn: async () => {
      const pares = await Promise.all(
        fotos.map(async (f) => [f.id, await VistoriasService.link(f).catch(() => "")] as const),
      );
      return Object.fromEntries(pares) as Record<string, string>;
    },
  });
  return consulta.data ?? {};
}

export function legendaFoto(f: EvidenciaVistoria) {
  return [
    dataHora(f.criadaEm),
    f.km === undefined || f.km === null ? "" : `${f.km.toLocaleString("pt-BR")} km`,
    f.gps,
    f.observacao,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Miniatura com estados reais: carregando, disponível, indisponível. */
function Miniatura({ foto, aoAbrir }: { foto: EvidenciaVistoria; aoAbrir: () => void }) {
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useLinkFoto(foto);
  const rotulo = ROTULO_CATEGORIA_FOTO[foto.categoria];

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ["links-vistoria"] });
    void refetch();
  };

  return (
    <div className="bg-surface">
      <button
        type="button"
        onClick={aoAbrir}
        disabled={!data}
        className="press group block w-full text-left disabled:cursor-default"
        aria-label={`Abrir ${rotulo} — ${foto.etapa}`}
      >
        {data ? (
          <img
            src={data}
            alt={`${rotulo} — ${foto.etapa}`}
            loading="lazy"
            decoding="async"
            onError={() => recarregar()}
            className="aspect-[4/3] w-full object-cover transition-opacity group-hover:opacity-85"
          />
        ) : isPending ? (
          <div className="aspect-[4/3] w-full animate-pulse bg-surface-raised" />
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-surface-raised px-2 text-center">
            <ImageOff className="size-4 text-warning" aria-hidden />
            <span className="text-[11px] text-warning">Foto indisponível</span>
          </div>
        )}
      </button>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <div className="min-w-0">
          <p className="label-caps truncate">{rotulo}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {foto.etapa || "vistoria"}
          </p>
        </div>
        {isError && (
          <button
            type="button"
            onClick={recarregar}
            className="press flex items-center gap-1 border border-border px-1.5 py-1 text-[10px] text-muted-foreground"
          >
            <RefreshCw className="size-3" aria-hidden /> tentar
          </button>
        )}
      </div>
    </div>
  );
}

export function GaleriaVistoria({
  fotos,
  compacta = false,
  vazioTexto = "As fotos com marca d'água são enviadas pelo agente durante a vistoria.",
}: {
  fotos: EvidenciaVistoria[];
  compacta?: boolean;
  vazioTexto?: string;
}) {
  const links = useLinksVistoria(fotos);
  const galeria = useGaleria();

  const itens: ItemVisual[] = fotos.map((f) => ({
    id: f.id,
    url: links[f.id] ?? "",
    titulo: `${ROTULO_CATEGORIA_FOTO[f.categoria]} · ${f.etapa}`,
    legenda: legendaFoto(f),
  }));

  if (fotos.length === 0) {
    return <Vazio compacto icone={Camera} titulo="Sem fotos" texto={vazioTexto} />;
  }

  return (
    <>
      <div
        className={
          compacta
            ? "grid grid-cols-3 gap-px bg-border sm:grid-cols-4 lg:grid-cols-6"
            : "grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4"
        }
      >
        {fotos.map((f, i) => (
          <Miniatura key={f.id} foto={f} aoAbrir={() => galeria.abrir(i)} />
        ))}
      </div>

      {galeria.indice !== null && (
        <Visualizador
          itens={itens}
          indice={galeria.indice}
          aoFechar={galeria.fechar}
          aoTrocar={galeria.trocar}
        />
      )}
    </>
  );
}
