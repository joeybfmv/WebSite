// sw.js — service worker : site installable + consultation hors ligne des pages déjà visitées.
// Stratégie : réseau d'abord (le site reste toujours à jour après un déploiement), cache en secours.
// Ne touche ni à Supabase ni aux ressources externes, ni à l'administration.
const VERSION = "joey-v1";
const PRECACHE = [
  "offline.html", "index.html",
  "css/variables.css", "css/reset.css", "css/global.css", "css/layout.css", "css/components.css", "css/mobile.css",
  "assets/images/logo/joey-logo-floral.svg", "assets/icons/icon-192.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // Supabase, CDN, Google… : jamais interceptés
  if (url.pathname.includes("/admin/")) return;                    // administration : toujours en direct

  const isImage = /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(url.pathname);

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("offline.html")))
    );
    return;
  }

  if (isImage) {                                                   // images : cache d'abord, mise à jour en arrière-plan
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  event.respondWith(                                               // CSS / JS : réseau d'abord
    fetch(req)
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req))
  );
});
