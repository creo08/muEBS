// @ts-check
// Service Worker von Hand: App-Dateien offline vorhalten. Kein automatisches skipWaiting.
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const parameter = new URL(sw.location.href).searchParams;
const CACHE = `muebs-${parameter.get('v') ?? 'dev'}-${parameter.get('sha') ?? 'dev'}`;

/** Alle Dateien der App; version.json gehört absichtlich nicht dazu. */
const DATEIEN = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/schemen.css',
  'js/app.js',
  'js/admin.js',
  'js/csv.js',
  'js/datenschutz.js',
  'js/db.js',
  'js/geld.js',
  'js/dom.js',
  'js/konstanten.js',
  'js/projekt.js',
  'js/regeln.js',
  'js/schema.js',
  'js/sicherung.js',
  'js/umstieg.js',
  'js/zustand.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'demo/demo.json',
];

sw.addEventListener('install', (e) => {
  // cache: 'reload' umgeht den HTTP-Cache, damit ein Release wirklich neue Dateien bekommt
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))));
});

sw.addEventListener('activate', (e) => {
  // Alte Caches erst hier löschen, nie beim Installieren
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('muebs-') && n !== CACHE).map((n) => caches.delete(n))))
      // beim ersten Start sofort offline-fähig, ohne Neuladen
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') sw.skipWaiting();
});

sw.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== sw.location.origin || url.pathname.endsWith('/version.json')) return;
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const treffer = e.request.mode === 'navigate' ? await c.match('index.html') : await c.match(e.request, { ignoreSearch: true });
      return treffer ?? fetch(e.request);
    }),
  );
});
