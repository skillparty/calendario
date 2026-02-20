export interface SwipeOptions {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    threshold?: number;
}

export function swipe(node: HTMLElement, options: SwipeOptions = {}) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    let currentOptions = options;

    function handleTouchStart(e: TouchEvent) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }

    function handleTouchEnd(e: TouchEvent) {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleGesture();
    }

    function handleGesture() {
        const xDiff = touchStartX - touchEndX;
        const yDiff = touchStartY - touchEndY;
        const threshold = currentOptions.threshold || 50;

        if (Math.abs(xDiff) > Math.abs(yDiff)) {
            if (Math.abs(xDiff) > threshold) {
                if (xDiff > 0) {
                    if (currentOptions.onSwipeLeft) currentOptions.onSwipeLeft();
                } else {
                    if (currentOptions.onSwipeRight) currentOptions.onSwipeRight();
                }
            }
        }
    }

    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchend', handleTouchEnd, { passive: true });

    return {
        update(newOptions: SwipeOptions) {
            currentOptions = { ...currentOptions, ...newOptions };
        },
        destroy() {
            node.removeEventListener('touchstart', handleTouchStart);
            node.removeEventListener('touchend', handleTouchEnd);
        }
    };
}
