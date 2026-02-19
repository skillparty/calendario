// Centralized application state for Calendar10
// Provides simple setters/getters and a tasksUpdated event to notify UI modules

/** @param {string} key */
function safeGetItem(key) {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}
/** @param {string} key @param {string} value */
function safeSetItem(key, value) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch {}
}
/** @param {string} key */
function safeRemoveItem(key) {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch {}
}

/** Validate tasks object structure from localStorage
 * @param {any} raw
 * @returns {import('./types').TasksByDate}
 */
function validateTasks(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return /** @type {import('./types').TasksByDate} */ ({});
  /** @type {import('./types').TasksByDate} */
  const clean = {};
  for (const [date, list] of Object.entries(raw)) {
    if (Array.isArray(list)) {
      const validTasks = list.filter(t => t && typeof t === 'object' && typeof t.title === 'string');
      if (validTasks.length > 0) clean[date] = validTasks;
    }
  }
  return clean;
}

/** Validate user session structure from localStorage
 * @param {any} raw
 * @returns {import('./types').UserSession | null}
 */
function validateSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.jwt !== 'string' || !raw.jwt) return null;
  return raw;
}

/** @type {import('./types').AppState} */
export const state = {
  currentDate: new Date(),
  tasks: (() => { try { const s = safeGetItem('calendarTasks'); return s ? validateTasks(JSON.parse(s)) : {}; } catch { return {}; } })(),
  userSession: (() => { try { const s = safeGetItem('userSession'); return s ? validateSession(JSON.parse(s)) : null; } catch { return null; } })(),
  userGistId: safeGetItem('userGistId') || null,
  lastGistUpdatedAt: safeGetItem('lastGistUpdatedAt') || null,
  backgroundSyncTimer: null,
  backendSyncTimer: null,
  baseSyncIntervalMs: 120000, // 2 minutes
  currentSyncIntervalMs: 120000,
  maxSyncIntervalMs: 600000,
  filters: {
    month: 'all',
    status: 'all',
    priority: 'all',
  },
};

/** @param {Date | string} d */
export function setCurrentDate(d) {
  state.currentDate = d instanceof Date ? d : new Date(d);
}

/** @returns {import('./types').TasksByDate} */
export function getTasks() {
  return state.tasks;
}

/**
 * @param {import('./types').TasksByDate} newTasks
 * @param {{ silent?: boolean }} [options={}]
 */
export function setTasks(newTasks, options = {}) {
  const { silent = false } = options;
  state.tasks = newTasks || {};
  safeSetItem('calendarTasks', JSON.stringify(state.tasks));
  if (!silent) {
    notifyTasksUpdated();
  }
}

/**
 * @param {(draft: import('./types').TasksByDate) => void} mutatorFn
 * @param {{ silent?: boolean }} [options={}]
 */
export function updateTasks(mutatorFn, options = {}) {
  const draft = JSON.parse(JSON.stringify(state.tasks || {}));
  mutatorFn(draft);
  setTasks(draft, options);
}

/** @param {import('./types').UserSession | null} session */
export function setUserSession(session) {
  state.userSession = session;
  if (session) {
    safeSetItem('userSession', JSON.stringify(session));
  } else {
    safeRemoveItem('userSession');
  }
}

/** @param {string | null} id */
export function setUserGistId(id) {
  state.userGistId = id;
  if (id) safeSetItem('userGistId', id);
  else safeRemoveItem('userGistId');
}

/** @param {string | null} ts */
export function setLastGistUpdatedAt(ts) {
  state.lastGistUpdatedAt = ts;
  if (ts) safeSetItem('lastGistUpdatedAt', ts);
  else safeRemoveItem('lastGistUpdatedAt');
}

/** @param {string} month @param {string} status @param {string} [priority='all'] */
export function setFilters(month, status, priority = 'all') {
  state.filters.month = month;
  state.filters.status = status;
  state.filters.priority = priority;
}

/** @returns {void} */
export function notifyTasksUpdated() {
  const evt = new CustomEvent('tasksUpdated');
  document.dispatchEvent(evt);
}

// Util to format date to YYYY-MM-DD using local time (avoid timezone drift)
/** @param {Date} date @returns {string} */
export function formatDateLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
