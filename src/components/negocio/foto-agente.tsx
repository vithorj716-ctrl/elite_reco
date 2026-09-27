import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Camera, ImagePlus, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Botao, Modal } from "@/components/app/ui";
import { comprimirFotoPerfil } from "@/lib/foto-perfil";
import { FotoAgenteService, fotoEhCaminho } from "@/services/agentes.service";
import { cn } from "@/lib/utils";

/**
 * URL da foto de perfil com cache — a mesma imagem não é baixada de novo em
 * cada tela e o link assinado é renovado só quando expira.
 */
export function useFotoAgente(foto: string | undefined) {
  const caminho = foto ?? "";
  const assinar = fotoEhCaminho(caminho);
  const { data } = useQuery({
    queryKey: ["foto-agente", caminho],
    queryFn: () => FotoAgenteService.url(caminho),
    enabled: assinar,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
  if (!caminho) return undefined;
  return assinar ? data : caminho;
}

export function useInvalidarFoto() {
  const qc = useQueryClient();
  return (foto?: string) =>
    qc.invalidateQueries({ queryKey: ["foto-agente", ...(foto ? [foto] : [])] });
}

/** Avatar do agente — usa a foto cadastrada ou um marcador padrão. */
export function AvatarAgente({
  foto,
  nome,
  tamanho = 36,
  className,
  aoClicar,
}: {
  foto?: string | undefined;
  nome?: string | undefined;
  tamanho?: number;
  className?: string;
  aoClicar?: (() => void) | undefined;
}) {
  const url = useFotoAgente(foto);
  const conteudo = url ? (
    <img
      src={url}
      alt={nome ? `Foto de ${nome}` : ""}
      loading="lazy"
      decoding="async"
      className="size-full object-cover"
    />
  ) : (
    <span className="flex size-full items-center justify-center text-primary">
      {nome ? (
        <span className="font-mono text-[11px] uppercase">{nome.slice(0, 2)}</span>
      ) : (
        <UserRound className="size-1/2" />
      )}
    </span>
  );

  const classe = cn(
    "shrink-0 overflow-hidden border border-border bg-surface-raised",
    aoClicar && "press cursor-pointer hover:border-primary/60",
    className,
  );
  const estilo = { width: tamanho, height: tamanho };

  if (aoClicar) {
    return (
      <button
        type="button"
        onClick={aoClicar}
        style={estilo}
        className={classe}
        aria-label="Perfil"
      >
        {conteudo}
      </button>
    );
  }
  return (
    <span style={estilo} className={classe}>
      {conteudo}
    </span>
  );
}

/**
 * Captura ou seleção da foto de perfil com pré-visualização.
 * `aoConfirmar` recebe o blob já comprimido — o envio é de quem chama.
 */
export function SeletorFotoAgente({
  foto,
  nome,
  aoConfirmar,
  tamanho = 96,
  somenteLeitura = false,
}: {
  foto?: string | undefined;
  nome?: string | undefined;
  aoConfirmar: (blob: Blob) => Promise<void> | void;
  tamanho?: number;
  somenteLeitura?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<{ url: string; blob: Blob } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (previa) URL.revokeObjectURL(previa.url);
    },
    [previa],
  );

  async function escolher(arquivo?: File) {
    if (!arquivo) return;
    try {
      const blob = await comprimirFotoPerfil(arquivo);
      setPrevia({ url: URL.createObjectURL(blob), blob });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function fechar() {
    setPrevia(null);
    setAberto(false);
  }

  async function confirmar() {
    if (!previa) return;
    setSalvando(true);
    try {
      await aoConfirmar(previa.blob);
      fechar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <AvatarAgente foto={foto} nome={nome} tamanho={tamanho} />
        {!somenteLeitura && (
          <div className="min-w-0">
            <Botao variante="linha" type="button" onClick={() => setAberto(true)}>
              <Camera className="size-4" /> {foto ? "Alterar foto" : "Adicionar foto"}
            </Botao>
            {!foto && (
              <p className="mt-2 text-[12px] text-warning">
                Este agente ainda não possui foto cadastrada.
              </p>
            )}
          </div>
        )}
      </div>

      <Modal
        aberto={aberto}
        aoFechar={fechar}
        titulo="Foto do agente"
        descricao="Tire uma foto na hora ou escolha uma imagem da galeria."
        rodape={
          previa ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="fantasma" type="button" onClick={fechar}>
                <X className="size-4" /> Cancelar
              </Botao>
              <Botao variante="linha" type="button" onClick={() => setPrevia(null)}>
                <Camera className="size-4" /> Tirar novamente
              </Botao>
              <Botao type="button" onClick={confirmar} carregando={salvando}>
                Usar esta foto
              </Botao>
            </div>
          ) : (
            <div className="flex justify-end">
              <Botao variante="fantasma" type="button" onClick={fechar}>
                Cancelar
              </Botao>
            </div>
          )
        }
      >
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => escolher(e.target.files?.[0] ?? undefined)}
        />
        <input
          ref={galeria}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => escolher(e.target.files?.[0] ?? undefined)}
        />

        {previa ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            src={previa.url}
            alt="Pré-visualização da foto"
            className="mx-auto aspect-square w-full max-w-[280px] border border-border-strong object-cover"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => camera.current?.click()}
              className="press flex flex-col items-center gap-2 border border-border px-4 py-8 text-[13px] hover:border-primary/60"
            >
              <Camera className="size-6 text-primary" /> Tirar foto agora
            </button>
            <button
              type="button"
              onClick={() => galeria.current?.click()}
              className="press flex flex-col items-center gap-2 border border-border px-4 py-8 text-[13px] hover:border-primary/60"
            >
              <ImagePlus className="size-6 text-primary" /> Escolher da galeria
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
