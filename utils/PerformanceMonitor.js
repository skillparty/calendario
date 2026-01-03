/**
 * Performance monitoring and optimization utilities
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.setupObservers();
  }

  /**
   * Setup performance observers
   */
  setupObservers() {
    // Observe long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            console.warn('[Performance] Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
            
            this.recordMetric('longTask', {
              duration: entry.duration,
              timestamp: Date.now()
            });
          }
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.set('longtask', longTaskObserver);
      } catch (e) {
        console.log('[Performance] Long task observer not supported');
      }

      // Observe layout shifts
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          let clsValue = 0;
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          
          if (clsValue > 0.1) {
            console.warn('[Performance] Layout shift detected:', clsValue);
          }
          
          this.recordMetric('layoutShift', {
            value: clsValue,
            timestamp: Date.now()
          });
        });
        
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('layout-shift', layoutShiftObserver);
      } catch (e) {
        console.log('[Performance] Layout shift observer not supported');
      }

      // Observe largest contentful paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          
          console.log('[Performance] LCP:', lastEntry.renderTime || lastEntry.loadTime);
          
          this.recordMetric('lcp', {
            value: lastEntry.renderTime || lastEntry.loadTime,
            timestamp: Date.now()
          });
        });
        
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      } catch (e) {
        console.log('[Performance] LCP observer not supported');
      }
    }
  }

  /**
   * Measure function execution time
   * @param {string} name 
   * @param {Function} fn 
   * @returns {*}
   */
  measure(name, fn) {
    const start = performance.now();
    
    try {
      const result = fn();
      
      if (result instanceof Promise) {
        return result.finally(() => {
          const duration = performance.now() - start;
          this.recordMetric(name, { duration, timestamp: Date.now() });
        });
      }
      
      const duration = performance.now() - start;
      this.recordMetric(name, { duration, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(name, { duration, timestamp: Date.now(), error: true });
      throw error;
    }
  }

  /**
   * Measure async function execution time
   * @param {string} name 
   * @param {Function} fn 
   * @returns {Promise<*>}
   */
  async measureAsync(name, fn) {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, { duration, timestamp: Date.now() });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(name, { duration, timestamp: Date.now(), error: true });
      throw error;
    }
  }

  /**
   * Record a performance metric
   * @param {string} name 
   * @param {*} value 
   */
  recordMetric(name, value) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const metrics = this.metrics.get(name);
    metrics.push(value);
    
    // Keep only last 100 metrics
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * Get metrics summary
   * @param {string} [name]
   * @returns {Object}
   */
  getMetrics(name) {
    if (name) {
      const metrics = this.metrics.get(name) || [];
      return this.calculateStats(metrics);
    }
    
    const summary = {};
    for (const [key, values] of this.metrics) {
      summary[key] = this.calculateStats(values);
    }
    
    return summary;
  }

  /**
   * Calculate statistics for metrics
   * @param {Array} metrics 
   * @returns {Object}
   */
  calculateStats(metrics) {
    if (metrics.length === 0) {
      return { count: 0 };
    }
    
    const durations = metrics
      .filter(m => typeof m.duration === 'number')
      .map(m => m.duration);
    
    if (durations.length === 0) {
      return { count: metrics.length, data: metrics };
    }
    
    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    
    return {
      count: durations.length,
      mean: sum / durations.length,
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Log performance report
   */
  logReport() {
    console.group('[Performance Report]');
    
    const metrics = this.getMetrics();
    for (const [name, stats] of Object.entries(metrics)) {
      console.log(`${name}:`, stats);
    }
    
    // Core Web Vitals
    this.logWebVitals();
    
    // Memory usage
    if (performance.memory) {
      console.log('Memory:', {
        used: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB',
        total: Math.round(performance.memory.totalJSHeapSize / 1048576) + ' MB',
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB'
      });
    }
    
    console.groupEnd();
  }

  /**
   * Log Web Vitals
   */
  logWebVitals() {
    if (!('PerformanceObserver' in window)) return;
    
    // First Contentful Paint
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcpEntry) {
      console.log('FCP:', fcpEntry.startTime.toFixed(2) + 'ms');
    }
    
    // Time to Interactive (approximate)
    const tti = performance.timing.domInteractive - performance.timing.navigationStart;
    console.log('TTI:', tti + 'ms');
    
    // Total Blocking Time (approximate)
    const tbt = this.metrics.get('longTask')?.reduce((sum, task) => {
      return sum + Math.max(0, task.duration - 50);
    }, 0) || 0;
    console.log('TBT:', tbt.toFixed(2) + 'ms');
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.clear();
  }

  /**
   * Destroy observers
   */
  destroy() {
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
    this.metrics.clear();
  }
}

/**
 * Debounce function for performance
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance
 * @param {Function} func 
 * @param {number} limit 
 * @returns {Function}
 */
export function throttle(func, limit) {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Request idle callback with fallback
 * @param {Function} callback 
 * @param {Object} options 
 */
export function requestIdleCallback(callback, options = {}) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, options);
  } else {
    setTimeout(callback, 1);
  }
}

/**
 * Lazy load images
 */
export function setupLazyLoading() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    });

    document.querySelectorAll('img.lazy').forEach(img => {
      imageObserver.observe(img);
    });
  } else {
    // Fallback for older browsers
    document.querySelectorAll('img.lazy').forEach(img => {
      img.src = img.dataset.src;
      img.classList.remove('lazy');
    });
  }
}

/**
 * Virtual scrolling helper
 */
export class VirtualScroller {
  constructor(container, items, itemHeight, renderItem) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.visibleItems = [];
    
    this.setup();
  }

  setup() {
    // Create viewport
    this.viewport = document.createElement('div');
    this.viewport.style.height = `${this.items.length * this.itemHeight}px`;
    this.viewport.style.position = 'relative';
    
    // Create content container
    this.content = document.createElement('div');
    this.content.style.position = 'absolute';
    this.content.style.top = '0';
    this.content.style.left = '0';
    this.content.style.right = '0';
    
    this.viewport.appendChild(this.content);
    this.container.appendChild(this.viewport);
    
    // Setup scroll listener
    this.container.addEventListener('scroll', throttle(() => {
      this.render();
    }, 16)); // ~60fps
    
    // Initial render
    this.render();
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    
    const startIndex = Math.floor(scrollTop / this.itemHeight);
    const endIndex = Math.ceil((scrollTop + containerHeight) / this.itemHeight);
    
    // Add buffer for smooth scrolling
    const bufferSize = 5;
    const visibleStart = Math.max(0, startIndex - bufferSize);
    const visibleEnd = Math.min(this.items.length, endIndex + bufferSize);
    
    // Clear content
    this.content.innerHTML = '';
    
    // Render visible items
    for (let i = visibleStart; i < visibleEnd; i++) {
      const item = this.items[i];
      const element = this.renderItem(item, i);
      element.style.position = 'absolute';
      element.style.top = `${i * this.itemHeight}px`;
      element.style.height = `${this.itemHeight}px`;
      this.content.appendChild(element);
    }
    
    // Update content position
    this.content.style.transform = `translateY(${visibleStart * this.itemHeight}px)`;
  }

  update(items) {
    this.items = items;
    this.viewport.style.height = `${this.items.length * this.itemHeight}px`;
    this.render();
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
