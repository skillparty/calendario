/**
 * @typedef {import('../types-enhanced').Task} Task
 * @typedef {import('../types-enhanced').SyncStatus} SyncStatus
 */

/**
 * IndexedDB manager for offline storage and sync
 */
export class IndexedDBManager {
  constructor() {
    this.dbName = 'Calendar10DB';
    this.version = 1;
    /** @type {any} */
    this.db = null;
    this.isReady = false;
    this.readyPromise = this.init();
  }

  /**
   * Initialize database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isReady = true;
        console.log('IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = /** @type {IDBOpenDBRequest} */ (event.target).result;

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('date', 'date', { unique: false });
          tasksStore.createIndex('completed', 'completed', { unique: false });
          tasksStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          tasksStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // Pending operations store (for offline sync)
        if (!db.objectStoreNames.contains('pendingOps')) {
          const pendingStore = db.createObjectStore('pendingOps', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          pendingStore.createIndex('type', 'type', { unique: false });
        }

        // User preferences store
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }

        // Cache metadata store
        if (!db.objectStoreNames.contains('cacheMetadata')) {
          const cacheStore = db.createObjectStore('cacheMetadata', { keyPath: 'url' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is ready
   */
  async ensureReady() {
    if (!this.isReady) {
      await this.readyPromise;
    }
  }

  // Task operations

  /**
   * Get all tasks
   * @returns {Promise<Task[]>}
   */
  async getAllTasks() {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get tasks by date
   * @param {string} date 
   * @returns {Promise<Task[]>}
   */
  async getTasksByDate(date) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const index = store.index('date');
      const request = index.getAll(date);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get task by ID
   * @param {string} id 
   * @returns {Promise<Task>}
   */
  async getTask(id) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save task
   * @param {Task} task 
   * @returns {Promise<void>}
   */
  async saveTask(task) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.put(task);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save multiple tasks
   * @param {Task[]} tasks 
   * @returns {Promise<void>}
   */
  async saveTasks(tasks) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');

      tasks.forEach(task => store.put(task));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Delete task
   * @param {string} id 
   * @returns {Promise<void>}
   */
  async deleteTask(id) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all tasks
   * @returns {Promise<void>}
   */
  async clearTasks() {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readwrite');
      const store = transaction.objectStore('tasks');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Pending operations for offline sync

  /**
   * Add pending operation
   * @param {Object} operation 
   * @returns {Promise<number>}
   */
  async addPendingOperation(operation) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOps'], 'readwrite');
      const store = transaction.objectStore('pendingOps');
      const request = store.add({
        ...operation,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve(/** @type {number} */ (request.result));
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending operations
   * @returns {Promise<any[]>}
   */
  async getPendingOperations() {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOps'], 'readonly');
      const store = transaction.objectStore('pendingOps');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove pending operation
   * @param {number} id 
   * @returns {Promise<void>}
   */
  async removePendingOperation(id) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOps'], 'readwrite');
      const store = transaction.objectStore('pendingOps');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all pending operations
   * @returns {Promise<void>}
   */
  async clearPendingOperations() {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['pendingOps'], 'readwrite');
      const store = transaction.objectStore('pendingOps');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Preferences

  /**
   * Get preference
   * @param {string} key 
   * @returns {Promise<any>}
   */
  async getPreference(key) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['preferences'], 'readonly');
      const store = transaction.objectStore('preferences');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set preference
   * @param {string} key 
   * @param {any} value 
   * @returns {Promise<void>}
   */
  async setPreference(key, value) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['preferences'], 'readwrite');
      const store = transaction.objectStore('preferences');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cache metadata

  /**
   * Update cache metadata
   * @param {string} url 
   * @param {Object} metadata 
   * @returns {Promise<void>}
   */
  async updateCacheMetadata(url, metadata) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cacheMetadata'], 'readwrite');
      const store = transaction.objectStore('cacheMetadata');
      const request = store.put({
        url,
        ...metadata,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cache metadata
   * @param {string} url 
   * @returns {Promise<Object>}
   */
  async getCacheMetadata(url) {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cacheMetadata'], 'readonly');
      const store = transaction.objectStore('cacheMetadata');
      const request = store.get(url);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clean old cache metadata
   * @param {number} maxAge - Max age in milliseconds
   * @returns {Promise<void>}
   */
  async cleanOldCacheMetadata(maxAge) {
    await this.ensureReady();

    const cutoff = Date.now() - maxAge;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['cacheMetadata'], 'readwrite');
      const store = transaction.objectStore('cacheMetadata');
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);

      request.onsuccess = (/** @type {any} */ event) => {
        const cursor = /** @type {IDBRequest<IDBCursorWithValue | null>} */ (event.target).result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Sync utilities

  /**
   * Get tasks needing sync
   * @returns {Promise<Task[]>}
   */
  async getTasksNeedingSync() {
    await this.ensureReady();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['tasks'], 'readonly');
      const store = transaction.objectStore('tasks');
      const index = store.index('syncStatus');
      const request = index.getAll(['pending', 'error']);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Mark task as synced
   * @param {string} taskId 
   * @param {number} serverId 
   * @returns {Promise<void>}
   */
  async markTaskSynced(taskId, serverId) {
    const task = await this.getTask(taskId);
    if (task) {
      task.syncStatus = 'synced';
      task.serverId = serverId;
      await this.saveTask(task);
    }
  }

  /**
   * Mark task sync as failed
   * @param {string} taskId 
   * @param {string} error 
   * @returns {Promise<void>}
   */
  async markTaskSyncFailed(taskId, error) {
    const task = await this.getTask(taskId);
    if (task) {
      task.syncStatus = 'error';
      /** @type {any} */ (task).syncError = error;
      await this.saveTask(task);
    }
  }

  /**
   * Get database size
   * @returns {Promise<Object>}
   */
  async getDatabaseSize() {
    await this.ensureReady();

    const stores = ['tasks', 'pendingOps', 'preferences', 'cacheMetadata'];
    /** @type {Record<string, number>} */
    const sizes = {};

    for (const storeName of stores) {
      const count = await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      sizes[storeName] = count;
    }

    return sizes;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isReady = false;
    }
  }
}

// Export singleton instance
export const indexedDBManager = new IndexedDBManager();
