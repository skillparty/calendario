import { writable, get } from 'svelte/store';
import type { TasksByDate, UserSession, AppState } from '../types';

function safeGetItem(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}

function safeSetItem(key: string, value: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch { }
}

function safeRemoveItem(key: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch { }
}

function validateTasks(raw: any): TasksByDate {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const clean: TasksByDate = {};
  for (const [date, list] of Object.entries(raw)) {
    if (Array.isArray(list)) {
      const validTasks = list.filter(t => t && typeof t === 'object' && typeof t.title === 'string');
      if (validTasks.length > 0) clean[date] = validTasks as any;
    }
  }
  return clean;
}

function validateSession(raw: any): UserSession | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.jwt !== 'string' || !raw.jwt) return null;
  return raw as UserSession;
}

const initialTasks = (() => { try { const s = safeGetItem('calendarTasks'); return s ? validateTasks(JSON.parse(s)) : {}; } catch { return {}; } })();
const initialSession = (() => { try { const s = safeGetItem('userSession'); return s ? validateSession(JSON.parse(s)) : null; } catch { return null; } })();

export const currentDateStore = writable<Date>(new Date());
export const tasksStore = writable<TasksByDate>(initialTasks);
export const userSessionStore = writable<UserSession | null>(initialSession);
export const filtersStore = writable({ month: 'all', status: 'all', priority: 'all' });

export const state: AppState = {
  get currentDate() { return get(currentDateStore); },
  set currentDate(v) { currentDateStore.set(v); },
  get tasks() { return get(tasksStore); },
  set tasks(v) { tasksStore.set(v); },
  get userSession() { return get(userSessionStore); },
  set userSession(v) { userSessionStore.set(v); },
  userGistId: safeGetItem('userGistId') || null,
  lastGistUpdatedAt: safeGetItem('lastGistUpdatedAt') || null,
  backgroundSyncTimer: null,
  backendSyncTimer: null,
  baseSyncIntervalMs: 120000,
  currentSyncIntervalMs: 120000,
  maxSyncIntervalMs: 600000,
  get filters() { return get(filtersStore); }
};

export function setCurrentDate(d: Date | string): void {
  state.currentDate = d instanceof Date ? d : new Date(d);
}

export function getTasks(): TasksByDate {
  return get(tasksStore);
}

export function setTasks(newTasks: TasksByDate, options: { silent?: boolean } = {}): void {
  const { silent = false } = options;
  tasksStore.set(newTasks || {});
  safeSetItem('calendarTasks', JSON.stringify(get(tasksStore)));
  if (!silent) {
    notifyTasksUpdated();
  }
}

export function updateTasks(mutatorFn: (draft: TasksByDate) => void, options: { silent?: boolean } = {}): void {
  tasksStore.update(currentTasks => {
    const draft = JSON.parse(JSON.stringify(currentTasks || {}));
    mutatorFn(draft);
    safeSetItem('calendarTasks', JSON.stringify(draft));
    if (!options.silent) {
      setTimeout(notifyTasksUpdated, 0);
    }
    return draft;
  });
}

export function setUserSession(session: UserSession | null): void {
  state.userSession = session;
  if (session) {
    safeSetItem('userSession', JSON.stringify(session));
  } else {
    safeRemoveItem('userSession');
  }
}

export function setUserGistId(id: string | null): void {
  state.userGistId = id;
  if (id) safeSetItem('userGistId', id);
  else safeRemoveItem('userGistId');
}

export function setLastGistUpdatedAt(ts: string | null): void {
  state.lastGistUpdatedAt = ts;
  if (ts) safeSetItem('lastGistUpdatedAt', ts);
  else safeRemoveItem('lastGistUpdatedAt');
}

export function setFilters(month: string, status: string, priority: string = 'all'): void {
  filtersStore.set({ month, status, priority });
}

export function notifyTasksUpdated(): void {
  const evt = new CustomEvent('tasksUpdated');
  if (typeof document !== 'undefined') {
    document.dispatchEvent(evt);
  }
}

export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
