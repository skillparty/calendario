// API client and backend synchronization helpers for Calendar10
// Handles JWT-authenticated calls, pagination, and CRUD helpers
/**
 * @typedef {import('./types').Task} Task
 * @typedef {import('./types').APITask} APITask
 * @typedef {import('./types').TasksByDate} TasksByDate
 */

import { state, setTasks, getTasks, updateTasks } from './state.js';

const DEBUG = window.location.hostname === 'localhost';

/** @type {string} */
// Backend URL - actualizado con el nuevo despliegue de Vercel
export const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://backend-eight-zeta-snldyompdv.vercel.app';

/** @returns {boolean} */
export function isLoggedInWithBackend() {
  return !!(state.userSession && state.userSession.jwt);
}

/**
 * @param {Task & {serverId?: number}} task
 * @returns {number | null}
 */
function getServerId(task) {
  if (typeof task?.serverId === 'number') return task.serverId;
  if (typeof task?.id === 'number') return task.id;
  const id = String(task?.id || '');
  if (/^\d+$/.test(id)) return parseInt(id, 10);
  return null;
}

/**
 * @param {any} raw
 * @returns {'alta' | 'media' | 'baja'}
 */
function mapPriorityToServer(raw) {
  if (raw === 'alta' || raw === 'media' || raw === 'baja') return raw;
  const p = parseInt(raw || '3', 10);
  if (p === 1) return 'alta';
  if (p === 2) return 'media';
  return 'baja';
}

/**
 * @param {string} path
 * @param {RequestInit} [options]
 * @param {number} [retries=3]
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}, retries = 3) {
  /** @type {Record<string, string>} */
  const headers = /** @type {any} */ (Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}));
  if (state.userSession && state.userSession.jwt) {
    headers['Authorization'] = `Bearer ${state.userSession.jwt}`;
  }
  const init = Object.assign({}, options, { headers });

  if (DEBUG) console.log('API Request:', { url: API_BASE_URL + path, method: init.method || 'GET' });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_BASE_URL + path, init);

      if (DEBUG) console.log('API Response:', res.status, res.statusText);

      if (!res.ok && DEBUG) {
        const errorText = await res.clone().text();
        console.error('API Error Response:', errorText);
      }

      if ((res.status === 502 || res.status === 503) && attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`apiFetch failed after ${retries} retries`);
}

