// sw.js — CardGoal Service Worker
// Cambia CACHE_VERSION en cada deploy para forzar actualización en PWAs instaladas
const CACHE_VERSION = "cardgoal-v8";
const ASSETS = ["/", "/index.html", "/manifest.json"];

// Instalación: guarda el shell básico
self.addEventListener("install", e => {
  self.skipWaiting(); // activa inmediatamente sin esperar a que cierren las pestañas
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS).catch(()=>{}))
  );
});

// Activación: borra cachés antiguas de versiones anteriores
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // toma control de todas las pestañas abiertas
  );
});

// Fetch: network-first para JS/CSS (siempre la última versión), cache-first para imágenes
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // No interceptar llamadas a APIs (Anthropic, eBay, Supabase, etc.)
  if (url.pathname.startsWith("/api/") ||
      url.hostname.includes("supabase") ||
      url.hostname.includes("anthropic") ||
      url.hostname.includes("ebay") ||
      url.hostname.includes("resend")) {
    return; // deja pasar sin caché
  }

  // Para JS, CSS y HTML: network-first (siempre intenta traer la versión más nueva)
  if (e.request.destination === "script" ||
      e.request.destination === "style"  ||
      e.request.destination === "document") {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Guarda la versión nueva en caché
          const clone = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request)) // si no hay red, usa la caché
    );
    return;
  }

  // Para imágenes y otros recursos: cache-first (más rápido)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});

// Mensaje desde la app para forzar actualización manual
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
