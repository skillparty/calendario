/**
 * Lightweight toast notifications for Calendar10 using vanilla-sonner.
 * Replaces previous custom implementation with a modern, Sonner-style UI.
 */

import { toast, Toaster } from 'vanilla-sonner';
// Ensure CSS is imported (Vite will handle this)
import 'vanilla-sonner/style.css';

// Initialize the toaster container
// Configuration is handled via <ol id="sonner-toast-container"> attributes in index.html
new Toaster();

// Configure global theme listener to update sonner theme if needed
const updateSonnerTheme = () => {
    // vanilla-sonner uses the 'theme' attribute on the container or system preference
};

/** @typedef {'info' | 'success' | 'error' | 'warning'} ToastType */
/** @typedef {'top-center' | 'top-right' | 'bottom-left' | 'bottom-right'} ToastPosition */

/**
 * @param {string} message
 * @param {{ type?: ToastType; duration?: number; position?: ToastPosition; description?: string }} [options]
 */
export function showToast(message, options = {}) {
  const {
    type = 'info',
    duration = 2800,
    description
  } = options;

  const toastOptions = {
    duration,
    description,
  };

  switch (type) {
    case 'success':
      toast.success(message, toastOptions);
      break;
    case 'error':
      toast.error(message, toastOptions);
      break;
    case 'warning':
      toast.warning(message, toastOptions);
      break;
    case 'info':
    default:
      toast.info(message, toastOptions);
      break;
  }
}

/**
 * @param {string} message
 * @param {boolean} [isError=false]
 */
export function showSyncToast(message, isError = false) {
  if (isError) {
    toast.error(message, { duration: 4200 });
  } else {
    // Use standard toast for sync messages
    if (message.includes('Sincronizando') || message.includes('cambios')) {
        toast(message, { duration: 2000 }); // Neutral for "Syncing..."
    } else {
        toast.success(message, { duration: 2600 });
    }
  }
}

/**
 * @param {string} message
 * @param {boolean} [isError=false]
 */
export function showAuthToast(message, isError = false) {
  if (isError) {
    toast.error(message, { duration: 5500 });
  } else {
    toast.info(message, { duration: 3200 });
  }
}

/**
 * Show a toast with an Undo action button.
 * Assumes the destructive action has already been performed.
 * The onUndo callback should restore the previous state.
 * 
 * @param {string} message
 * @param {{ onUndo: () => void; duration?: number }} opts
 */
export function showUndoToast(message, opts) {
  const { onUndo, duration = 5000 } = opts;

  toast(message, {
    duration: duration,
    action: {
      label: 'Deshacer',
      onClick: () => {
        onUndo();
      },
    }
  });
}

