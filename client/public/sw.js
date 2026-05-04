const CACHE_NAME = 'nutricrm-v2';
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
  if (event.request.url.includes('/api/') || event.request.url.includes('/trpc')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request).then((fetchResponse) => {
        if (event.request.method !== 'GET') {
          return fetchResponse;
        }

        const responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return fetchResponse;
      });
    })
  );
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', (event) => {
  let data = {
    title: 'NutriCRM',
    body: 'Nova notificação',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    url: '/',
    tag: 'nutricrm',
    type: 'geral'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100],
    tag: data.tag,
    renotify: true,
    data: {
      url: data.url,
      type: data.type,
    },
    actions: getActionsForType(data.type),
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

function getActionsForType(type) {
  switch (type) {
    case 'nova_oportunidade':
      return [{ action: 'open', title: 'Ver Oportunidade' }];
    case 'followup_pendente':
      return [{ action: 'open', title: 'Ver Follow-up' }];
    case 'orcamento_aprovado':
      return [{ action: 'open', title: 'Ver Orcamento' }];
    default:
      return [{ action: 'open', title: 'Abrir NutriCRM' }];
  }
}

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Se já tem uma aba aberta, focar nela
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Senão, abrir nova aba
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  }
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
      await fetch('/api/trpc/sync', {
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
