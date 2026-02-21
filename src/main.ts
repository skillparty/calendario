import { mount } from 'svelte';
import './assets/css/styles.css';
import './assets/css/calendar-navigation.css';
import './assets/css/agenda-professional.css';
import './assets/css/dark-mode.css';
import './assets/css/mobile-improvements.css';
import './assets/css/header-footer-minimal.css';
import './assets/css/design-polish.css';
import App from './App.svelte';



// ── Force-clear stale Service Workers & caches from old deployments ──
(async () => {
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const reg of registrations) {
                await reg.unregister();
                console.info('[SW] Unregistered stale service worker:', reg.scope);
            }
        }
        // Clear all caches
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) {
                await caches.delete(key);
                console.info('[Cache] Deleted cache:', key);
            }
        }
    } catch (err) {
        console.warn('[Cache cleanup] Error:', err);
    }
})();

const app = mount(App, {
    target: document.getElementById('app')!,
});

export default app;
