/* Handlers de push importados pelo service worker gerado (Workbox).
   Mantido em JavaScript puro: roda no escopo do service worker.

   Responsabilidades:
   - mostrar a notificação do sistema mesmo com o app fechado;
   - avisar também as janelas abertas para atualização imediata da interface;
   - abrir a ordem certa no clique. */

self.addEventListener("push", (evento) => {
  let dados = {
    titulo: "Recolhe",
    mensagem: "Você tem uma novidade na operação.",
    ordemId: null,
    url: null,
    eventId: null,
  };
  try {
    if (evento.data) dados = { ...dados, ...evento.data.json() };
  } catch (e) {
    if (evento.data) dados.mensagem = evento.data.text();
  }

  const url = dados.url || (dados.ordemId ? `/agente/${dados.ordemId}` : "/agente");

  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const janela of janelas) {
        janela.postMessage({ tipo: "push-recebido", aviso: { ...dados, url } });
      }

      // O aviso do sistema é sempre exibido. Assim a entrega não depende de
      // uma janela React estar montada ou pronta para receber postMessage.
      await self.registration.showNotification(dados.titulo, {
        body: dados.mensagem,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: dados.eventId || dados.ordemId || "recolhe",
        renotify: true,
        requireInteraction: dados.tipo === "nova_ordem",
        vibrate: [140, 70, 140],
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/agente";
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if ("focus" in janela) {
          janela.navigate?.(destino);
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});

/* Inscrição renovada pelo navegador: o app reinscreve na próxima abertura. */
self.addEventListener("pushsubscriptionchange", (evento) => {
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) janela.postMessage({ tipo: "push-reinscrever" });
    }),
  );
});
