// Le changement de nom purge l'ancien cache : l'ancien service worker stockait
// aussi les reponses de l'API Supabase (voir plus bas), on veut s'en debarrasser.
const CACHE_NAME = 'domitemps-v2';

// Uniquement des ressources qui existent en PRODUCTION. '/src/index.css' n'existe
// qu'en developpement : comme cache.addAll echoue EN BLOC des qu'une URL manque,
// sa presence empechait toute mise en cache a l'installation.
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/apple-touch-icon.png',
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(() => {
        console.log('Cache addAll failed, continuing...');
      });
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // Only cache http/https requests, ignore chrome-extension, etc.
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // On ne met en cache QUE les ressources de l'application elle-meme.
  // Les appels a l'API (Supabase) sont laisses au navigateur, pour deux raisons :
  //  - ils transportent des donnees personnelles de clients, qui n'ont rien a faire
  //    dans le stockage du navigateur, hors du controle de l'application ;
  //  - en cas de coupure reseau, servir une reponse en cache afficherait des donnees
  //    perimees sans le dire, ce qui est pire qu'une erreur franche.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for later use
        if (response && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {
              // Silently ignore cache errors
            });
          });
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache when network fails
        return caches.match(event.request);
      })
  );
});
