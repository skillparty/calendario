/**
 * Enhanced state management that wraps the existing state.js
 * Provides backward compatibility while adding new features
 */

import { state as legacyState, setTasks as legacySetTasks, setUserSession as legacySetUserSession, notifyTasksUpdated } from './state.js';
import { API_BASE_URL, pushLocalTasksToBackend } from './api.js';
import { eventBus } from './utils/EventBus.js';
import { indexedDBManager } from './utils/IndexedDBManager.js';

/**
 * @typedef {import('./types').Task} Task
 * @typedef {import('./types').TasksByDate} TasksByDate
 * @typedef {import('./types').AppState} AppState
 */

class EnhancedStateManager {
  constructor() {
    this.setupEventBridge();
    this.setupOfflineSync();
  }

  /**
   * Bridge legacy state with new event system
   */
  setupEventBridge() {
    // Listen to legacy tasksUpdated event
    document.addEventListener('tasksUpdated', () => {
      eventBus.emit({ type: 'tasks:loaded', payload: Object.values(legacyState.tasks).flat() });
      this.syncToIndexedDB();
    });
  }

  /**
   * Setup offline synchronization
   */
  async setupOfflineSync() {
    // Load tasks from IndexedDB on startup
    try {
      const offlineTasks = await indexedDBManager.getAllTasks();
      if (offlineTasks.length > 0 && !navigator.onLine) {
        console.log('[State] Loading tasks from offline storage');
        const tasksByDate = this.groupTasksByDate(offlineTasks);
        legacySetTasks(tasksByDate);
      }
    } catch (error) {
      console.error('[State] Failed to load offline tasks:', error);
    }

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('[State] Back online, syncing...');
      this.syncPendingOperations();
    });

    window.addEventListener('offline', () => {
      console.log('[State] Gone offline, using local storage');
    });
  }

  /**
   * Group tasks by date
   * @param {Task[]} tasks 
   * @returns {TasksByDate}
   */
  groupTasksByDate(tasks) {
    /** @type {Record<string, Task[]>} */
    const grouped = {};
    tasks.forEach(task => {
      const key = task.date || 'undated';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(task);
    });
    return grouped;
  }

  /**
   * Sync current state to IndexedDB
   */
  async syncToIndexedDB() {
    try {
      const allTasks = Object.values(legacyState.tasks).flat();
      await indexedDBManager.saveTasks(allTasks);
    } catch (error) {
      console.error('[State] Failed to sync to IndexedDB:', error);
    }
  }

  /**
   * Sync pending operations when back online
   */
  async syncPendingOperations() {
    try {
      const pendingOps = await indexedDBManager.getPendingOperations();
      const sortedOps = [...pendingOps].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      
      for (const op of sortedOps) {
        try {
          const request = this.resolvePendingOperation(op);

          if (!request) {
            // Fallback when we only have local IDs and cannot build a direct request.
            await pushLocalTasksToBackend();
            await indexedDBManager.removePendingOperation(op.id);
            continue;
          }

          const response = await fetch(request.url, request.init);

          if (response.ok) {
            await indexedDBManager.removePendingOperation(op.id);
            eventBus.emit({ type: 'sync:completed' });
          }
        } catch (error) {
          console.error('[State] Failed to sync operation:', op.id, error);
        }
      }
    } catch (error) {
      console.error('[State] Failed to sync pending operations:', error);
    }
  }

  /**
   * Add task with offline support
   * @param {Task} task 
   */
  async addTask(task) {
    // Add to legacy state
    const dateKey = task.date || 'undated';
    const currentTasks = legacyState.tasks[dateKey] || [];
    legacyState.tasks[dateKey] = [...currentTasks, task];
    
    // Save to localStorage
    legacySetTasks(legacyState.tasks);
    
    // Save to IndexedDB
    await indexedDBManager.saveTask(task);
    
    // Emit event
    eventBus.emit({ type: 'task:created', payload: task });
    
    // Queue for backend sync if offline
    if (!navigator.onLine) {
      await this.queueOperation('create', task);
    }
  }

  /**
   * Update task with offline support
   * @param {string} taskId 
   * @param {Partial<Task>} updates 
   */
  async updateTask(taskId, updates) {
    let updatedTask = null;
    const newTasks = { ...legacyState.tasks };

    // Find and update task
    for (const dateKey in newTasks) {
      const tasks = newTasks[dateKey];
      const index = tasks.findIndex(t => t.id === taskId);
      
      if (index !== -1) {
        const oldTask = tasks[index];
        updatedTask = { ...oldTask, ...updates, lastModified: Date.now() };
        
        // Handle date change
        if (updates.date !== undefined && updates.date !== oldTask.date) {
          // Remove from old date
          newTasks[dateKey] = tasks.filter(t => t.id !== taskId);
          if (newTasks[dateKey].length === 0) {
            delete newTasks[dateKey];
          }
          
          // Add to new date
          const newDateKey = updates.date || 'undated';
          newTasks[newDateKey] = [...(newTasks[newDateKey] || []), updatedTask];
        } else {
          // Update in place
          newTasks[dateKey][index] = updatedTask;
        }
        break;
      }
    }

    if (updatedTask) {
      // Update legacy state
      legacySetTasks(newTasks);
      
      // Save to IndexedDB
      await indexedDBManager.saveTask(updatedTask);
      
      // Emit event
      eventBus.emit({ type: 'task:updated', payload: updatedTask });
      
      // Queue for backend sync if offline
      if (!navigator.onLine) {
        await this.queueOperation('update', updatedTask);
      }
    }
  }

  /**
   * Delete task with offline support
   * @param {string} taskId 
   */
  async deleteTask(taskId) {
    const newTasks = { ...legacyState.tasks };
    
    for (const dateKey in newTasks) {
      const filtered = newTasks[dateKey].filter(t => t.id !== taskId);
      if (filtered.length !== newTasks[dateKey].length) {
        if (filtered.length === 0) {
          delete newTasks[dateKey];
        } else {
          newTasks[dateKey] = filtered;
        }
        break;
      }
    }

    // Update legacy state
    legacySetTasks(newTasks);
    
    // Delete from IndexedDB
    await indexedDBManager.deleteTask(taskId);
    
    // Emit event
    eventBus.emit({ type: 'task:deleted', payload: taskId });
    
    // Queue for backend sync if offline
    if (!navigator.onLine) {
      await this.queueOperation('delete', { id: taskId });
    }
  }

  /**
   * Queue operation for offline sync
   * @param {string} type 
   * @param {any} data 
   */
  async queueOperation(type, data) {
    /** @type {Record<string, any>} */
    const operation = {
      type,
      data,
      timestamp: Date.now()
    };

    const request = this.resolvePendingOperation(operation);
    if (request) {
      operation.url = request.url;
      operation.method = request.init.method;
      operation.headers = request.init.headers;
      operation.body = request.init.body;
    }

    await indexedDBManager.addPendingOperation(operation);
    
    // Request background sync if available
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if ('sync' in registration) {
          await /** @type {any} */ (registration).sync.register('sync-tasks');
        }
      } catch (error) {
        console.warn('[State] Background sync registration failed:', error);
      }
    }
  }

  /**
   * @param {any} operation
   * @returns {{ url: string; init: RequestInit } | null}
   */
  resolvePendingOperation(operation) {
    if (operation.url && operation.method) {
      const init = {
        method: operation.method,
        headers: operation.headers || this.getAuthHeaders(),
        body: operation.body
      };
      if (init.method === 'DELETE') delete init.body;
      return { url: operation.url, init };
    }

    const type = operation.type;
    const data = operation.data || {};

    if (type === 'create') {
      return {
        url: `${API_BASE_URL}/api/tasks`,
        init: {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(this.mapTaskToApiPayload(data))
        }
      };
    }

    const serverId = this.extractServerId(data);
    if (!serverId) return null;

    if (type === 'update') {
      return {
        url: `${API_BASE_URL}/api/tasks/${serverId}`,
        init: {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(this.mapTaskUpdateToApiPayload(data))
        }
      };
    }

    if (type === 'delete') {
      return {
        url: `${API_BASE_URL}/api/tasks/${serverId}`,
        init: {
          method: 'DELETE',
          headers: this.getAuthHeaders()
        }
      };
    }

    return null;
  }

  /**
   * @returns {Record<string, string>}
   */
  getAuthHeaders() {
    /** @type {Record<string, string>} */
    const headers = {
      'Content-Type': 'application/json'
    };
    const jwt = legacyState.userSession?.jwt;
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    return headers;
  }

  /**
   * @param {any} data
   * @returns {number | null}
   */
  extractServerId(data) {
    if (!data) return null;

    if (typeof data.serverId === 'number') return data.serverId;

    if (typeof data.id === 'number') return data.id;
    if (typeof data.id === 'string' && /^\d+$/.test(data.id)) {
      return parseInt(data.id, 10);
    }

    return null;
  }

  /**
   * @param {any} task
   * @returns {Record<string, any>}
   */
  mapTaskToApiPayload(task) {
    /** @type {Record<string, any>} */
    const payload = {
      title: task.title || '',
      completed: Boolean(task.completed),
      is_reminder: task.isReminder !== undefined ? Boolean(task.isReminder) : true,
      priority: this.mapPriority(task.priority),
      tags: Array.isArray(task.tags) ? task.tags : []
    };

    if (task.description && task.description.trim() !== '') {
      payload.description = task.description.trim();
    }

    if (task.date && task.date !== 'undated' && /^\d{4}-\d{2}-\d{2}$/.test(task.date)) {
      payload.date = task.date;
      if (task.time && typeof task.time === 'string' && task.time.trim() !== '') {
        payload.time = task.time.trim();
      }
    }

    return payload;
  }

  /**
   * @param {any} task
   * @returns {Record<string, any>}
   */
  mapTaskUpdateToApiPayload(task) {
    const payload = {};

    if (typeof task.title === 'string') payload.title = task.title;
    if (task.description !== undefined) payload.description = task.description || null;
    if (task.completed !== undefined) payload.completed = Boolean(task.completed);
    if (task.isReminder !== undefined) payload.is_reminder = Boolean(task.isReminder);
    if (task.priority !== undefined) payload.priority = this.mapPriority(task.priority);
    if (task.tags !== undefined) payload.tags = Array.isArray(task.tags) ? task.tags : [];

    if (task.date !== undefined) {
      payload.date = task.date && task.date !== 'undated' ? task.date : null;
      if (task.time !== undefined) {
        payload.time = task.time && task.time.trim && task.time.trim() !== '' ? task.time.trim() : null;
      }
    }

    return payload;
  }

  /**
   * @param {any} priority
   * @returns {'alta' | 'media' | 'baja'}
   */
  mapPriority(priority) {
    const p = parseInt(priority || '3', 10);
    if (p === 1) return 'alta';
    if (p === 2) return 'media';
    return 'baja';
  }

  /**
   * Get current state (backward compatible)
   */
  getState() {
    return legacyState;
  }

  /**
   * Search tasks with full-text search
   * @param {string} query 
   * @returns {Task[]}
   */
  searchTasks(query) {
    const searchLower = query.toLowerCase();
    const allTasks = Object.values(legacyState.tasks).flat();
    
    return allTasks.filter(task => {
      const titleMatch = task.title.toLowerCase().includes(searchLower);
      const descMatch = task.description?.toLowerCase().includes(searchLower);
      const tagMatch = task.tags?.some(tag => tag.toLowerCase().includes(searchLower));
      
      return titleMatch || descMatch || tagMatch;
    });
  }

  /**
   * Get task statistics
   * @returns {Object}
   */
  getStatistics() {
    const allTasks = Object.values(legacyState.tasks).flat();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      total: allTasks.length,
      completed: allTasks.filter(t => t.completed).length,
      pending: allTasks.filter(t => !t.completed).length,
      overdue: allTasks.filter(t => {
        if (!t.date || t.completed) return false;
        const taskDate = new Date(t.date + 'T00:00:00');
        return taskDate < today;
      }).length,
      todayTasks: allTasks.filter(t => {
        if (!t.date) return false;
        const taskDate = new Date(t.date + 'T00:00:00');
        return taskDate.getTime() === today.getTime();
      }).length,
      withReminders: allTasks.filter(t => t.isReminder).length,
      undated: allTasks.filter(t => !t.date).length
    };
  }

  /**
   * Export tasks in various formats
   * @param {string} format - 'json', 'csv', 'ical'
   * @returns {string}
   */
  exportTasks(format = 'json') {
    const allTasks = Object.values(legacyState.tasks).flat();
    
    switch (format) {
      case 'json':
        return JSON.stringify(allTasks, null, 2);
        
      case 'csv':
        const headers = ['ID', 'Title', 'Description', 'Date', 'Time', 'Completed', 'Priority', 'Tags'];
        const rows = allTasks.map(t => [
          t.id,
          `"${t.title.replace(/"/g, '""')}"`,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          t.date || '',
          t.time || '',
          t.completed ? 'Yes' : 'No',
          t.priority || '',
          (t.tags || []).join(';')
        ]);
        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        
      case 'ical':
        let ical = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Calendar10//NONSGML v1.0//EN\n';
        
        allTasks.forEach(task => {
          if (task.date) {
            const dateStr = task.date.replace(/-/g, '');
            const uid = `${task.id}@calendar10.app`;
            
            ical += 'BEGIN:VEVENT\n';
            ical += `UID:${uid}\n`;
            ical += `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z\n`;
            
            if (task.time) {
              const timeStr = task.time.replace(/:/g, '') + '00';
              ical += `DTSTART:${dateStr}T${timeStr}\n`;
            } else {
              ical += `DTSTART;VALUE=DATE:${dateStr}\n`;
            }
            
            ical += `SUMMARY:${task.title}\n`;
            if (task.description) {
              ical += `DESCRIPTION:${task.description.replace(/\n/g, '\\n')}\n`;
            }
            if (task.completed) {
              ical += 'STATUS:COMPLETED\n';
            }
            ical += 'END:VEVENT\n';
          }
        });
        
        ical += 'END:VCALENDAR';
        return ical;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

// Create and export enhanced state manager
export const enhancedState = new EnhancedStateManager();

// Export legacy functions for backward compatibility
export { legacyState as state, legacySetTasks as setTasks, legacySetUserSession as setUserSession };

// Add global access for debugging
if (typeof window !== 'undefined') {
  window.enhancedState = enhancedState;
}
