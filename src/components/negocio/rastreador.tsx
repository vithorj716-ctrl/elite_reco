/**
 * Rastreador da moto — um único dado global exibido igual em todos os módulos.
 * A moto é a dona do host e do PIN; vistoria e recolhimento apenas consomem.
 */
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { Botao } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export interface DadosRastreador {
  host: string;
  pin: string;
}

/** URL válida? Só http(s) — nunca alteramos o endereço informado pela locadora. */
export function hostValido(host: string): boolean {
  const bruto = (host ?? "").trim();
  if (!bruto) return true;
  try {
    const url = new URL(bruto);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Mantém apenas caracteres usados em PIN, preservando zeros à esquerda. */
export const normalizarPin = (v: string) =>
  (v ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z-]/g, "")
    .slice(0, 12);

async function copiar(valor: string) {
  try {
    await navigator.clipboard.writeText(valor);
    toast.success("PIN copiado.");
  } catch {
    toast.error("Não foi possível copiar o PIN.");
  }
}

export function BlocoRastreador({
  dados,
  bloqueado = false,
  compacto = false,
  className,
}: {
  dados: DadosRastreador | null | undefined;
  /** Regra de campo: o rastreador só abre depois de iniciado o deslocamento. */
  bloqueado?: boolean;
  compacto?: boolean;
  className?: string;
}) {
  const host = (dados?.host ?? "").trim();
  const pin = (dados?.pin ?? "").trim();
  if (!host && !pin) return null;

  return (
    <div className={cn("border border-border bg-surface px-4 py-3", className)}>
      <p className="label-caps">Rastreador</p>
      {!compacto && (
        <div className="mt-1.5 grid gap-1">
          <p className="truncate text-[12.5px] text-muted-foreground" title={host}>
            Host: {host || "—"}
          </p>
          <p className="font-mono text-[13px]">PIN: {pin || "—"}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {host && (
          <Botao
            variante="linha"
            tamanho="sm"
            disabled={bloqueado}
            onClick={() => {
              if (bloqueado) return;
              window.open(host, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Abrir rastreador
          </Botao>
        )}
        {pin && (
          <Botao variante="fantasma" tamanho="sm" onClick={() => copiar(pin)}>
            <Copy className="size-3.5" aria-hidden />
            Copiar PIN{compacto ? ` · ${pin}` : ""}
          </Botao>
        )}
      </div>
      {bloqueado && host && (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
          Disponível após iniciar o deslocamento.
        </p>
      )}
    </div>
  );
}
