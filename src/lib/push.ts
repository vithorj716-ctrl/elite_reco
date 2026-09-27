/**
 * Push nativo no aparelho (agente, locadora e central).
 *
 * O envio parte do banco: cada notificação criada dispara o endpoint interno de
 * despacho, então o aviso chega com o app fechado. Aqui cuidamos apenas do lado
 * do aparelho — permissão, inscrição no PushManager e registro no banco.
 *
 * O service worker só é registrado em produção (ver `src/lib/pwa.ts`); dentro do
 * preview/iframe a central de notificações continua funcionando em tempo real,
 * apenas sem o aviso de sistema.
 */
import { supabase } from "@/integrations/supabase/client";

export type EstadoPush = "indisponivel" | "padrao" | "concedida" | "negada" | "inscrito";

export function estadoPush(): EstadoPush {
  if (typeof window === "undefined") return "indisponivel";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window))
    return "indisponivel";
  if (Notification.permission === "granted") return "concedida";
  if (Notification.permission === "denied") return "negada";
  return "padrao";
}

function base64UrlParaUint8(base64: string): Uint8Array {
  const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const bruto = atob(preenchido.replace(/-/g, "+").replace(/_/g, "/"));
  const saida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i += 1) saida[i] = bruto.charCodeAt(i);
  return saida;
}

async function registrarInscricao(usuarioId: string, agenteId?: string) {
  const registro =
    (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
  if (!registro) return false; // sem SW (preview/dev): só avisos dentro do app

  const { chavePublicaPush } = await import("@/lib/push.functions");
  const { chave } = await chavePublicaPush();
  if (!chave) return false;

  let existente = await registro.pushManager.getSubscription();

  // Endpoints antigos do FCM (/fcm/send/) são do protocolo legado do Chrome:
  // o Google os aceita, mas costuma segurar a entrega até o app abrir. Nesse
  // caso trocamos por um endpoint atual antes de registrar o aparelho.
  if (existente && /fcm\.googleapis\.com\/fcm\/send\//.test(existente.endpoint)) {
    const antigo = existente.endpoint;
    const removido = await existente.unsubscribe().catch(() => false);
    if (removido) {
      await supabase.from("push_subscriptions").update({ ativo: false }).eq("endpoint", antigo);
      existente = null;
    }
  }

  const inscricao =
    existente ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaUint8(chave) as BufferSource,
    }));


  const json = inscricao.toJSON();
  if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys["auth"]) return false;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      usuario_id: usuarioId,
      agente_id: agenteId ?? null,
      endpoint: json.endpoint,
      p256dh: json.keys["p256dh"],
      auth: json.keys["auth"],
      navegador: navigator.userAgent.slice(0, 180),
      user_agent: navigator.userAgent.slice(0, 400),
      dispositivo: /android|iphone|ipad/i.test(navigator.userAgent) ? "celular" : "computador",
      ativo: true,
      ultimo_erro: "",
    },
    { onConflict: "endpoint" },
  );
  return !error;
}

/** Pede permissão e registra o aparelho. Retorna o estado final. */
export async function ativarPush(usuarioId: string, agenteId?: string): Promise<EstadoPush> {
  if (estadoPush() === "indisponivel") return "indisponivel";

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "negada" : "padrao";

  const inscrito = await registrarInscricao(usuarioId, agenteId).catch(() => false);
  return inscrito ? "inscrito" : "concedida";
}

/**
 * Revalida a inscrição a cada abertura do app: permissão já concedida antes
 * não significa inscrição válida (navegador pode ter renovado o endpoint).
 */
export async function sincronizarPush(usuarioId: string, agenteId?: string) {
  if (estadoPush() !== "concedida") return;
  await registrarInscricao(usuarioId, agenteId).catch(() => false);
}

/** Este aparelho já está inscrito para receber avisos? */
export async function inscricaoAtiva(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) return false;
  return Boolean(await registro.pushManager.getSubscription());
}

/** Desliga os avisos neste aparelho. */
export async function desativarPush() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const registro = await navigator.serviceWorker.getRegistration();
  const inscricao = await registro?.pushManager.getSubscription();
  if (!inscricao) return;
  await supabase
    .from("push_subscriptions")
    .update({ ativo: false })
    .eq("endpoint", inscricao.endpoint);
  await inscricao.unsubscribe().catch(() => false);
}

let contexto: AudioContext | null = null;

/** Bipe curto de alerta — não depende de arquivo de áudio. */
export function tocarAlerta() {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    contexto = contexto ?? new Ctor();
    void contexto.resume();
    const agora = contexto.currentTime;
    const osc = contexto.createOscillator();
    const ganho = contexto.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, agora);
    osc.frequency.setValueAtTime(1180, agora + 0.12);
    ganho.gain.setValueAtTime(0.0001, agora);
    ganho.gain.exponentialRampToValueAtTime(0.25, agora + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + 0.32);
    osc.connect(ganho).connect(contexto.destination);
    osc.start(agora);
    osc.stop(agora + 0.34);
  } catch {
    /* áudio bloqueado pelo navegador — o aviso visual já cobre */
  }
}

/** Vibração curta em celulares que suportam. */
export function vibrar() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
}
