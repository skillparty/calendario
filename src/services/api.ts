import type { Task, APITask, TasksByDate } from '../types';
import { state, setTasks, getTasks, updateTasks, notifyTasksUpdated } from '../store/state.js';

function unwrapTaskPayload(payload: unknown): Record<string, any> | null {
  if (!payload || typeof payload !== 'object') return null;
  if ('data' in payload && payload.data && typeof payload.data === 'object') {
    return payload.data as Record<string, any>;
  }
  return payload as Record<string, any>;
}

function normalizePriorityValue(priority: any): number {
  if (priority === 1 || priority === '1' || priority === 'alta') return 1;
  if (priority === 2 || priority === '2' || priority === 'media') return 2;
  if (priority === 3 || priority === '3' || priority === 'baja') return 3;
  return 1;
}

function buildTaskSignature(taskLike: { title?: string; description?: string | null; date?: string | null; time?: string | null }): string {
  const title = (taskLike.title || '').trim().toLowerCase();
  const description = (taskLike.description || '').trim().toLowerCase();
  const date = taskLike.date || null;
  const time = taskLike.time || null;
  return `${title}|${description}|${date || ''}|${time || ''}`;
}

// Backend URL - actualizado con el nuevo despliegue de Vercel
export const API_BASE_URL: string = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://backend-eight-zeta-snldyompdv.vercel.app';

export function isLoggedInWithBackend(): boolean {
  return !!(state.userSession && state.userSession.jwt);
}

