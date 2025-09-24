/**
 * Service Worker for Calendar10
 * Implements offline-first strategy with intelligent caching
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `calendar10-${CACHE_VERSION}`;
const API_CACHE = `calendar10-api-${CACHE_VERSION}`;

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/state.js',
  '/api.js',
  '/calendar.js',
  '/agenda.js',
  '/pdf.js',
  '/types.d.ts',
  '/loquito.png',
  '/favicon.ico'
];

// API endpoints to cache
const API_ROUTES = [
  '/api/tasks',
  '/api/auth/me'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

/**
 * Activate event - clean old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('calendar10-') && name !== CACHE_NAME && name !== API_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets - Cache first, fallback to network
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default - Network first
  event.respondWith(networkFirstStrategy(request));
});

/**
 * Cache first strategy
 * @param {Request} request 
 * @returns {Promise<Response>}
 */
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    // Update cache in background
    fetch(request)
      .then(response => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {});
    
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    // Return offline page if available
    const offlinePage = await cache.match('/offline.html');
    return offlinePage || new Response('Offline', { status: 503 });
  }
}

/**
 * Network first strategy
 * @param {Request} request 
 * @returns {Promise<Response>}
 */
async function networkFirstStrategy(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        error: 'Offline', 
        message: 'No hay conexión a internet y no hay datos en caché' 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Check if path is a static asset
 * @param {string} pathname 
 * @returns {boolean}
 */
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.html', '.css', '.js', '.json', 
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot'
  ];
  
  return staticExtensions.some(ext => pathname.endsWith(ext)) || pathname === '/';
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered');
  
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

/**
 * Sync tasks with backend
 */
async function syncTasks() {
  try {
    // Get pending operations from IndexedDB
    const pendingOps = await getPendingOperations();
    
    for (const op of pendingOps) {
      try {
        const response = await fetch(op.url, {
          method: op.method,
          headers: op.headers,
          body: op.body
        });
        
        if (response.ok) {
          await removePendingOperation(op.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync operation:', op.id, error);
      }
    }
    
    // Notify clients about sync completion
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'sync-complete',
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

/**
 * Get pending operations from IndexedDB
 * @returns {Promise<Array>}
 */
async function getPendingOperations() {
  // This would connect to IndexedDB
  // Placeholder for now
  return [];
}

/**
 * Remove completed operation
 * @param {string} id 
 */
async function removePendingOperation(id) {
  // Remove from IndexedDB
  // Placeholder for now
}

/**
 * Handle push notifications
 */
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: '/loquito.png',
    badge: '/loquito.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver tarea',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: 'Cerrar',
        icon: '/icons/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Calendar10', options)
  );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

/**
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message from client:', event.data);
  
  if (event.data.type === 'skip-waiting') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'clear-cache') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(
          names.map(name => caches.delete(name))
        );
      })
    );
  }
});
