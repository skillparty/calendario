/**
 * Service Worker for Calendar10
 * This SW now self-unregisters to force clean cache state.
 * All caching is handled by Vite's content-hashed filenames.
 */

/// <reference lib="webworker" />

const sw = /** @type {any} */ (self);

// Immediately take control
sw.addEventListener('install', () => sw.skipWaiting());
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete ALL caches
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // Claim clients so they get the clean state
      await sw.clients.claim();
      // Self-unregister
      await sw.registration.unregister();
      console.info('[SW] Self-unregistered and cleared all caches');
    })()
  );
});

// Don't intercept any fetches — let the browser handle everything natively
