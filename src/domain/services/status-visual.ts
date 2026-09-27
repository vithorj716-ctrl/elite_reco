/**
 * Estado visual derivado do estado REAL da ordem no banco.
 * Nada de estado local: a cor é sempre função do status + marcos de tempo.
 */
import type { Ordem } from "@/domain/types";

export type ChaveVisual = "aguardando" | "deslocamento" | "concluida" | "cancelada";

export interface EstadoVisual {
  chave: ChaveVisual;
  rotulo: string;
  /** faixa lateral */
  barra: string;
  /** fundo tonalizado (baixa opacidade) */
  fundo: string;
  /** cor de texto/ponto */
  texto: string;
}

const MAPA: Record<ChaveVisual, EstadoVisual> = {
  aguardando: {
    chave: "aguardando",
    rotulo: "aguardando deslocamento",
    barra: "border-l-destructive",
    fundo: "bg-destructive/[0.07]",
    texto: "text-destructive",
  },
  deslocamento: {
    chave: "deslocamento",
    rotulo: "agente em deslocamento",
    barra: "border-l-success",
    fundo: "bg-success/[0.07]",
    texto: "text-success",
  },
  concluida: {
    chave: "concluida",
    rotulo: "recolhimento concluído",
    barra: "border-l-primary",
    fundo: "bg-primary/[0.06]",
    texto: "text-primary",
  },
  cancelada: {
    chave: "cancelada",
    rotulo: "cancelada",
    barra: "border-l-border-strong",
    fundo: "bg-muted/[0.35]",
    texto: "text-muted-foreground",
  },
};

/** Deriva o estado visual a partir da ordem persistida. */
export function estadoVisual(ordem: Ordem): EstadoVisual {
  if (ordem.status === "cancelada") return MAPA.cancelada;
  if (ordem.status === "concluida") return MAPA.concluida;
  const deslocamentoIniciado = ordem.status === "em_andamento" || Boolean(ordem.iniciadaEm);
  return deslocamentoIniciado ? MAPA.deslocamento : MAPA.aguardando;
}

export const LEGENDA_VISUAL: EstadoVisual[] = [
  MAPA.aguardando,
  MAPA.deslocamento,
  MAPA.concluida,
  MAPA.cancelada,
];
