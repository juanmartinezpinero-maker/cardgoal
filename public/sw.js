// CardGoal Service Worker — v2
const CACHE = "cardgoal-v2";
const STATIC = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC).catch(() => {}))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Nunca interceptar llamadas API — dejar pasar directamente
  if (url.pathname.startsWith("/api/")) return;

  // Nunca interceptar peticiones externas (eBay, Anthropic, Supabase)
  if (url.origin !== self.location.origin) return;

  // JS y CSS — siempre de la red (sin caché)
  if (e.request.destination === "script" || e.request.destination === "style") {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // HTML — network first
  if (e.request.destination === "document" || e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request, { cache: "no-cache" })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Resto (imágenes, fonts) — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        // Solo cachear si la respuesta es válida
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return response;
      });
    })
  );
});
