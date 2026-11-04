// Sert toujours le code déjà installé : aucune mise à jour silencieuse.
// La page vérifie l'empreinte du code et demande confirmation avant d'installer une nouvelle version.
// Ce fichier ne doit pas changer d'une version à l'autre : une mise à jour approuvée passe par une désinstallation complète.
// Aucune donnée personnelle ne passe ici : elles restent chiffrées dans IndexedDB.
//
// Cloudflare redirige « /index.html » vers « / ». Safari refuse d'afficher une page servie par un
// service worker si la réponse en cache est issue d'une redirection : on ne met donc en cache que « ./ »,
// et toute réponse redirigée est recopiée sans sa trace de redirection.
const CACHE = 'mycellar-v2';
const SHELL = ['./', './sw.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
const clean = async r => r && r.redirected ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(async u => {
    const r = await fetch(new Request(u, { cache: 'reload' }));
    if (!r.ok) throw new Error(u + ' : ' + r.status);
    await c.put(u, await clean(r));
  }))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Le contrôle d'empreinte passe au réseau, mais jamais pour une navigation :
  // une simple URL avec ?fresh permettrait sinon de charger du code non approuvé.
  const nav = req.mode === 'navigate' || req.destination === 'document';
  if (url.searchParams.has('fresh') && !nav) return;
  // Toute navigation (/, /index.html, /?u=…) reçoit la page en cache
  const page = nav || /\/(index\.html)?$/.test(url.pathname);
  const key = page ? new URL('./', location.href).href : req;
  e.respondWith(caches.match(key).then(clean).then(r => r || fetch(req)));
});