export async function apiFetch(path: string, options: RequestInit = {}, retries: number = 3): Promise<Response> {
  const headers: Record<string, string> = Object.assign({ 'Content-Type': 'application/json' }, (options.headers || {}) as Record<string, string>);
  if (state.userSession && state.userSession.jwt) {
    headers['Authorization'] = `Bearer ${state.userSession.jwt}`;
  }
  const init: RequestInit = Object.assign({}, options, { headers });

  console.log('API Request:', {
    url: API_BASE_URL + path,
    method: init.method || 'GET',
    headers: headers,
    body: init.body
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_BASE_URL + path, init);

      console.log('API Response:', {
        status: res.status,
        statusText: res.statusText,
        url: res.url
      });

      if (!res.ok) {
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

  throw new Error('Request failed after retries');
}

// Pagination utility to retrieve all tasks from the backend
export async function fetchAllTasksFromBackend(limit: number = 100): Promise<APITask[]> {
  const aggregate: APITask[] = [];
  let offset = 0;
  const seenIds = new Set<string>();
  let previousPageFingerprint: string | null = null;

  while (true) {
    const res = await apiFetch(`/api/tasks?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error('Tasks list HTTP ' + res.status);
    const data = await res.json();
    const chunkRaw = Array.isArray(data.data) ? data.data : [];

    const chunk = chunkRaw.filter((task: any) => {
      const id = task && task.id !== undefined && task.id !== null ? String(task.id) : null;
      if (!id) return true;
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    aggregate.push(...chunk);

    const pageFingerprint = chunkRaw.map((task: any) => String(task?.id ?? '')).join(',');
    if (chunkRaw.length < limit) break;
    if (pageFingerprint && previousPageFingerprint === pageFingerprint) break;
    if (chunk.length === 0) break;

    previousPageFingerprint = pageFingerprint;
    offset += limit;
  }
  return aggregate;
}

// Load all tasks from backend and place into state in { dateKey: Task[] } form
export async function loadTasksIntoState(): Promise<boolean> {
  if (!isLoggedInWithBackend()) return false;
  const list = await fetchAllTasksFromBackend(100);
  const byDate: TasksByDate = {};
  list.forEach(t => {
    const dateKey = (t.date || '').slice(0, 10) || 'undated';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    const parsedServerId = Number(t.id);
    const mapped: Task = {
      id: String(t.id),
      serverId: Number.isFinite(parsedServerId) ? parsedServerId : undefined,
      title: t.title,
      description: t.description || '',
      date: dateKey === 'undated' ? null : dateKey,
      time: t.time || null,
      completed: !!t.completed,
      isReminder: t.is_reminder !== undefined ? t.is_reminder : true,
      priority: normalizePriorityValue(t.priority),
      tags: t.tags || []
    };
    byDate[dateKey].push(mapped);
  });
  setTasks(byDate);
  return true;
}

// Reconcile local tasks with server (create/update/delete)
export async function pushLocalTasksToBackend(): Promise<void> {
  if (!isLoggedInWithBackend()) return;
  const server = await fetchAllTasksFromBackend(100);
  const serverById = new Map(server.map(t => [String(t.id), t]));

  const serverBySignature = new Map<string, APITask[]>();
  for (const serverTask of server) {
    const signature = buildTaskSignature({
      title: serverTask.title,
      description: serverTask.description || '',
      date: (serverTask.date || '').slice(0, 10) || null,
      time: serverTask.time || null
    });
    const bucket = serverBySignature.get(signature) || [];
    bucket.push(serverTask);
    serverBySignature.set(signature, bucket);
  }

  const localList = Object.entries(getTasks() || {}).flatMap(([dateKey, list]) =>
    (list || []).map(t => ({ ...t, date: dateKey === 'undated' ? null : dateKey }))
  );

  const relinkMappings: Array<{ localId: string; serverId: number }> = [];

  // Create or update
  for (const t of localList) {
    const explicitServerId = t.serverId !== undefined && t.serverId !== null ? String(t.serverId) : null;
    const numericTaskId = /^\d+$/.test(String(t.id)) ? String(t.id) : null;

    let existing: APITask | undefined = undefined;
    if (explicitServerId) {
      existing = serverById.get(explicitServerId);
    }
    if (!existing && numericTaskId) {
      existing = serverById.get(numericTaskId);
    }
    if (!existing) {
      const signature = buildTaskSignature({
        title: t.title,
        description: t.description || '',
        date: t.date,
        time: t.time || null
      });
      const bucket = serverBySignature.get(signature) || [];
      existing = bucket.shift();
      if (bucket.length > 0) serverBySignature.set(signature, bucket);
      else serverBySignature.delete(signature);

      if (existing) {
        const existingServerId = Number(existing.id);
        if (String(t.id) !== String(existing.id) && Number.isFinite(existingServerId)) {
          relinkMappings.push({ localId: String(t.id), serverId: existingServerId });
        }
      }
    }

    if (!existing) {
      const payload: any = {
        title: t.title,
        completed: Boolean(t.completed),
        is_reminder: t.isReminder !== undefined ? Boolean(t.isReminder) : true,
        priority: Number(t.priority || 1),
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
        const createdPayload = unwrapTaskPayload(await createRes.json());
        const createdServerId = Number(createdPayload?.id);
        if (Number.isFinite(createdServerId)) {
          relinkMappings.push({ localId: String(t.id), serverId: createdServerId });
        }
      }
    } else {
      const diff: Partial<APITask> & { [k: string]: any } = {};
      if (existing.title !== t.title) diff.title = t.title;
      if ((existing.description || '') !== (t.description || '')) diff.description = t.description || null;
      const exDate = (existing.date || '').slice(0, 10);
      const taskDate = (t.date && t.date !== 'undated') ? t.date : null;
      if (exDate !== taskDate) diff.date = taskDate;
      if (!!existing.completed !== !!t.completed) diff.completed = !!t.completed;
      const exRem = existing.is_reminder !== undefined ? existing.is_reminder : true;
      const loRem = t.isReminder !== undefined ? t.isReminder : true;
      if (exRem !== loRem) diff.is_reminder = loRem;
      if (normalizePriorityValue(existing.priority) !== normalizePriorityValue(t.priority)) diff.priority = t.priority || 1;
      const exTags = JSON.stringify(existing.tags || []);
      const loTags = JSON.stringify(t.tags || []);
      if (exTags !== loTags) diff.tags = t.tags || [];
      if (Object.keys(diff).length > 0) {
        await apiFetch(`/api/tasks/${existing.id}`, { method: 'PUT', body: JSON.stringify(diff) });
      }
    }
  }

  if (relinkMappings.length > 0) {
    updateTasks(draft => {
      Object.keys(draft).forEach(dateKey => {
        draft[dateKey] = (draft[dateKey] || []).map(task => {
          const mapping = relinkMappings.find(m => String(task.id) === m.localId);
          if (!mapping) return task;
          return {
            ...task,
            id: String(mapping.serverId),
            serverId: mapping.serverId,
            dirty: false
          };
        });
      });
    }, { silent: true });
    notifyTasksUpdated();
  }
}

export async function createTaskOnBackend(payload: any): Promise<any> {
  console.log('Original payload received:', payload);

  // Ensure payload matches backend validation exactly
  const cleanPayload: Record<string, any> = {
    title: payload.title || '',
    completed: Boolean(payload.completed),
    is_reminder: Boolean(payload.isReminder || payload.is_reminder),
    priority: parseInt(payload.priority || '3'),
    tags: Array.isArray(payload.tags) ? payload.tags : []
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
  const data = await res.json();
  return unwrapTaskPayload(data) || data;
}

export async function updateTaskOnBackend(serverId: number | string, payload: Partial<{ title: string; description: string | null; date: string | null; time: string | null; completed: boolean; is_reminder: boolean; priority: number; tags: string[]; recurrence: string | null; recurrence_id: number | string | null }>): Promise<any> {
  const res = await apiFetch(`/api/tasks/${serverId}`, { method: 'PUT', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return unwrapTaskPayload(data) || data;
}

export async function deleteTaskOnBackend(serverId: number | string): Promise<boolean> {
  const res = await apiFetch(`/api/tasks/${serverId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return true;
}
