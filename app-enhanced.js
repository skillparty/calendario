/**
 * Enhanced app.js that integrates new modules with existing functionality
 * Provides progressive enhancement while maintaining backward compatibility
 */

// Import existing modules
import { state, setCurrentDate, setTasks, getTasks, setUserSession, setUserGistId, setLastGistUpdatedAt, notifyTasksUpdated } from './state.js';
import { API_BASE_URL, isLoggedInWithBackend, loadTasksIntoState, pushLocalTasksToBackend } from './api.js';
import { renderCalendar, initCalendar } from './calendar.js';
import { renderAgenda } from './agenda.js';
import { showPdfExportModal } from './pdf.js';

// Import new enhanced modules
import { enhancedState } from './state-enhanced.js';
import { eventBus } from './utils/EventBus.js';
import { performanceMonitor, debounce, throttle, setupLazyLoading } from './utils/PerformanceMonitor.js';

// Import existing app.js functionality
import './app.js';

/**
 * Enhanced initialization
 */
class EnhancedApp {
  constructor() {
    this.setupPerformanceMonitoring();
    this.setupEventListeners();
    this.setupOfflineIndicator();
    this.optimizeRendering();
    this.setupKeyboardShortcuts();
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor long tasks
    performanceMonitor.measure('app-init', () => {
      console.log('[Enhanced] Initializing enhanced features...');
    });

    // Log performance report periodically in development
    if (window.location.hostname === 'localhost') {
      setInterval(() => {
        performanceMonitor.logReport();
      }, 30000); // Every 30 seconds
    }

    // Setup lazy loading for images
    setupLazyLoading();
  }

  /**
   * Setup enhanced event listeners
   */
  setupEventListeners() {
    // Listen to task events
    eventBus.on('task:created', (event) => {
      console.log('[Enhanced] Task created:', event.payload);
      this.showNotification('Tarea creada', event.payload.title);
    });

    eventBus.on('task:updated', (event) => {
      console.log('[Enhanced] Task updated:', event.payload);
    });

    eventBus.on('task:deleted', (event) => {
      console.log('[Enhanced] Task deleted:', event.payload);
    });

    // Listen to sync events
    eventBus.on('sync:completed', () => {
      console.log('[Enhanced] Sync completed');
      this.showSyncIndicator('Sincronizado', 'success');
    });

    eventBus.on('sync:failed', (event) => {
      console.error('[Enhanced] Sync failed:', event.payload);
      this.showSyncIndicator('Error de sincronización', 'error');
    });

    // Listen to UI events
    eventBus.on('ui:loading', (event) => {
      this.toggleLoadingState(event.payload);
    });

    eventBus.on('ui:error', (event) => {
      this.showError(event.payload.message);
    });
  }

  /**
   * Setup offline indicator
   */
  setupOfflineIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.className = 'offline-indicator hidden';
    indicator.innerHTML = `
      <span class="offline-icon">📡</span>
      <span class="offline-text">Modo Offline</span>
    `;
    document.body.appendChild(indicator);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .offline-indicator {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff5252;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 10000;
        transition: all 0.3s ease;
      }
      
      .offline-indicator.hidden {
        transform: translateX(120%);
        opacity: 0;
      }
      
      body.offline .offline-indicator {
        transform: translateX(0);
        opacity: 1;
      }
      
      .offline-icon {
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      /* Loading overlay */
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      
      .loading-overlay.active {
        opacity: 1;
        pointer-events: all;
      }
      
      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #f3f3f3;
        border-top: 4px solid #edae49;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Sync indicator */
      .sync-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        transition: all 0.3s ease;
        transform: translateY(100px);
        opacity: 0;
      }
      
      .sync-indicator.show {
        transform: translateY(0);
        opacity: 1;
      }
      
      .sync-indicator.success {
        background: #4caf50;
        color: white;
      }
      
