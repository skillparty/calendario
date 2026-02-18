/**
 * Touch gesture handler for swipe navigation
 * Supports left/right swipes with configurable threshold
 */

export class SwipeHandler {
  /**
   * @param {HTMLElement} element - The element to listen for gestures on
   * @param {Object} options - Configuration options
   * @param {() => void} [options.onSwipeLeft] - Callback for swipe left (next)
   * @param {() => void} [options.onSwipeRight] - Callback for swipe right (prev)
   * @param {number} [options.threshold=50] - Minimum distance in pixels to trigger swipe
   */
  constructor(element, options = {}) {
    this.element = element;
    this.onSwipeLeft = options.onSwipeLeft;
    this.onSwipeRight = options.onSwipeRight;
    this.threshold = options.threshold || 50;
    
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchEndX = 0;
    this.touchEndY = 0;
    
    this.init();
  }

  init() {
    this.element.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
      this.touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    this.element.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.touchEndY = e.changedTouches[0].screenY;
      this.handleGesture();
    }, { passive: true });
  }

  handleGesture() {
    const xDiff = this.touchStartX - this.touchEndX;
    const yDiff = this.touchStartY - this.touchEndY;

    // Check if horizontal swipe is dominant (more horizontal than vertical movement)
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
      if (Math.abs(xDiff) > this.threshold) {
        if (xDiff > 0) {
          // Swipe Left (Next)
          if (this.onSwipeLeft) this.onSwipeLeft();
        } else {
          // Swipe Right (Prev)
          if (this.onSwipeRight) this.onSwipeRight();
        }
      }
    }
  }
}
