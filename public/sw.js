const CACHE_NAME = 'firecheck-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Descarta caches de versões anteriores, senão o app continuaria servindo
  // arquivos antigos depois de um deploy.
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só GET do próprio site entra em cache. Requisições da API ficam de fora:
  // servir dado velho de checklist ou de ponto seria pior que dizer que está
  // offline, e a fila offline do app já cuida do envio.
  const url = new URL(req.url);
  const cacheavel =
    req.method === 'GET' &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith('/api/');

  if (!cacheavel) {
    event.respondWith(fetch(req));
    return;
  }

  // Rede primeiro, guardando a cópia. Antes o cache nunca era populado, então o
  // fallback offline sempre falhava e o app anunciava um modo offline que na
  // prática não existia.
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia)).catch(() => {});
        }
        return resp;
      })
      .catch(async () => {
        const doCache = await caches.match(req);
        if (doCache) return doCache;
        // Navegação sem cache específico: devolve a casca do app, para o React
        // assumir e mostrar os rascunhos e a fila guardados no aparelho.
        if (req.mode === 'navigate') {
          const casca = await caches.match('/index.html');
          if (casca) return casca;
        }
        return Response.error();
      })
  );
});

// Suporte a Notificações Push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: 'FireCheck', body: 'Nova atualização disponível' };
  
  const options = {
    body: data.body,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
