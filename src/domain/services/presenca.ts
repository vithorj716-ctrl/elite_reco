/**
 * Disponibilidade real do agente.
 *
 * "Botão ligado" não é o mesmo que "conectado": o estado só é considerado
 * disponível quando o servidor recebeu um sinal de presença recente. As regras
 * aqui espelham exatamente as do banco (`agente_disponivel`), para que a tela
 * nunca prometa algo que a distribuição vai negar.
 */
import type { Agente, Banco } from "@/domain/types";

/** Janela de presença: mesmo valor usado pelo banco. */
export const JANELA_PRESENCA_MS = 90_000;
/** Intervalo do sinal enviado pelo aplicativo — bem abaixo da janela. */
export const INTERVALO_HEARTBEAT_MS = 20_000;

export type EstadoAgente =
  | "offline"
  | "disponivel"
  | "ocupado"
  | "em_rota"
  | "conexao_perdida"
  | "indisponivel";

export const ROTULO_ESTADO_AGENTE: Record<EstadoAgente, string> = {
  offline: "Offline",
  disponivel: "Online disponível",
  ocupado: "Online ocupado",
  em_rota: "Em rota",
  conexao_perdida: "Conexão perdida",
  indisponivel: "Indisponível",
};

/** Classe de cor por estado — o vermelho fica só para conexão perdida. */
export const COR_ESTADO_AGENTE: Record<EstadoAgente, string> = {
  offline: "text-muted-foreground border-border-strong",
  disponivel: "text-success border-success/40",
  ocupado: "text-warning border-warning/40",
  em_rota: "text-primary border-primary/40",
  conexao_perdida: "text-destructive border-destructive/40",
  indisponivel: "text-muted-foreground border-border-strong",
};

export function presencaRecente(vistoEm?: string | undefined, agora = Date.now()) {
  if (!vistoEm) return false;
  const quando = new Date(vistoEm).getTime();
  return Number.isFinite(quando) && agora - quando < JANELA_PRESENCA_MS;
}

/** Operações que ocupam o agente — a mesma lista respeitada pelo sorteio. */
export function operacoesAbertas(banco: Banco, agenteId: string) {
  const ordens = banco.ordens.filter(
    (o) => o.agenteId === agenteId && (o.status === "distribuida" || o.status === "em_andamento"),
  );
  const vistorias = banco.vistorias.filter(
    (v) => v.agenteId === agenteId && (v.status === "distribuida" || v.status === "em_andamento"),
  );
  return { ordens, vistorias };
}

/**
 * Estado operacional do agente.
 *
 * ONLINE é decisão explícita do agente (botão) e vive no servidor. A comunicação
 * recente do aparelho é informação separada (`presencaRecente`) e NUNCA derruba a
 * disponibilidade: PWA em segundo plano, tela bloqueada ou app fechado continuam
 * online até o próprio agente ficar offline.
 */
export function estadoAgente(banco: Banco, agente: Agente, agora = Date.now()): EstadoAgente {
  const { ordens, vistorias } = operacoesAbertas(banco, agente.id);
  const emRota =
    ordens.some((o) => o.status === "em_andamento") ||
    vistorias.some((v) => v.status === "em_andamento");
  const ocupado = ordens.length > 0 || vistorias.length > 0;

  void agora;
  if (!agente.ativo || agente.situacao !== "ativo") return "indisponivel";
  if (!agente.online) return emRota ? "em_rota" : "offline";
  if (emRota) return "em_rota";
  if (ocupado) return "ocupado";
  return "disponivel";
}

/** Pode receber uma NOVA ordem? Espelha `agente_disponivel` no banco. */
export function podeReceberOrdem(banco: Banco, agente: Agente, agora = Date.now()) {
  return estadoAgente(banco, agente, agora) === "disponivel";
}


/** Ordem/vistoria que o agente está executando agora, para o painel da central. */
export function operacaoAtual(banco: Banco, agenteId: string): string {
  const { ordens, vistorias } = operacoesAbertas(banco, agenteId);
  const ordem = ordens[0];
  if (ordem) return `Recolhimento ${ordem.codigo} · ${ordem.placa}`;
  const vistoria = vistorias[0];
  if (vistoria) return `Vistoria ${vistoria.codigo}`;
  return "—";
}

/** "há 8 segundos", "há 35 minutos" — leitura direta para a central. */
export function desde(quando?: string | undefined, agora = Date.now()): string {
  if (!quando) return "nunca conectou";
  const ms = agora - new Date(quando).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "agora";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `há ${s} segundo${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} minuto${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} hora${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? "" : "s"}`;
}
