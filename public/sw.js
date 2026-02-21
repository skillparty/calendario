/**
 * Service Worker for Calendar10
 * Implements offline-first strategy with intelligent caching
 */

/// <reference lib="webworker" />

const sw = /** @type {any} */ (self);

const CACHE_VERSION = 'v2026.02.20-store-modal-v3';
const CACHE_NAME = `calendar10-${CACHE_VERSION}`;
const API_CACHE = `calendar10-api-${CACHE_VERSION}`;
const DB_NAME = 'Calendar10DB';
const DB_VERSION = 1;
const PENDING_OPS_STORE = 'pendingOps';

// Minimal app shell to pre-cache (Vite bundles the rest; runtime caching handles it)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico'
];

// API endpoints to cache
const API_ROUTES = [
  '/api/tasks',
  '/api/auth/me'
];

/**
 * Install event - cache static assets
 */
sw.addEventListener('install', (/** @type {any} */ event) => {
  const installEvent = /** @type {any} */ (event);
  // Installing
  
  installEvent.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Caching static assets - ensure we get fresh versions
        return cache.addAll(APP_SHELL.map(url => new Request(url, {cache: 'reload'})));
      })
      .then(() => sw.skipWaiting())
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

/**
 * Activate event - clean old caches
 */
sw.addEventListener('activate', (/** @type {any} */ event) => {
  const activateEvent = /** @type {any} */ (event);
  // Activating
  
  activateEvent.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('calendar10-') && name !== CACHE_NAME && name !== API_CACHE)
            .map(name => {
              // Deleting old cache
              return caches.delete(name);
            })
        );
      })
      .then(() => sw.clients.claim())
  );
});

/**
 * Fetch event - implement caching strategies
 */
sw.addEventListener('fetch', (/** @type {any} */ event) => {
  const fetchEvent = /** @type {any} */ (event);
  const { request } = fetchEvent;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip cross-origin requests (e.g. backend API on a different domain)
  if (url.origin !== self.location.origin) {
    return;
  }

  // API requests - Network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    fetchEvent.respondWith(networkFirstStrategy(request));
    return;
  }

  // Navigation/HTML requests - Network first to avoid stale app shell
  const acceptHeader = request.headers.get('accept') || '';
  const isNavigation = request.mode === 'navigate' || acceptHeader.includes('text/html');
  if (isNavigation) {
    fetchEvent.respondWith(pageNetworkFirstStrategy(request));
    return;
  }

  // Static assets - Cache first, fallback to network
  if (isStaticAsset(url.pathname)) {
    fetchEvent.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default - Network first
  fetchEvent.respondWith(networkFirstStrategy(request));
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
    const appShell = await cache.match('./index.html');
    return appShell || new Response('Offline', { status: 503 });
  }
}

/**
 * Network first strategy for app pages
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function pageNetworkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: 'no-store' });

    if (response && response.ok) {
      cache.put(request, response.clone());
      return response;
    }

    const cachedPage = await cache.match(request);
    if (cachedPage) return cachedPage;
    const appShell = await cache.match('./index.html');
    return appShell || response;
  } catch (error) {
    const cachedPage = await cache.match(request);
    if (cachedPage) return cachedPage;

    const appShell = await cache.match('./index.html');
    if (appShell) return appShell;

    return new Response('Offline', { status: 503 });
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
    // Network failed, trying cache
    
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
sw.addEventListener('sync', (/** @type {any} */ event) => {
  const syncEvent = /** @type {any} */ (event);
  // Background sync triggered
  
  if (syncEvent.tag === 'sync-tasks') {
    syncEvent.waitUntil(syncTasks());
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
        if (!op.url || !op.method) {
          continue;
        }

        const requestInit = /** @type {any} */ ({
          method: op.method,
          headers: op.headers || { 'Content-Type': 'application/json' }
        });

        if (op.body && op.method !== 'DELETE') {
          requestInit.body = op.body;
        }

        const response = await fetch(op.url, requestInit);
        
        if (response.ok) {
          await removePendingOperation(op.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync operation:', op.id, error);
      }
    }
    
    // Notify clients about sync completion
    const clients = await sw.clients.matchAll();
    clients.forEach((/** @type {any} */ client) => {
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
 * @returns {Promise<any[]>}
 */
async function getPendingOperations() {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_OPS_STORE], 'readonly');
      const store = transaction.objectStore(PENDING_OPS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to read pending operations:', error);
    return [];
  }
}

/**
 * Remove completed operation
 * @param {string} id 
 */
async function removePendingOperation(id) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction([PENDING_OPS_STORE], 'readwrite');
      const store = transaction.objectStore(PENDING_OPS_STORE);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[SW] Failed to remove pending operation:', id, error);
  }
}

/**
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Handle push notifications
 */
sw.addEventListener('push', (/** @type {any} */ event) => {
  const pushEvent = /** @type {any} */ (event);
  const options = {
    body: pushEvent.data ? pushEvent.data.text() : 'Nueva notificación',
    icon: '/app.png',
    badge: '/app.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver tarea'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };

  pushEvent.waitUntil(
    sw.registration.showNotification('Calendar10', options)
  );
});

/**
 * Handle notification clicks
 */
sw.addEventListener('notificationclick', (/** @type {any} */ event) => {
  const notificationEvent = /** @type {any} */ (event);
  // Notification click
  
  notificationEvent.notification.close();

  if (notificationEvent.action === 'explore') {
    notificationEvent.waitUntil(
      sw.clients.openWindow('/')
    );
  }
});

/**
 * Handle messages from clients
 */
sw.addEventListener('message', (/** @type {any} */ event) => {
  const messageEvent = /** @type {any} */ (event);
  // Message from client
  
  if (messageEvent.data.type === 'skip-waiting') {
    sw.skipWaiting();
  }
  
  if (messageEvent.data.type === 'clear-cache') {
    caches.keys().then(names => {
      return Promise.all(
        names.map(name => caches.delete(name))
      );
    });
  }
});