      .sync-indicator.error {
        background: #f44336;
        color: white;
      }
    `;
    document.head.appendChild(style);

    // Update indicator on online/offline
    window.addEventListener('online', () => {
      indicator.classList.add('hidden');
    });

    window.addEventListener('offline', () => {
      indicator.classList.remove('hidden');
    });
  }

  /**
   * Optimize rendering with debounce and throttle
   */
  optimizeRendering() {
    // Debounce calendar rendering
    const debouncedRenderCalendar = debounce(() => {
      performanceMonitor.measure('render-calendar', () => {
        renderCalendar();
      });
    }, 300);

    // Debounce agenda rendering
    const debouncedRenderAgenda = debounce(() => {
      performanceMonitor.measure('render-agenda', () => {
        const monthFilter = document.getElementById('month-filter')?.value || 'all';
        const statusFilter = document.getElementById('status-filter')?.value || 'all';
        renderAgenda(monthFilter, statusFilter);
      });
    }, 300);

    // Override notifyTasksUpdated to use debounced renders
    const originalNotify = notifyTasksUpdated;
    window.notifyTasksUpdated = function() {
      originalNotify();
      
      const calendarView = document.getElementById('calendar-view');
      const agendaView = document.getElementById('agenda-view');
      
      if (calendarView && !calendarView.classList.contains('hidden')) {
        debouncedRenderCalendar();
      }
      if (agendaView && !agendaView.classList.contains('hidden')) {
        debouncedRenderAgenda();
      }
    };

    // Throttle scroll events
    const throttledScroll = throttle(() => {
      // Handle infinite scroll or lazy loading
    }, 100);

    window.addEventListener('scroll', throttledScroll, { passive: true });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + N: New task
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        const today = new Date().toISOString().split('T')[0];
        if (typeof window.showTaskInputModal === 'function') {
          window.showTaskInputModal(today);
        }
      }

      // Ctrl/Cmd + S: Save/Sync
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.syncNow();
      }

      // Ctrl/Cmd + F: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.focusSearch();
      }

      // Ctrl/Cmd + P: Export PDF
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        showPdfExportModal();
      }

      // Escape: Close modals
      if (e.key === 'Escape') {
        this.closeAllModals();
      }

      // Tab navigation between views
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        if (activeElement?.id === 'calendar-btn') {
          e.preventDefault();
          document.getElementById('agenda-btn')?.focus();
        } else if (activeElement?.id === 'agenda-btn') {
          e.preventDefault();
          document.getElementById('calendar-btn')?.focus();
        }
      }
    });
  }

  /**
   * Show notification
   */
  showNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/public/app.png',
        badge: '/public/app.png',
        vibrate: [200, 100, 200]
      });
    }
  }

  /**
   * Show sync indicator
   */
  showSyncIndicator(message, type = 'success') {
    let indicator = document.getElementById('sync-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'sync-indicator';
      indicator.className = 'sync-indicator';
      document.body.appendChild(indicator);
    }

    indicator.textContent = message;
    indicator.className = `sync-indicator show ${type}`;

    setTimeout(() => {
      indicator.classList.remove('show');
    }, 3000);
  }

  /**
   * Toggle loading state
   */
  toggleLoadingState(isLoading) {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div>';
      document.body.appendChild(overlay);
    }

    if (isLoading) {
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    // Use existing error display or create one
    const errorBanner = document.createElement('div');
    errorBanner.className = 'error-banner';
    errorBanner.textContent = message;
    errorBanner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #f44336;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      z-index: 10001;
      animation: slideDown 0.3s ease;
    `;
    
    document.body.appendChild(errorBanner);
    
    setTimeout(() => {
      errorBanner.remove();
    }, 5000);
  }

  /**
   * Sync now
   */
  async syncNow() {
    console.log('[Enhanced] Manual sync triggered');
    
    if (isLoggedInWithBackend()) {
      try {
        this.toggleLoadingState(true);
        await loadTasksIntoState();
        await pushLocalTasksToBackend();
        this.showSyncIndicator('Sincronizado', 'success');
      } catch (error) {
        console.error('[Enhanced] Sync error:', error);
        this.showSyncIndicator('Error de sincronización', 'error');
      } finally {
        this.toggleLoadingState(false);
      }
    } else {
      this.showError('Debes iniciar sesión para sincronizar');
    }
  }

  /**
   * Focus search
   */
  focusSearch() {
    // Create search modal if it doesn't exist
    let searchModal = document.getElementById('search-modal');
    if (!searchModal) {
      searchModal = document.createElement('div');
      searchModal.id = 'search-modal';
      searchModal.className = 'modal';
      searchModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2>Buscar Tareas</h2>
            <button onclick="this.closest('.modal').remove()">✕</button>
          </div>
          <div class="modal-body">
            <input type="text" id="search-input" placeholder="Buscar por título, descripción o etiquetas..." />
            <div id="search-results"></div>
          </div>
        </div>
      `;
      document.body.appendChild(searchModal);

      // Setup search functionality
      const searchInput = searchModal.querySelector('#search-input');
      const searchResults = searchModal.querySelector('#search-results');
      
      const performSearch = debounce(() => {
        const query = searchInput.value;
        if (query.length < 2) {
          searchResults.innerHTML = '';
          return;
        }

        const results = enhancedState.searchTasks(query);
        
        if (results.length === 0) {
          searchResults.innerHTML = '<p>No se encontraron resultados</p>';
        } else {
          searchResults.innerHTML = results.map(task => `
            <div class="search-result" data-task-id="${task.id}">
              <h4>${task.title}</h4>
              ${task.description ? `<p>${task.description}</p>` : ''}
              ${task.date ? `<span class="date">${task.date}</span>` : ''}
            </div>
          `).join('');
        }
      }, 300);

      searchInput.addEventListener('input', performSearch);
    }

    searchModal.style.display = 'block';
    searchModal.querySelector('#search-input')?.focus();
  }

  /**
   * Close all modals
   */
  closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
  }
}

// Initialize enhanced app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.enhancedApp = new EnhancedApp();
  });
} else {
  window.enhancedApp = new EnhancedApp();
}

// Export for debugging
export { EnhancedApp, enhancedState, eventBus, performanceMonitor };
