/**
 * @typedef {import('../types-enhanced').AppState} AppState
 * @typedef {import('../types-enhanced').Task} Task
 * @typedef {import('../types-enhanced').TasksByDate} TasksByDate
 * @typedef {import('../types-enhanced').UserSession} UserSession
 * @typedef {import('../types-enhanced').FiltersState} FiltersState
 * @typedef {import('../types-enhanced').UIState} UIState
 * @typedef {import('../types-enhanced').Unsubscribe} Unsubscribe
 */

import { eventBus } from './EventBus.js';

/**
 * Enhanced State Manager with immutability and reactivity
 */
export class StateManager {
  constructor() {
    /** @type {AppState} */
    this.state = this.getInitialState();
    this.subscribers = new Set();
    this.history = [];
    this.maxHistorySize = 50;
    this.setupPersistence();
  }

  /**
   * Get initial state
   * @returns {AppState}
   */
  getInitialState() {
    return {
      currentDate: new Date(),
      tasks: this.loadTasksFromStorage(),
      userSession: this.loadSessionFromStorage(),
      userGistId: this.safeGetItem('userGistId'),
      lastGistUpdatedAt: this.safeGetItem('lastGistUpdatedAt'),
      backgroundSyncTimer: null,
      baseSyncIntervalMs: 120000,
      currentSyncIntervalMs: 120000,
      maxSyncIntervalMs: 600000,
      filters: {
        month: 'all',
        status: 'all',
        tags: [],
        search: ''
      },
      ui: {
        isLoading: false,
        loadingMessage: null,
        error: null,
        activeModal: null,
        selectedTaskId: null,
        view: 'calendar'
      }
    };
  }

  /**
   * Subscribe to state changes
   * @param {(state: AppState, prevState: AppState) => void} callback 
   * @returns {Unsubscribe}
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Update state immutably
   * @param {Partial<AppState> | ((state: AppState) => Partial<AppState>)} updates 
   */
  setState(updates) {
    const prevState = this.state;
    const newUpdates = typeof updates === 'function' ? updates(prevState) : updates;
    
    // Create new state object
    this.state = {
      ...prevState,
      ...newUpdates,
      // Deep merge for nested objects
      filters: newUpdates.filters ? { ...prevState.filters, ...newUpdates.filters } : prevState.filters,
      ui: newUpdates.ui ? { ...prevState.ui, ...newUpdates.ui } : prevState.ui
    };

    // Add to history
    this.addToHistory(prevState);

    // Notify subscribers
    this.notifySubscribers(prevState);

    // Persist to storage
    this.persistState();
  }

  /**
   * Get current state
   * @returns {Readonly<AppState>}
   */
  getState() {
    return Object.freeze(this.state);
  }

  /**
   * Add task
   * @param {Task} task 
   */
  addTask(task) {
    const dateKey = task.date || 'undated';
    const currentTasks = this.state.tasks[dateKey] || [];
    
    this.setState({
      tasks: {
        ...this.state.tasks,
        [dateKey]: [...currentTasks, task]
      }
    });

    eventBus.emit({ type: 'task:created', payload: task });
  }

