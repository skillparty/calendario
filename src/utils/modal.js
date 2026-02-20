/**
 * Accessible modal helpers with focus management.
 */

const MODAL_STATE = new WeakMap();

/**
 * @param {HTMLElement} root
 * @returns {HTMLElement[]}
 */
function getFocusableElements(root) {
  return Array.from(
    root.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  )
    .filter((el) => el instanceof HTMLElement)
    .filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * @param {HTMLElement} modal
 * @param {KeyboardEvent} event
 */
function handleTrapKeydown(modal, event) {
  const state = MODAL_STATE.get(modal);
  if (!state) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    closeModal(modal, { removeFromDom: state.removeOnClose });
    return;
  }

  if (event.key !== 'Tab') return;

  const focusables = getFocusableElements(state.dialog);
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = /** @type {HTMLElement | null} */ (document.activeElement);

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * @param {HTMLElement} modal
 * @param {{
 *   dialogSelector?: string;
 *   initialFocusSelector?: string;
 *   removeOnClose?: boolean;
 *   onClose?: (() => void) | null;
 * }} [options]
 */
export function openModal(modal, options = {}) {
  const {
    dialogSelector = '.modal-content',
    initialFocusSelector,
    removeOnClose = false,
    onClose = null
  } = options;

  const dialog = /** @type {HTMLElement | null} */ (modal.querySelector(dialogSelector)) || modal;

  if (!dialog.hasAttribute('role')) dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');

  const previouslyFocused = /** @type {HTMLElement | null} */ (document.activeElement);

  /** @param {KeyboardEvent} event */
  const keydownHandler = (event) => handleTrapKeydown(modal, event);
  /** @param {MouseEvent} event */
  const backdropHandler = (event) => {
    if (event.target === modal) {
      closeModal(modal, { removeFromDom: removeOnClose });
    }
  };

  MODAL_STATE.set(modal, {
    dialog,
    keydownHandler,
    backdropHandler,
    previouslyFocused,
    removeOnClose,
    onClose
  });

  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');

  document.addEventListener('keydown', keydownHandler);
  modal.addEventListener('click', backdropHandler);

  const target = initialFocusSelector
    ? /** @type {HTMLElement | null} */ (modal.querySelector(initialFocusSelector))
    : null;

  const focusable = target || getFocusableElements(dialog)[0] || dialog;
  requestAnimationFrame(() => focusable.focus());
}

/**
 * @param {HTMLElement} modal
 * @param {{ removeFromDom?: boolean }} [options]
 */
export function closeModal(modal, options = {}) {
  const { removeFromDom = false } = options;
  const state = MODAL_STATE.get(modal);

  if (state) {
    document.removeEventListener('keydown', state.keydownHandler);
    modal.removeEventListener('click', state.backdropHandler);
  }

  modal.classList.add('hidden');
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');

  if (state?.previouslyFocused && typeof state.previouslyFocused.focus === 'function') {
    state.previouslyFocused.focus();
  }

  if (typeof state?.onClose === 'function') {
    state.onClose();
  }

  MODAL_STATE.delete(modal);

  if (removeFromDom) {
    modal.remove();
  }
}
