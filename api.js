// API client and backend synchronization helpers for Calendar10
// Handles JWT-authenticated calls, pagination, and CRUD helpers
/**
 * @typedef {import('./types').Task} Task
 * @typedef {import('./types').APITask} APITask
 * @typedef {import('./types').TasksByDate} TasksByDate
 */

import { state, setTasks, getTasks } from './state.js';

/** @type {string} */
export const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000'
  : 'https://calendario-backend.vercel.app';

/** @returns {boolean} */
export function isLoggedInWithBackend() {
  return !!(state.userSession && state.userSession.jwt);
}

/**
 * @param {string} path
 * @param {RequestInit} [options]
 * @param {number} [retries=3]
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}, retries = 3) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (state.userSession && state.userSession.jwt) {
    headers['Authorization'] = `Bearer ${state.userSession.jwt}`;
  }
  const init = Object.assign({}, options, { headers });

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
}

// Pagination utility to retrieve all tasks from the backend
/** @param {number} [limit=100] @returns {Promise<APITask[]>} */
export async function fetchAllTasksFromBackend(limit = 100) {
  const aggregate = [];
  let offset = 0;
  while (true) {
    const res = await apiFetch(`/api/tasks?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error('Tasks list HTTP ' + res.status);
    const data = await res.json();
    const chunk = data.data || [];
    aggregate.push(...chunk);
    if (chunk.length < limit) break;
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
  const localById = new Map(localList.map(t => [String(t.id), t]));

  // Create or update
  for (const t of localList) {
    const existing = serverById.get(String(t.id));
    if (!existing) {
      /** @type {any} */
      const payload = {
        title: t.title,
        completed: Boolean(t.completed),
        is_reminder: t.isReminder !== undefined ? Boolean(t.isReminder) : true,
        priority: parseInt(t.priority || 1, 10),
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
      
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
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
    if (!localById.has(String(s.id))) {
      await apiFetch(`/api/tasks/${s.id}`, { method: 'DELETE' });
    }
  }
}

export async function createTaskOnBackend(payload) {
  console.log('Original payload received:', payload);
  
  // Ensure payload matches backend validation exactly
  const cleanPayload = {
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
  return res.json();
}

/** @param {number|string} serverId @param {Partial<{title:string;description:string|null;date:string|null;time:string|null;completed:boolean;is_reminder:boolean;priority:number;tags:string[]}>} payload */
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
