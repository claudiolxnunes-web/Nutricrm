const CACHE_NAME = 'nutricrm-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Interceptação de requisições
self.addEventListener('fetch', (event) => {
  // Não cachear requisições da API
  if (event.request.url.includes('/trpc')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retorna do cache se encontrou
      if (response) {
        return response;
      }

      // Senão, faz a requisição normal
      return fetch(event.request).then((fetchResponse) => {
        // Não cachear se não for GET
        if (event.request.method !== 'GET') {
          return fetchResponse;
        }

        // Cachear a resposta
        const responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return fetchResponse;
      });
    })
  );
});

// Notificações push (para futuras implementações)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Nova notificação do NutriCRM',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification('NutriCRM', options)
  );
});

// Sync em background
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-vendedor-dados') {
    event.waitUntil(syncVendedorDados());
  }
});

async function getDadosPendentes() {
  try {
    const raw = await new Promise((resolve) => {
      const req = indexedDB.open('vendedorSync', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('pendentes')) { resolve([]); return; }
        const tx = db.transaction('pendentes', 'readonly');
        const store = tx.objectStore('pendentes');
        const all = store.getAll();
        all.onsuccess = () => resolve(all.result);
        all.onerror = () => resolve([]);
      };
      req.onerror = () => resolve([]);
    });
    return raw || [];
  } catch (_) {
    return [];
  }
}

async function marcarComoSincronizado(id) {
  return new Promise((resolve) => {
    const req = indexedDB.open('vendedorSync', 1);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pendentes')) { resolve(); return; }
      const tx = db.transaction('pendentes', 'readwrite');
      tx.objectStore('pendentes').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
    req.onerror = () => resolve();
  });
}

async function syncVendedorDados() {
  const dados = await getDadosPendentes();
  for (const dado of dados) {
    try {
      await fetch('/trpc/sync', {
        method: 'POST',
        body: JSON.stringify(dado),
        headers: { 'Content-Type': 'application/json' }
      });
      await marcarComoSincronizado(dado.id);
    } catch (err) {
      console.error('Falha ao sincronizar:', err);
    }
  }
}
