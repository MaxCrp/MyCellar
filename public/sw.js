// Sert toujours le code déjà installé : aucune mise à jour silencieuse.
// La page vérifie l'empreinte du code et demande confirmation avant d'installer une nouvelle version.
// Ce fichier ne doit jamais changer : une mise à jour approuvée passe par une désinstallation complète.
// Aucune donnée personnelle ne passe ici : elles restent chiffrées dans IndexedDB.
const CACHE = 'mycellar-v1';
const SHELL = ['./', './index.html', './sw.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Le contrôle d'empreinte passe au réseau, mais jamais pour une navigation :
  // une simple URL avec ?fresh permettrait sinon de charger du code non approuvé.
  if (url.searchParams.has('fresh') && req.destination !== 'document' && req.mode !== 'navigate') return;
  const key = req.mode === 'navigate' ? new Request(new URL('./index.html', location.href).href) : req;
  e.respondWith(caches.match(key).then(r => r || fetch(req)));
});