// Pagination utility to retrieve all tasks from the backend
/** @param {number} [limit=100] @returns {Promise<APITask[]>} */
export async function fetchAllTasksFromBackend(limit = 100) {
  const aggregate = [];
  const seenIds = new Set();
  let offset = 0;
  let guard = 0;

  while (true) {
    const res = await apiFetch(`/api/tasks?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error('Tasks list HTTP ' + res.status);
    const data = await res.json();
    const chunk = data.data || [];

    if (!Array.isArray(chunk) || chunk.length === 0) break;

    let newItems = 0;
    for (const task of chunk) {
      const key = String(task.id);
      if (!seenIds.has(key)) {
        seenIds.add(key);
        aggregate.push(task);
        newItems += 1;
      }
    }

    // Normal paginated backend: last page is shorter than limit
    if (chunk.length < limit) break;

    // Non-paginated backend fallback: same chunk repeats forever
    if (newItems === 0) break;

    guard += 1;
    if (guard > 1000) break;

    offset += limit;
  }
  return aggregate;
}

// Load all tasks from backend and place into state in { dateKey: Task[] } form
/** @returns {Promise<boolean>} */
export async function loadTasksIntoState() {
  if (!isLoggedInWithBackend()) return false;
  const list = await fetchAllTasksFromBackend(100);
  /** @type {TasksByDate} */
  const byDate = {};
  list.forEach(t => {
    const dateKey = (t.date || '').slice(0, 10) || 'undated';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    /** @type {Task} */
    const mapped = {
      id: String(t.id),
      serverId: Number(t.id),
      title: t.title,
      description: t.description || '',
      date: dateKey === 'undated' ? null : dateKey,
      time: t.time || null,
      completed: !!t.completed,
      isReminder: t.is_reminder !== undefined ? t.is_reminder : true,
      priority: t.priority || 1,
      tags: t.tags || []
    };
    byDate[dateKey].push(mapped);
  });
  setTasks(byDate);
  return true;
}

// Reconcile local tasks with server (create/update/delete)
/** @returns {Promise<void>} */
export async function pushLocalTasksToBackend() {
  if (!isLoggedInWithBackend()) return;
  const server = await fetchAllTasksFromBackend(100);
  const serverById = new Map(server.map(t => [String(t.id), t]));

  const localList = Object.entries(getTasks() || {}).flatMap(([date, list]) => (list || []).map(t => ({ ...t, date })));
  const localServerIds = new Set(
    localList
      .map(t => getServerId(t))
      .filter((id) => id !== null)
      .map((id) => String(id))
  );
  /** @type {Array<{ oldId: string; newId: string; serverId: number }>} */
  const idReplacements = [];

  // Create or update
  for (const t of localList) {
    const resolvedServerId = getServerId(t);
    const existing = resolvedServerId ? serverById.get(String(resolvedServerId)) : null;
    if (!existing) {
      /** @type {any} */
      const payload = {
        title: t.title,
        completed: Boolean(t.completed),
        is_reminder: t.isReminder !== undefined ? Boolean(t.isReminder) : true,
        priority: mapPriorityToServer(t.priority),
        tags: Array.isArray(t.tags) ? t.tags : []
      };

      // Only add description if it's not empty
      if (t.description && t.description.trim() !== '') {
        payload.description = t.description.trim();
      }

      // Only add date if it's valid (not null, not empty, not 'undated')
      if (t.date && t.date !== 'undated' && t.date.trim() !== '') {
        const dateStr = t.date.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          payload.date = dateStr;

          // Only add time if date is present and time is valid
          if (t.time && t.time.trim() !== '') {
            payload.time = t.time.trim();
          }
        }
      }

      const createRes = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (createRes.ok) {
        const created = await createRes.clone().json().catch(() => null);
        const createdId = created && created.id !== undefined ? Number(created.id) : null;
        if (createdId && Number.isFinite(createdId)) {
          serverById.set(String(createdId), created);
          localServerIds.add(String(createdId));
          if (String(t.id) !== String(createdId) || t.serverId !== createdId) {
            idReplacements.push({ oldId: String(t.id), newId: String(createdId), serverId: createdId });
          }
        }
      }
    } else {
      /** @type {Partial<APITask> & {[k: string]: any}} */
      const diff = {};
      if (existing.title !== t.title) diff.title = t.title;
      if ((existing.description || '') !== (t.description || '')) diff.description = t.description || null;
      const exDate = (existing.date || '').slice(0, 10);
      const taskDate = (t.date && t.date !== 'undated') ? t.date : null;
      if (exDate !== taskDate) diff.date = taskDate;
      if (!!existing.completed !== !!t.completed) diff.completed = !!t.completed;
      const exRem = existing.is_reminder !== undefined ? existing.is_reminder : true;
      const loRem = t.isReminder !== undefined ? t.isReminder : true;
      if (exRem !== loRem) diff.is_reminder = loRem;
      if ((existing.priority || 1) !== (t.priority || 1)) diff.priority = t.priority || 1;
      const exTags = JSON.stringify(existing.tags || []);
      const loTags = JSON.stringify(t.tags || []);
      if (exTags !== loTags) diff.tags = t.tags || [];
      if (Object.keys(diff).length > 0) {
        await apiFetch(`/api/tasks/${existing.id}`, { method: 'PUT', body: JSON.stringify(diff) });
      }
    }
  }

  // Delete removed on server
  for (const s of server) {
    if (!localServerIds.has(String(s.id))) {
      await apiFetch(`/api/tasks/${s.id}`, { method: 'DELETE' });
    }
  }

  if (idReplacements.length > 0) {
    updateTasks((draft) => {
      Object.keys(draft).forEach((dateKey) => {
        draft[dateKey] = (draft[dateKey] || []).map((task) => {
          const replacement = idReplacements.find((entry) => entry.oldId === String(task.id));
          if (!replacement) return task;
          return {
            ...task,
            id: replacement.newId,
            serverId: replacement.serverId
          };
        });
      });
    });
  }
}

/** @param {any} payload */
export async function createTaskOnBackend(payload) {
  console.log('Original payload received:', payload);

  // Ensure payload matches backend validation exactly
  /** @type {Record<string, any>} */
  const cleanPayload = {
    title: payload.title || '',
    completed: Boolean(payload.completed),
    is_reminder: Boolean(payload.isReminder || payload.is_reminder),
    // Map priority integer to string enum for DB
    priority: (function () {
      const p = parseInt(payload.priority || '3');
      if (p === 1) return 'alta';
      if (p === 2) return 'media';
      return 'baja'; // Default (3)
    })(),
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    recurrence: payload.recurrence || null,
    recurrence_id: payload.recurrenceId || payload.recurrence_id || null
  };

  // Only add description if it's not empty
  if (payload.description && payload.description.trim() !== '') {
    cleanPayload.description = payload.description.trim();
  }

  // Only include date if it's a valid date string (not null, not empty, not undefined)
  if (payload.date &&
    typeof payload.date === 'string' &&
    payload.date.trim() !== '' &&
    payload.date !== 'null' &&
    payload.date !== 'undefined') {

    const dateStr = payload.date.trim();
    // Validate date format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      cleanPayload.date = dateStr;

      // Only include time if date is present and time is valid
      if (payload.time && typeof payload.time === 'string' && payload.time.trim() !== '') {
        cleanPayload.time = payload.time.trim();
      }
    } else {
      console.warn('Invalid date format, skipping date field:', dateStr);
    }
  }

  console.log('Clean payload to send:', cleanPayload);
  console.log('Payload keys:', Object.keys(cleanPayload));

  const res = await apiFetch('/api/tasks', { method: 'POST', body: JSON.stringify(cleanPayload) });
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Create task failed:', res.status, errorText);
    throw new Error('HTTP ' + res.status + ': ' + errorText);
  }
  return res.json();
}

/** @param {number|string} serverId @param {Partial<{title:string;description:string|null;date:string|null;time:string|null;completed:boolean;is_reminder:boolean;priority:number;tags:string[];recurrence:string|null;recurrence_id:string|null}>} payload */
export async function updateTaskOnBackend(serverId, payload) {
  const res = await apiFetch(`/api/tasks/${serverId}`, { method: 'PUT', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/** @param {number|string} serverId */
export async function deleteTaskOnBackend(serverId) {
  const res = await apiFetch(`/api/tasks/${serverId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return true;
}
