"use strict";

const CACHE_VERSION = "hexagone-v3";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const SHELL_ASSETS = [
  "./",
  "index.html",
  "about.html",
  "404.html",
  "style.css",
  "app.js",
  "about.js",
  "manifest.webmanifest",
  "manifest.fr.webmanifest",
  "manifest.en.webmanifest",
  "vendor/leaflet/leaflet.css",
  "vendor/leaflet/leaflet.js",
  "vendor/leaflet/images/layers.png",
  "vendor/leaflet/images/layers-2x.png",
  "vendor/leaflet/images/marker-icon.png",
  "vendor/leaflet/images/marker-icon-2x.png",
  "vendor/leaflet/images/marker-shadow.png",
  "icons/favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("hexagone-") && key !== SHELL_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first per tutto (shell incluso, non solo il dataset): l'app
  // resta sempre aggiornata quando c'e' connessione, con fallback alla
  // cache solo per l'uso offline. Prima l'app shell (index.html/app.js/
  // style.css) era cache-first con aggiornamento in background: HTML e JS
  // venivano cacheati/aggiornati indipendentemente l'uno dall'altro, non
  // come unita' atomica, cosi' un utente poteva ritrovarsi con un
  // index.html nuovo abbinato a un app.js vecchio (o viceversa) dopo un
  // deploy, con elementi dell'interfaccia presenti ma non funzionanti.
  const isData = url.pathname.endsWith("data.json");
  const cacheName = isData ? DATA_CACHE : SHELL_CACHE;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(cacheName).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Fallback per le navigazioni offline verso un URL non in cache:
          // succede per un link diretto a /citta/{id} (route solo
          // client-side, nessun file corrispondente esiste davvero) aperto
          // mentre offline. Si serve comunque l'app shell: e' app.js stesso
          // (leggendo l'URL) ad aprire la scheda della citta' giusta una
          // volta partito, se quella citta' e' nel data.json gia' in cache.
          if (request.mode === "navigate") return caches.match("index.html");
          return undefined;
        })
      )
  );
});
