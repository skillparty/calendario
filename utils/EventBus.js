/**
 * @typedef {import('../types-enhanced').AppEvent} AppEvent
 * @typedef {import('../types-enhanced').Observer} Observer
 * @typedef {import('../types-enhanced').Unsubscribe} Unsubscribe
 */

/**
 * Event Bus implementation for decoupled communication
 * Implements the Observer pattern with type safety
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Observer>>} */
    this.listeners = new Map();
    /** @type {AppEvent[]} */
    this.eventHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Subscribe to an event type
   * @param {AppEvent['type']} eventType 
   * @param {Observer} callback 
   * @returns {Unsubscribe}
   */
  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    const listeners = this.listeners.get(eventType);
    if (listeners) listeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to an event that fires only once
   * @param {AppEvent['type']} eventType 
   * @param {Observer} callback 
   * @returns {Unsubscribe}
   */
  once(eventType, callback) {
    const unsubscribe = this.on(eventType, (/** @type {AppEvent} */ event) => {
      callback(event);
      unsubscribe();
    });
    return unsubscribe;
  }

  /**
   * Emit an event to all subscribers
   * @param {AppEvent} event 
   */
  emit(event) {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Error in wildcard event listener:', error);
        }
      });
    }
  }

  /**
   * Remove all listeners for a specific event type
   * @param {AppEvent['type']} eventType 
   */
  off(eventType) {
    this.listeners.delete(eventType);
  }

  /**
   * Remove all event listeners
   */
  clear() {
    this.listeners.clear();
  }

  /**
   * Get the last N events from history
   * @param {number} count 
   * @returns {AppEvent[]}
   */
  getHistory(count = 10) {
    return this.eventHistory.slice(-count);
  }

  /**
   * Get all listeners count
   * @returns {number}
   */
  getListenerCount() {
    let count = 0;
    this.listeners.forEach(set => count += set.size);
    return count;
  }
}

// Singleton instance
export const eventBus = new EventBus();
