// API client and backend synchronization helpers for Calendar10
// Handles JWT-authenticated calls, pagination, and CRUD helpers
/**
 * @typedef {import('./types').Task} Task
 * @typedef {import('./types').APITask} APITask
 * @typedef {import('./types').TasksByDate} TasksByDate
 */

import { state, setTasks, getTasks } from './state.js';

/** @type {string} */
// IMPORTANTE: Después de crear el backend en Vercel, actualiza esta URL
export const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000'
  : 'https://calendario-backend-one.vercel.app';

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
/** @param {number} [limit=100] @param {number} [groupId=null] @returns {Promise<APITask[]>} */
export async function fetchAllTasksFromBackend(limit = 100, groupId = null) {
  const aggregate = [];
  let offset = 0;
  
  // Build query params
  let queryParams = `limit=${limit}`;
  if (groupId !== null && groupId !== undefined) {
    queryParams += `&group_id=${groupId}`;
  }
  
  while (true) {
    const res = await apiFetch(`/api/tasks?${queryParams}&offset=${offset}`);
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
  
  // Import currentCalendar from groups-ui.js if available
  let currentCalendar = { type: 'personal', id: null };
  if (typeof window !== 'undefined' && window.currentCalendar) {
    currentCalendar = window.currentCalendar;
  } else {
    try {
      const groupsModule = await import('./groups-ui.js');
      if (groupsModule.currentCalendar) {
        currentCalendar = groupsModule.currentCalendar;
      }
    } catch (err) {
      console.log('[SYNC] Groups module not available, using personal calendar');
    }
  }
  
  const groupId = currentCalendar.type === 'group' ? currentCalendar.id : null;
  
  console.log('[SYNC] Loading tasks from backend for calendar:', currentCalendar);
  const list = await fetchAllTasksFromBackend(100, groupId);
  console.log('[SYNC] Fetched', list.length, 'tasks from backend');
  
  // Get current local tasks
  const localTasks = getTasks();
  console.log('[SYNC] Current local tasks:', Object.keys(localTasks).length, 'dates');
  
  /** @type {TasksByDate} */
  const byDate = {};
  
  // Map text priority back to numeric for frontend
  const textToNumericPriority = {
    'baja': 2,
    'media': 3,
    'alta': 4
  };
  
  // First, add all backend tasks (server is source of truth for synced tasks)
  const backendIds = new Set();
  list.forEach(t => {
    const dateKey = (t.date || '').slice(0, 10) || 'undated';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    
    // Convert text priority to numeric if needed
    const priority = typeof t.priority === 'string' 
      ? (textToNumericPriority[t.priority] || 3)
      : (t.priority || 3);
    
    /** @type {Task} */
    const mapped = {
      id: String(t.id),
      title: t.title,
      description: t.description || '',
      date: dateKey === 'undated' ? null : dateKey,
      time: t.time || null,
      completed: !!t.completed,
      isReminder: t.is_reminder !== undefined ? t.is_reminder : true,
      priority: priority,
      tags: t.tags || [],
      _synced: true // Mark as synced with backend
    };
    byDate[dateKey].push(mapped);
    backendIds.add(String(t.id));
  });
  
  // Then, preserve local tasks that aren't in the backend yet
  // (these are tasks created locally but not yet synced or failed to sync)
  Object.entries(localTasks).forEach(([dateKey, tasks]) => {
    tasks.forEach(task => {
      const taskId = String(task.id);
      // Only keep local tasks that are NOT in backend
      // Use timestamp-based IDs to detect local-only tasks
      const isLocalOnly = !backendIds.has(taskId) && taskId.length >= 13;
      
      if (isLocalOnly) {
        console.log('[SYNC] Preserving local task not in backend:', task.title, 'ID:', taskId);
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push({ ...task, _needsSync: true });
      }
    });
  });
  
  console.log('[SYNC] Final merged tasks:', Object.keys(byDate).length, 'dates');
  setTasks(byDate);
  
  // Automatically push any local-only tasks to backend
  setTimeout(() => {
    console.log('[SYNC] Checking for tasks needing sync...');
    pushLocalTasksToBackend().then(() => {
      console.log('[SYNC] Auto-sync completed');
    }).catch(err => {
      console.error('[SYNC] Auto-sync failed:', err);
    });
  }, 1000);
  
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
      // Map numeric priority to text priority for Supabase
      const priorityMap = { 1: 'baja', 2: 'baja', 3: 'media', 4: 'alta', 5: 'alta' };
      const priorityValue = t.priority ? parseInt(t.priority, 10) : 3;
      const textPriority = priorityMap[priorityValue] || 'media';
      
      /** @type {any} */
      const payload = {
        title: t.title,
        completed: Boolean(t.completed),
        is_reminder: t.isReminder !== undefined ? Boolean(t.isReminder) : true,
        priority: textPriority,
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
      
      // Convert numeric priority to text for comparison and update
      const priorityMap = { 1: 'baja', 2: 'baja', 3: 'media', 4: 'alta', 5: 'alta' };
      const existingPriority = typeof existing.priority === 'string' ? existing.priority : priorityMap[existing.priority || 3] || 'media';
      const localPriorityNum = t.priority ? parseInt(t.priority, 10) : 3;
      const localPriority = priorityMap[localPriorityNum] || 'media';
      if (existingPriority !== localPriority) diff.priority = localPriority;
      
      const exTags = JSON.stringify(existing.tags || []);
      const loTags = JSON.stringify(t.tags || []);
      if (exTags !== loTags) diff.tags = t.tags || [];
      if (Object.keys(diff).length > 0) {
        // Use updateTaskOnBackend which handles priority conversion
        await updateTaskOnBackend(existing.id, diff);
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
  
  // Map numeric priority to text priority for Supabase
  const priorityMap = {
    '1': 'baja',
    '2': 'baja', 
    '3': 'media',
    '4': 'alta',
    '5': 'alta'
  };
  const priorityValue = payload.priority ? String(payload.priority) : '3';
  const textPriority = priorityMap[priorityValue] || 'media';
  
  // Ensure payload matches backend validation exactly
  const cleanPayload = {
    title: payload.title || '',
    completed: Boolean(payload.completed),
    is_reminder: Boolean(payload.isReminder || payload.is_reminder),
    priority: textPriority,
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
  
  // Include group_id if present (for group calendar tasks)
  if (payload.group_id !== undefined && payload.group_id !== null) {
    cleanPayload.group_id = payload.group_id;
    console.log('[GROUPS] Adding group_id to payload:', cleanPayload.group_id);
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
  // Convert numeric priority to text if present
  if (payload.priority !== undefined) {
    const priorityMap = { 1: 'baja', 2: 'baja', 3: 'media', 4: 'alta', 5: 'alta' };
    const textPriority = priorityMap[payload.priority] || 'media';
    payload = { ...payload, priority: textPriority };
  }
  
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
