/*
 * Service worker do Recepção.
 *
 * Estratégia de cache SEGURA:
 *  - Armazena apenas arquivos estáticos e públicos (JS/CSS com hash, fontes,
 *    ícones e a página offline).
 *  - NUNCA armazena páginas HTML autenticadas, respostas de dados, Server
 *    Actions ou exportações — dados pessoais não ficam no aparelho.
 *  - Navegações sempre vão à rede; sem conexão, mostra a página offline.
 */
const VERSION = "recepcao-v2";
const STATIC_CACHE = `${VERSION}-static`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|png|svg|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: sempre da rede (contêm dados do usuário). Offline → aviso.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html").then((r) => r || Response.error())),
    );
    return;
  }

  // Arquivos estáticos versionados: cache primeiro.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Demais requisições (dados, RSC, exportação): passam direto, sem cache.
});

/* ------------------------------------------------------------------------ */
/* Notificações (Web Push)                                                  */
/* ------------------------------------------------------------------------ */
self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { body: event.data ? event.data.text() : "" };
  }
  const titulo = typeof dados.title === "string" ? dados.title.slice(0, 120) : "Recepção";
  // Só caminhos internos (evita abrir sites externos a partir de uma notificação).
  const url = typeof dados.url === "string" && dados.url.startsWith("/") && !dados.url.startsWith("//") ? dados.url : "/";
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: typeof dados.body === "string" ? dados.body.slice(0, 400) : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof dados.tag === "string" ? dados.tag : undefined,
      renotify: true,
      data: { url },
      lang: "pt-BR",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && "focus" in janela) {
          return janela.focus().then((j) => (j && "navigate" in j ? j.navigate(destino) : undefined));
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
