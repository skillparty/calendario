/**
 * Enhanced state management that wraps the existing state.js
 * Provides backward compatibility while adding new features
 */

import { state as legacyState, setTasks as legacySetTasks, setUserSession as legacySetUserSession, notifyTasksUpdated } from './state.js';
import { eventBus } from './utils/EventBus.js';
import { indexedDBManager } from './utils/IndexedDBManager.js';

/**
 * @typedef {import('./types-enhanced').Task} Task
 * @typedef {import('./types-enhanced').TasksByDate} TasksByDate
 * @typedef {import('./types-enhanced').AppState} AppState
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
      
      for (const op of pendingOps) {
        try {
          const response = await fetch(op.url, {
            method: op.method,
            headers: op.headers,
            body: op.body
          });

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
    const operation = {
      type,
      data,
      url: `${API_BASE_URL}/api/tasks`,
      method: type === 'delete' ? 'DELETE' : type === 'create' ? 'POST' : 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${legacyState.userSession?.jwt || ''}`
      },
      body: JSON.stringify(data)
    };

    await indexedDBManager.addPendingOperation(operation);
    
    // Request background sync if available
    if ('serviceWorker' in navigator && 'sync' in self.registration) {
      await self.registration.sync.register('sync-tasks');
    }
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
