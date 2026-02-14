/**
 * Lightweight toast notifications for Calendar10.
 */

/** @typedef {'info' | 'success' | 'error' | 'warning'} ToastType */
/** @typedef {'top-center' | 'top-right' | 'bottom-left' | 'bottom-right'} ToastPosition */

const TOAST_CONTAINER_ID = 'toast-container';

/**
 * @param {ToastPosition} position
 * @returns {HTMLElement}
 */
function getToastContainer(position) {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  container.setAttribute('data-position', position);
  return container;
}

/**
 * @param {string} message
 * @param {{ type?: ToastType; duration?: number; position?: ToastPosition }} [options]
 * @returns {HTMLElement}
 */
export function showToast(message, options = {}) {
  const {
    type = 'info',
    duration = 2800,
    position = 'bottom-left'
  } = options;

  const container = getToastContainer(position);
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  const safeDuration = Math.max(1200, duration);
  const hideTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
    const removeTimer = setTimeout(() => toast.remove(), 220);
    toast.dataset.removeTimer = String(removeTimer);
  }, safeDuration);

  toast.dataset.hideTimer = String(hideTimer);
  return toast;
}

/**
 * @param {string} message
 * @param {boolean} [isError=false]
 */
export function showSyncToast(message, isError = false) {
  showToast(message, {
    type: isError ? 'error' : 'success',
    duration: isError ? 4200 : 2600,
    position: 'bottom-left'
  });
}

/**
 * @param {string} message
 * @param {boolean} [isError=false]
 */
export function showAuthToast(message, isError = false) {
  showToast(message, {
    type: isError ? 'error' : 'info',
    duration: isError ? 5500 : 3200,
    position: 'top-center'
  });
}

/**
 * Show a toast with an Undo action button.
 * @param {string} message
 * @param {{ onUndo: () => void; onExpire: () => void; duration?: number; position?: ToastPosition }} opts
 * @returns {HTMLElement}
 */
export function showUndoToast(message, opts) {
  const { onUndo, onExpire, duration = 5000, position = 'bottom-left' } = opts;

  const container = getToastContainer(position);
  const toast = document.createElement('div');
  toast.className = 'toast toast--warning toast--undo';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-message';
  msgSpan.textContent = message;

  const undoBtn = document.createElement('button');
  undoBtn.className = 'toast-undo-btn';
  undoBtn.textContent = 'Deshacer';
  undoBtn.type = 'button';

  toast.appendChild(msgSpan);
  toast.appendChild(undoBtn);
  container.appendChild(toast);

  let settled = false;

  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  const dismiss = () => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 220);
  };

  const hideTimer = setTimeout(() => {
    if (!settled) {
      settled = true;
      dismiss();
      onExpire();
    }
  }, Math.max(2000, duration));

  undoBtn.addEventListener('click', () => {
    if (!settled) {
      settled = true;
      clearTimeout(hideTimer);
      dismiss();
      onUndo();
    }
  });

  toast.dataset.hideTimer = String(hideTimer);
  return toast;
}
