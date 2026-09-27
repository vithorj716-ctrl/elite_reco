/**
 * Registro único e protegido do service worker.
 * Nunca registra em desenvolvimento, dentro de iframe ou no preview da Lovable.
 */

const CAMINHO_SW = "/sw.js";

function hostBloqueado(host: string) {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

async function desregistrar() {
  if (!("serviceWorker" in navigator)) return;
  const registros = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registros
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").includes(CAMINHO_SW))
      .map((r) => r.unregister()),
  );
}

export async function registrarServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const emIframe = window.self !== window.top;
  const desligado = new URL(window.location.href).searchParams.get("sw") === "off";
  const recusar =
    !import.meta.env.PROD || emIframe || desligado || hostBloqueado(window.location.hostname);

  if (recusar) {
    await desregistrar();
    return;
  }

  try {
    await navigator.serviceWorker.register(CAMINHO_SW, { scope: "/" });
  } catch (e) {
    console.warn("Service worker não registrado", e);
  }
}