  /**
   * Update task
   * @param {string} taskId 
   * @param {Partial<Task>} updates 
   */
  updateTask(taskId, updates) {
    const newTasks = { ...this.state.tasks };
    let updatedTask = null;

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
          newTasks[dateKey] = [
            ...tasks.slice(0, index),
            updatedTask,
            ...tasks.slice(index + 1)
          ];
        }
        break;
      }
    }

    if (updatedTask) {
      this.setState({ tasks: newTasks });
      eventBus.emit({ type: 'task:updated', payload: updatedTask });
    }
  }

  /**
   * Delete task
   * @param {string} taskId 
   */
  deleteTask(taskId) {
    const newTasks = { ...this.state.tasks };
    
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

    this.setState({ tasks: newTasks });
    eventBus.emit({ type: 'task:deleted', payload: taskId });
  }

  /**
   * Set loading state
   * @param {boolean} isLoading 
   * @param {string} [message]
   */
  setLoading(isLoading, message = null) {
    this.setState({
      ui: {
        ...this.state.ui,
        isLoading,
        loadingMessage: message
      }
    });
    eventBus.emit({ type: 'ui:loading', payload: isLoading });
  }

  /**
   * Set error state
   * @param {string | null} error 
   * @param {string} [code]
   */
  setError(error, code = null) {
    const errorState = error ? {
      message: error,
      code,
      timestamp: Date.now()
    } : null;

    this.setState({
      ui: {
        ...this.state.ui,
        error: errorState
      }
    });

    if (errorState) {
      eventBus.emit({ type: 'ui:error', payload: errorState });
    }
  }

  /**
   * Set filters
   * @param {Partial<FiltersState>} filters 
   */
  setFilters(filters) {
    const newFilters = { ...this.state.filters, ...filters };
    this.setState({ filters: newFilters });
    eventBus.emit({ type: 'filter:changed', payload: newFilters });
  }

  /**
   * Get filtered tasks
   * @returns {Task[]}
   */
  getFilteredTasks() {
    const { tasks, filters } = this.state;
    let allTasks = Object.values(tasks).flat();

    // Apply status filter
    if (filters.status !== 'all') {
      allTasks = allTasks.filter(task => 
        filters.status === 'completed' ? task.completed : !task.completed
      );
    }

    // Apply month filter
    if (filters.month !== 'all') {
      const month = parseInt(filters.month);
      allTasks = allTasks.filter(task => {
        if (!task.date) return false;
        return new Date(task.date).getMonth() === month;
      });
    }

    // Apply tag filter
    if (filters.tags && filters.tags.length > 0) {
      allTasks = allTasks.filter(task => 
        task.tags && filters.tags.some(tag => task.tags.includes(tag))
      );
    }

    // Apply search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      allTasks = allTasks.filter(task => 
        task.title.toLowerCase().includes(search) ||
        (task.description && task.description.toLowerCase().includes(search))
      );
    }

    return allTasks;
  }

  /**
   * Undo last action
   */
  undo() {
    if (this.history.length > 0) {
      const prevState = this.history.pop();
      this.state = prevState;
      this.notifySubscribers(prevState);
      this.persistState();
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.state = this.getInitialState();
    this.history = [];
    this.clearStorage();
    this.notifySubscribers(null);
  }

  // Private methods

  /**
   * @private
   */
  notifySubscribers(prevState) {
    this.subscribers.forEach(callback => {
      try {
        callback(this.state, prevState);
      } catch (error) {
        console.error('Error in state subscriber:', error);
      }
    });
  }

  /**
   * @private
   */
  addToHistory(state) {
    this.history.push(state);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * @private
   */
  setupPersistence() {
    // Auto-save tasks on change
    this.subscribe((state, prevState) => {
      if (state.tasks !== prevState?.tasks) {
        this.safeSetItem('calendarTasks', JSON.stringify(state.tasks));
      }
      if (state.userSession !== prevState?.userSession) {
        if (state.userSession) {
          this.safeSetItem('userSession', JSON.stringify(state.userSession));
        } else {
          this.safeRemoveItem('userSession');
        }
      }
    });
  }

  /**
   * @private
   */
  persistState() {
    // Persist only necessary parts
    this.safeSetItem('calendarTasks', JSON.stringify(this.state.tasks));
    if (this.state.userGistId) {
      this.safeSetItem('userGistId', this.state.userGistId);
    }
    if (this.state.lastGistUpdatedAt) {
      this.safeSetItem('lastGistUpdatedAt', this.state.lastGistUpdatedAt);
    }
  }

  /**
   * @private
   */
  loadTasksFromStorage() {
    const stored = this.safeGetItem('calendarTasks');
    return stored ? JSON.parse(stored) : {};
  }

  /**
   * @private
   */
  loadSessionFromStorage() {
    const stored = this.safeGetItem('userSession');
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * @private
   */
  clearStorage() {
    this.safeRemoveItem('calendarTasks');
    this.safeRemoveItem('userSession');
    this.safeRemoveItem('userGistId');
    this.safeRemoveItem('lastGistUpdatedAt');
  }

  /**
   * @private
   */
  safeGetItem(key) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  /**
   * @private
   */
  safeSetItem(key, value) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
    }
  }

  /**
   * @private
   */
  safeRemoveItem(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Failed to remove ${key} from localStorage:`, error);
    }
  }
}

// Export singleton instance
export const stateManager = new StateManager();
