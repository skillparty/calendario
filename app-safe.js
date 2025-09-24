/**
 * Safe version of enhanced app that gracefully handles missing modules
 * This ensures the app works even if new modules fail to load
 */

// Try to import enhanced modules with fallbacks
let enhancedState = null;
let eventBus = null;
let performanceMonitor = null;

// Graceful imports with error handling
async function loadEnhancedModules() {
  try {
    const stateModule = await import('./state-enhanced.js');
    enhancedState = stateModule.enhancedState;
    console.log('[Safe] Enhanced state loaded');
  } catch (error) {
    console.warn('[Safe] Enhanced state not available:', error.message);
  }

  try {
    const eventModule = await import('./utils/EventBus.js');
    eventBus = eventModule.eventBus;
    console.log('[Safe] Event bus loaded');
  } catch (error) {
    console.warn('[Safe] Event bus not available:', error.message);
  }

  try {
    const perfModule = await import('./utils/PerformanceMonitor.js');
    performanceMonitor = perfModule.performanceMonitor;
    console.log('[Safe] Performance monitor loaded');
  } catch (error) {
    console.warn('[Safe] Performance monitor not available:', error.message);
  }
}

// Safe offline indicator without dependencies
function setupOfflineIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'offline-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff5252;
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    transition: all 0.3s ease;
    transform: translateX(120%);
    opacity: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  indicator.innerHTML = `
    <span style="animation: pulse 2s infinite;">📡</span>
    <span>Modo Offline</span>
  `;
  document.body.appendChild(indicator);

  // Add pulse animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);

  // Update indicator on online/offline
  function updateOfflineStatus() {
    if (navigator.onLine) {
      indicator.style.transform = 'translateX(120%)';
      indicator.style.opacity = '0';
      document.body.classList.remove('offline');
    } else {
      indicator.style.transform = 'translateX(0)';
      indicator.style.opacity = '1';
      document.body.classList.add('offline');
    }
  }

  window.addEventListener('online', updateOfflineStatus);
  window.addEventListener('offline', updateOfflineStatus);
  
  // Initial check
  updateOfflineStatus();
}

// Safe Service Worker registration
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(registration => {
          console.log('[Safe] ServiceWorker registered:', registration.scope);
        })
        .catch(err => {
          console.log('[Safe] ServiceWorker registration failed:', err.message);
          // App continues to work without SW
        });
    });
  }
}

// Safe keyboard shortcuts without dependencies
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + N: New task
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      const today = new Date().toISOString().split('T')[0];
      if (typeof window.showTaskInputModal === 'function') {
        window.showTaskInputModal(today);
      }
    }

    // Escape: Close modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
    }
  });
}

// Safe notification function
function showNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: './public/app.png',
        badge: './public/app.png'
      });
    } catch (error) {
      console.warn('[Safe] Notification failed:', error.message);
    }
  }
}

// Safe search function without enhanced state
function setupBasicSearch() {
  // Create simple search modal
  const searchModal = document.createElement('div');
  searchModal.id = 'search-modal';
  searchModal.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 10000;
    align-items: center;
    justify-content: center;
  `;
  
  searchModal.innerHTML = `
    <div style="background: white; padding: 20px; border-radius: 8px; width: 90%; max-width: 500px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h2 style="margin: 0;">Buscar Tareas</h2>
        <button onclick="this.closest('#search-modal').style.display='none'" style="border: none; background: none; font-size: 20px; cursor: pointer;">✕</button>
      </div>
      <input type="text" id="search-input" placeholder="Buscar por título o descripción..." style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 15px;">
      <div id="search-results" style="max-height: 300px; overflow-y: auto;"></div>
    </div>
  `;
  
  document.body.appendChild(searchModal);

  // Basic search functionality using existing state
  const searchInput = searchModal.querySelector('#search-input');
  const searchResults = searchModal.querySelector('#search-results');
  
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    if (query.length < 2) {
      searchResults.innerHTML = '';
      return;
    }

    // Use existing state from state.js
    if (typeof window.state !== 'undefined' && window.state.tasks) {
      const allTasks = Object.values(window.state.tasks).flat();
      const results = allTasks.filter(task => 
        task.title.toLowerCase().includes(query) ||
        (task.description && task.description.toLowerCase().includes(query))
      );

      if (results.length === 0) {
        searchResults.innerHTML = '<p style="color: #666; text-align: center;">No se encontraron resultados</p>';
      } else {
        searchResults.innerHTML = results.map(task => `
          <div style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer;" onclick="this.closest('#search-modal').style.display='none'">
            <h4 style="margin: 0 0 5px 0;">${task.title}</h4>
            ${task.description ? `<p style="margin: 0; color: #666; font-size: 14px;">${task.description}</p>` : ''}
            ${task.date ? `<span style="color: #999; font-size: 12px;">${task.date}</span>` : ''}
          </div>
        `).join('');
      }
    }
  });

  // Ctrl/Cmd + F: Focus search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchModal.style.display = 'flex';
      searchInput.focus();
    }
  });
}

// Initialize safe enhancements
function initSafeEnhancements() {
  console.log('[Safe] Initializing safe enhancements...');
  
  setupOfflineIndicator();
  registerServiceWorker();
  setupKeyboardShortcuts();
  setupBasicSearch();
  
  // Try to load enhanced modules
  loadEnhancedModules().then(() => {
    console.log('[Safe] Enhanced modules loading completed');
    
    // Setup enhanced features if available
    if (eventBus) {
      eventBus.on('task:created', (event) => {
        showNotification('Tarea creada', event.payload.title);
      });
    }
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSafeEnhancements);
} else {
  initSafeEnhancements();
}

// Export for debugging
window.safeApp = {
  enhancedState,
  eventBus,
  performanceMonitor,
  showNotification
};
