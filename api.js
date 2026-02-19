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
  const headers = /** @type {any} */ (Object.assign({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }, options.headers || {}));
  if (state.userSession && state.userSession.jwt) {
    headers['Authorization'] = `Bearer ${state.userSession.jwt}`;
  }
  const init = Object.assign({}, options, { headers, cache: 'no-store' });
  const fetchPath = path;

  if (DEBUG) console.log('API Request:', { url: API_BASE_URL + fetchPath, method: init.method || 'GET' });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_BASE_URL + fetchPath, init);

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
// IMPORTANT: The backend is the source of truth, BUT we must not overwrite
// local "dirty" changes that happened while the fetch was in progress.
/** @param {{ forceClean?: boolean }} [options]
 * @returns {Promise<boolean>} */
export async function loadTasksIntoState(options = {}) {
  const { forceClean = false } = options;
  if (!isLoggedInWithBackend()) return false;

  if (forceClean) {
    console.log('[sync] forceClean mode — server is absolute source of truth');
  }

  // 1. Push dirty local changes to the server BEFORE fetching (skip in forceClean mode)
  const preFetchState = getTasks();
  const dirtyTasks = forceClean ? [] : Object.values(preFetchState).flat().filter(t => t.dirty);

  if (dirtyTasks.length > 0) {
    console.log('[sync] Pushing', dirtyTasks.length, 'dirty tasks before fetch');
    await Promise.allSettled(dirtyTasks.map(async (t) => {
      const sId = t.serverId ?? (typeof t.id === 'number' ? t.id : (/^\d+$/.test(String(t.id)) ? Number(t.id) : null));
      if (sId) {
        try {
          /** @type {Record<string, any>} */
          const payload = { completed: !!t.completed };
          if (t.title) payload.title = t.title;
          if (t.description !== undefined) payload.description = t.description || null;
          if (t.priority !== undefined) payload.priority = mapPriorityToServer(t.priority);
          await updateTaskOnBackend(sId, payload);
        } catch (e) { console.warn('[sync] dirty-push FAILED for', sId, e); }
      }
    }));
  }

  // 2. Fetch latest from server
  const list = await fetchAllTasksFromBackend(100);

  // 3. Merging Logic: Re-read state in case it changed during fetch/push
  const currentAll = forceClean ? {} : getTasks();
  const currentDirtyMap = new Map();
  if (!forceClean) {
    Object.values(currentAll).flat().forEach(t => {
      if (t.dirty) currentDirtyMap.set(String(t.id), t);
    });
  }

  // Build a set of all server task IDs for quick lookup
  const serverIdSet = new Set(list.map(t => String(t.id)));

  // Identify local-only tasks and "orphaned" tasks (synced locally but missing from server)
  // In forceClean mode, we do NOT preserve local tasks — server is the sole source of truth.
  const tasksToPreserve = forceClean ? [] : Object.values(currentAll).flat().filter(t => {
    // 1. Task was created locally and never got a server ID
    if (!t.serverId && String(t.id).startsWith('local_')) return true;

    // 2. Task has a server ID (was synced) but is NOT in the current server list
    const sId = String(t.serverId || t.id);
    if ((t.serverId || (t.id && !String(t.id).startsWith('local_'))) && !serverIdSet.has(sId)) {
      return true;
    }
    return false;
  });

  // DEDUPLICATION LOGIC
  // Group tasks by signature to find duplicates
  const seenSignatures = new Map();
  const duplicatesToDelete = [];
  const uniqueList = [];

  // Sort list by ID (assuming lower ID = older = original)
  list.sort((a, b) => a.id - b.id);

  for (const t of list) {
    const dateKey = (t.date || '').slice(0, 10) || 'undated';
    // Signature: title + date + time + description
    const signature = `${t.title}|${dateKey}|${t.time || ''}|${t.description || ''}`;

    if (seenSignatures.has(signature)) {
      // This is a duplicate!
      duplicatesToDelete.push(t.id);
    } else {
      seenSignatures.set(signature, t.id);
      uniqueList.push(t);
    }
  }

  // If duplicates found, trigger background cleanup
  if (duplicatesToDelete.length > 0) {
    console.warn(`Found ${duplicatesToDelete.length} duplicate tasks. cleaning up...`);
    // Delete in background to not block UI
    (async () => {
      for (let i = 0; i < duplicatesToDelete.length; i += 5) {
        const chunk = duplicatesToDelete.slice(i, i + 5);
        await Promise.allSettled(chunk.map((/** @type {number|string} */ id) => deleteTaskOnBackend(id).catch(() => { })));
      }
      console.log('Duplicate cleanup complete');
    })();
  }

  /** @type {TasksByDate} */
  const finalState = {};

  // Helper to add task to state
  /** @param {any} t */
  const addTaskToState = (t) => {
    const dateKey = (t.date || '').slice(0, 10) || 'undated';
    if (!finalState[dateKey]) finalState[dateKey] = [];
    finalState[dateKey].push(t);
  };

  // 4. Process valid server tasks
  uniqueList.forEach(serverTask => {
    const sId = String(serverTask.id);

    // If we have a local dirty version of this task, PRESERVE IT (race condition handling)
    if (currentDirtyMap.has(sId)) {
      addTaskToState(currentDirtyMap.get(sId));
      return;
    }

    // Otherwise use server version
    const mapped = {
      id: sId,
      serverId: Number(serverTask.id),
      title: serverTask.title,
      description: serverTask.description || '',
      date: (serverTask.date || '').slice(0, 10) || null,
      time: serverTask.time || null,
      completed: !!serverTask.completed,
      isReminder: serverTask.is_reminder !== undefined ? serverTask.is_reminder : true,
      priority: (function () {
        if (typeof serverTask.priority === 'number') return serverTask.priority;
        if (serverTask.priority === 'alta') return 1;
        if (serverTask.priority === 'media') return 2;
        return 3; // baja or default
      })(),
      tags: serverTask.tags || [],
      recurrence: serverTask.recurrence || undefined,
      recurrenceId: serverTask.recurrence_id || undefined,
      dirty: false // Explicitly clear dirty since we just fetched it (unless we used local override)
    };
    addTaskToState(mapped);
  });

  // 5. Add local-only tasks and RECOVER orphaned tasks
  // If a task exists locally with a serverId but isn't in the server list,
  // we treat it as an upload failure/data loss and RE-UPLOAD it (Self-Repair).
  const timestamp = Date.now();
  tasksToPreserve.forEach(t => {
    // If it was an orphaned server task (has serverId/id but not in set), strip it to re-sync
    let taskToAdd = t;
    if (t.serverId || (t.id && !String(t.id).startsWith('local_'))) {
      console.warn('[sync] Recovering orphaned task:', t.id, t.title);
      // Check if it's actually a duplicate of a valid server task we just received
      const dateKey = t.date || 'undated';
      const signature = `${t.title}|${t.date ? t.date.slice(0, 10) : ''}|${t.time || ''}|${t.description || ''}`;
      if (seenSignatures.has(signature)) {
        console.log('[sync] Orphaned task matches existing server task, linking...', seenSignatures.get(signature));
        return; // Already exists, just ignore orphan
      }

      // It's truly missing. Convert to new local task to force push.
      taskToAdd = {
        ...t,
        id: `local_recovered_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        serverId: undefined,
        dirty: true // FORCE PUSH
      };
    }

    const dateKey = taskToAdd.date || 'undated';
    if (!finalState[dateKey]) finalState[dateKey] = [];

    // Avoid exact ID duplicates in state
    if (!finalState[dateKey].find(existing => String(existing.id) === String(taskToAdd.id))) {
      finalState[dateKey].push(taskToAdd);
    }
  });

  // 6. Push state - this now respects dirty concurrent edits
  setTasks(finalState);
  console.log(`[sync] State updated: ${Object.values(finalState).flat().length} tasks loaded from server${forceClean ? ' (forceClean)' : ''}`);

  if (!forceClean && tasksToPreserve.length > 0) {
    pushLocalTasksToBackend().catch(err => console.error('Background push failed:', err));
  }

  return true;
}

// Reconcile local tasks with server (create/update/delete)
/** @returns {Promise<void>} */
export async function pushLocalTasksToBackend() {
  if (!isLoggedInWithBackend()) return;

  // Validate JWT before firing bulk requests — abort on 401
  const authCheck = await apiFetch('/api/auth/me', {}, 1).catch(() => null);
  if (authCheck && authCheck.status === 401) {
    console.warn('[sync] JWT invalid/expired — clearing session');
    const { setUserSession } = await import('./state.js');
    setUserSession(null);
    return;
  }

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

  const tasksToClearDirty = new Set();
  let authFailed = false;

  // Build parallel create/update promises
  /** @type {Promise<void>[]} */
  const syncPromises = localList.map(async (t) => {
    if (authFailed) return;
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

      if (createRes.status === 401) { authFailed = true; return; }
      if (createRes.ok) {
        const created = await createRes.clone().json().catch(() => null);
        const createdId = created && created.id !== undefined ? Number(created.id) : null;
        if (createdId && Number.isFinite(createdId)) {
          serverById.set(String(createdId), created);
          localServerIds.add(String(createdId));
          if (String(t.id) !== String(createdId) || t.serverId !== createdId) {
            idReplacements.push({ oldId: String(t.id), newId: String(createdId), serverId: createdId });
          }
          tasksToClearDirty.add(String(t.id));
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
        const putRes = await apiFetch(`/api/tasks/${existing.id}`, { method: 'PUT', body: JSON.stringify(diff), keepalive: true });
        if (putRes.status === 401) { authFailed = true; return; }
      }
      // Mark as synced regardless of whether diff was needed
      tasksToClearDirty.add(String(t.id));
    }
  });

  await Promise.allSettled(syncPromises);

  // NOTE: We intentionally do NOT delete server tasks that are missing locally.
  // Other devices may have created tasks that this device hasn't fetched yet.
  // Task deletion is handled explicitly by deleteTask() / deleteTaskOnBackend().

  if (idReplacements.length > 0 || tasksToClearDirty.size > 0) {
    updateTasks((draft) => {
      Object.keys(draft).forEach((dateKey) => {
        draft[dateKey] = (draft[dateKey] || []).map((task) => {
          let updatedTask = task;

          const replacement = idReplacements.find((entry) => entry.oldId === String(task.id));
          if (replacement) {
            updatedTask = { ...task, id: replacement.newId, serverId: replacement.serverId };
          }

          // Clear dirty flag if it was successfully verified/synced
          // Check against old ID (t.id) because that's what we tracked in the loop
          // Note: if replacement occurred, it means we created it, so it is synced.
          if (tasksToClearDirty.has(String(task.id))) {
            if (updatedTask.dirty) {
              updatedTask.dirty = false;
            }
          }

          return updatedTask;
        });
      });
    }, { silent: true });
  }
}

/** @param {any} payload */
export async function createTaskOnBackend(payload) {
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
  console.log('[updateTaskOnBackend] PUT /api/tasks/' + serverId, payload);
  const res = await apiFetch(`/api/tasks/${serverId}`, { method: 'PUT', body: JSON.stringify(payload) });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('[updateTaskOnBackend] FAILED:', res.status, errText);
    throw new Error('HTTP ' + res.status + ': ' + errText);
  }
  const json = await res.json();
  console.log('[updateTaskOnBackend] SUCCESS:', json);
  return json;
}

/** @param {number|string} serverId */
export async function deleteTaskOnBackend(serverId) {
  const res = await apiFetch(`/api/tasks/${serverId}`, { method: 'DELETE', keepalive: true });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return true;
}
