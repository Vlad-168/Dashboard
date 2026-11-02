/* Офлайн‑кэш оболочки приложения. Меняй VERSION при изменении файлов — iPhone подтянет обновление. */
const VERSION = "dash-v4";
const SHELL = [
  "./", "index.html", "css/styles.css", "js/data.js", "js/app.js", "config.example.js",
  "manifest.webmanifest", "icons/apple-touch-icon.png?v=2", "icons/icon-192.png?v=2", "icons/icon-512.png?v=2", "icons/favicon.png?v=2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Свои файлы: сначала сеть (чтобы видеть свежую версию), офлайн — из кэша.
// GitHub API и шрифты не трогаем.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith("config.local.js")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html")))
  );
});
