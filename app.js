// App entrypoint for Calendar10
// Wires modules together, handles auth flows, gist sync, notifications, and top-level UI
/**
 * @typedef {import('./types').Task} Task
 * @typedef {import('./types').TasksByDate} TasksByDate
 * @typedef {import('./types').UserSession} UserSession
 */

import { state, setCurrentDate, setTasks, getTasks, setUserSession, setUserGistId, setLastGistUpdatedAt, notifyTasksUpdated } from './state.js';
import { API_BASE_URL, isLoggedInWithBackend, loadTasksIntoState, pushLocalTasksToBackend } from './api.js';
import { renderCalendar, initCalendar, showTaskInputModal } from './calendar.js';
import { renderAgenda } from './agenda.js';
import { renderWeekly } from './weekly.js';
import { showPdfExportModal } from './pdf.js';
import { showAuthToast, showSyncToast, showToast } from './utils/UIFeedback.js';

// GitHub OAuth constants
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
const GITHUB_REDIRECT_URI = (typeof window !== 'undefined' && window.location && window.location.origin)
  ? window.location.origin
  : 'https://your-frontend.vercel.app';
const GITHUB_AUTH_URL = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user,gist&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}`;
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_DEVICE_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const OAUTH_PROXY_URL = API_BASE_URL + '/api/auth/github';

/** @type {HTMLButtonElement | null} */ let calendarBtn;
/** @type {HTMLButtonElement | null} */ let agendaBtn;
/** @type {HTMLButtonElement | null} */ let loginBtn;
/** @type {HTMLButtonElement | null} */ let logoutBtn;
/** @type {HTMLElement | null} */ let userInfo;
/** @type {HTMLImageElement | null} */ let userAvatar;
/** @type {HTMLElement | null} */ let userName;
/** @type {HTMLElement | null} */ let calendarView;
/** @type {HTMLElement | null} */ let agendaView;
/** @type {HTMLButtonElement | null} */ let weeklyBtn;
/** @type {HTMLElement | null} */ let weeklyView;

/** Hide the initial loading overlay */
function hideAppLoading() {
  const overlay = document.getElementById('app-loading');
  if (overlay) overlay.classList.add('hidden');
}

/** @param {string} message @param {boolean} [isError=false] */
function showAuthStatus(message, isError = false) {
  showAuthToast(message, isError);
}

/** @param {string} message @param {boolean} [isError=false] */
function showSyncStatus(message, isError = false) {
  showSyncToast(message, isError);
}

/** 
 * @param {HTMLElement | null} nextView 
 * @param {string} viewName
 */
function switchView(nextView, viewName) {
  if (!nextView) return;
  
  // Find currently active view
  const currentView = [calendarView, agendaView, weeklyView].find(v => v && !v.classList.contains('hidden'));
  
  // If clicking same view, do nothing
  if (currentView === nextView) return;

  document.body.setAttribute('data-current-view', viewName);

  if (currentView) {
    currentView.classList.add('animate-out');
    currentView.addEventListener('animationend', () => {
      currentView.classList.add('hidden');
      currentView.classList.remove('animate-out');
    }, { once: true });
  }

  nextView.classList.remove('hidden');
  nextView.classList.add('animate-in');
  nextView.addEventListener('animationend', () => {
    nextView.classList.remove('animate-in');
  }, { once: true });
}

/** @returns {void} */
function showCalendar() {
  switchView(calendarView, 'calendar');
  if (calendarBtn) { calendarBtn.classList.add('active'); calendarBtn.setAttribute('aria-pressed', 'true'); }
  if (agendaBtn) { agendaBtn.classList.remove('active'); agendaBtn.setAttribute('aria-pressed', 'false'); }
  if (weeklyBtn) { weeklyBtn.classList.remove('active'); weeklyBtn.setAttribute('aria-pressed', 'false'); }
  renderCalendar();
}

/** @returns {void} */
function showAgenda() {
  switchView(agendaView, 'agenda');
  if (agendaBtn) { agendaBtn.classList.add('active'); agendaBtn.setAttribute('aria-pressed', 'true'); }
  if (calendarBtn) { calendarBtn.classList.remove('active'); calendarBtn.setAttribute('aria-pressed', 'false'); }
  if (weeklyBtn) { weeklyBtn.classList.remove('active'); weeklyBtn.setAttribute('aria-pressed', 'false'); }
  const monthFilterEl = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-filter'));
  const statusFilterEl = /** @type {HTMLSelectElement | null} */ (document.getElementById('status-filter'));
  const priorityFilterEl = /** @type {HTMLSelectElement | null} */ (document.getElementById('priority-filter'));
  renderAgenda(monthFilterEl?.value || 'all', statusFilterEl?.value || 'all', priorityFilterEl?.value || 'all');
}

/** @returns {void} */
function showWeekly() {
  switchView(weeklyView, 'weekly');
  if (weeklyBtn) { weeklyBtn.classList.add('active'); weeklyBtn.setAttribute('aria-pressed', 'true'); }
  if (calendarBtn) { calendarBtn.classList.remove('active'); calendarBtn.setAttribute('aria-pressed', 'false'); }
  if (agendaBtn) { agendaBtn.classList.remove('active'); agendaBtn.setAttribute('aria-pressed', 'false'); }
  renderWeekly();
}

/** @returns {void} */
function updateLoginButton() {
  loginBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('login-btn'));
  logoutBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('logout-btn'));
  userInfo = document.getElementById('user-info');
  userAvatar = /** @type {HTMLImageElement | null} */ (document.getElementById('user-avatar'));
  userName = document.getElementById('user-name');

  if (state.userSession && (state.userSession.jwt || state.userSession.token)) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) { userInfo.style.display = 'flex'; userInfo.classList.remove('hidden'); userInfo.classList.add('show'); }
    const user = state.userSession.user;
    if (user) {
      if (userAvatar) {
        if (user.avatar_url) { userAvatar.src = user.avatar_url; userAvatar.classList.remove('hidden'); }
        else { userAvatar.classList.add('hidden'); }
      }
      if (userName) userName.textContent = user.name || user.login || user.username || '';
    }
    if (logoutBtn) { logoutBtn.onclick = handleLogout; logoutBtn.style.display = 'inline-block'; }
    const userStatus = document.getElementById('user-status');
    if (userStatus && userInfo && !userStatus.querySelector('.online-indicator')) {
      const online = document.createElement('span'); online.className = 'online-indicator'; online.textContent = '●'; online.title = 'En línea'; userInfo.appendChild(online);
    }
  } else {
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userInfo) { userInfo.style.display = 'none'; userInfo.classList.add('hidden'); userInfo.classList.remove('show'); }
    const ind = document.querySelector('.online-indicator'); if (ind) ind.remove();
  }
}

/** @returns {void} */
function handleLogin() {
  const stateToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
  localStorage.setItem('oauth_state', stateToken);
  const url = new URL(GITHUB_AUTH_URL); url.searchParams.set('state', stateToken);
  window.location.href = url.toString();
}

/** @returns {void} */
function handleLogout() {
  setUserSession(null);
  setUserGistId(null);
  // Clear all tasks on logout - user data is private
  setTasks({});
  localStorage.removeItem('calendarTasks');
  updateLoginButton();
  showCalendar();
}

/** @param {string} token */
async function fetchUserInfo(token) {
  try {
    if (state.userSession && state.userSession.jwt) {
      const res = await fetch(API_BASE_URL + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + state.userSession.jwt } });
      if (!res.ok) throw new Error('Auth/me HTTP ' + res.status);
      const data = await res.json();
      setUserSession({ ...state.userSession, user: data.user });
    } else if (token) {
      const response = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${token}` } });
      if (!response.ok) throw new Error('GitHub user HTTP ' + response.status);
      const user = await response.json();
      setUserSession({ ...(state.userSession || {}), token, user, loginTime: Date.now() });
    }
    updateLoginButton();
  } catch (e) { console.error('fetchUserInfo error:', e); }
}

/** @returns {Promise<void>} */
async function handleOAuthCallback() {
  const search = window.location.search;
  const hash = window.location.hash;
  const params = new URLSearchParams(search);
  const authCode = params.get('code');

  if (authCode && !state.userSession) {
    const returnedState = params.get('state');
    const storedState = localStorage.getItem('oauth_state');
    if (storedState && returnedState && returnedState !== storedState) {
      showAuthStatus('Autenticación inválida. Intenta nuevamente.', true);
      return;
    }
    if (storedState) localStorage.removeItem('oauth_state');
    if (OAUTH_PROXY_URL) {
      showAuthStatus('Intercambiando código por token…');
      fetch(OAUTH_PROXY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ code: authCode, redirect_uri: GITHUB_REDIRECT_URI })
      }).then(async (res) => {
        if (!res.ok) throw new Error('Auth HTTP ' + res.status);
        return res.json();
      }).then(async (data) => {
        const jwtToken = data?.token || data?.jwt;
        if (!data || !data.success || !jwtToken || !data.user) throw new Error('Auth payload inválido');
        setUserSession({ jwt: jwtToken, user: data.user, loginTime: Date.now() });
        const cleanUrl = window.location.origin + window.location.pathname; window.history.replaceState({}, document.title, cleanUrl);
        updateLoginButton();
        showAuthStatus('Inicio de sesión exitoso');
        // Load tasks separately — retry up to 4 times with backoff to handle backend cold starts (503)
        (async () => {
          for (let attempt = 1; attempt <= 4; attempt++) {
            try {
              await loadTasksIntoState();
              notifyTasksUpdated();
              return;
            } catch (e) {
              if (attempt < 4) {
                await new Promise(r => setTimeout(r, 1500 * attempt));
              } else {
                console.error('loadTasksIntoState failed after retries:', e);
                showSyncStatus('No se pudieron cargar las tareas. Recarga la página.', true);
              }
            }
          }
        })();
      }).catch(err => {
        console.error('Code exchange failed:', err);
        showAuthStatus('Error al intercambiar el código (ver consola)', true);
      });
      return;
    }
  }

  if (hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      setUserSession({ token, loginTime: Date.now() });
      window.location.hash = ''; const newUrl = window.location.pathname + window.location.search; window.history.replaceState({}, document.title, newUrl);
      fetchUserInfo(token);
    }
  } else {
    const stored = localStorage.getItem('userSession');
    if (stored) {
      try {
        const sess = JSON.parse(stored); setUserSession(sess);
        updateLoginButton();
        if (sess && sess.user) {
          if (sess.jwt) {
            try {
              await loadTasksIntoState();
            } catch (e) {
              // JWT expired or malformed — clear stale session and prompt re-login
              console.warn('Stored JWT invalid, clearing session:', e);
              setUserSession(null);
              updateLoginButton();
              showAuthStatus('Sesión expirada. Por favor inicia sesión nuevamente.', true);
            }
          } else {
            await findExistingGist();
            await loadTasksFromGist();
            scheduleBackgroundSync();
          }
        } else if (sess && sess.token) {
          await fetchUserInfo(sess.token);
          await findExistingGist();
          await loadTasksFromGist();
          scheduleBackgroundSync();
        }
      } catch (e) { console.error('Error parsing stored session:', e); localStorage.removeItem('userSession'); }
    }
  }
}

// ===== Gist Sync (for GitHub-only mode) =====
/** @returns {Promise<void>} */
async function syncTasksToGist() {
  if (!state.userSession || !state.userSession.token) return;
  try {
    const gistData = {
      description: 'Calendar10 - Tasks Data', public: false,
      files: { 'calendar-tasks.json': { content: JSON.stringify(getTasks(), null, 2) } }
    };
    let response;
    if (state.userGistId) {
      response = await fetch(`https://api.github.com/gists/${state.userGistId}`, {
        method: 'PATCH', headers: { 'Authorization': `token ${state.userSession.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
        body: JSON.stringify(gistData)
      });
    } else {
      response = await fetch('https://api.github.com/gists', {
        method: 'POST', headers: { 'Authorization': `token ${state.userSession.token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' },
        body: JSON.stringify(gistData)
      });
    }
    if (response.ok) {
      const gist = await response.json();
      setUserGistId(gist.id);
      if (gist.updated_at) setLastGistUpdatedAt(gist.updated_at);
    } else { console.error('Failed to sync tasks to Gist:', response.status); }
  } catch (e) { console.error('Error syncing tasks to Gist:', e); }
}

/** @returns {Promise<boolean>} */
async function loadTasksFromGist() {
  if (!state.userSession || !state.userSession.token || !state.userGistId) return false;
  try {
    const response = await fetch(`https://api.github.com/gists/${state.userGistId}`, { headers: { 'Authorization': `token ${state.userSession.token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (response.ok) {
      const gist = await response.json();
      const tasksData = gist.files['calendar-tasks.json'];
      if (tasksData && tasksData.content) {
        const remoteTasks = JSON.parse(tasksData.content);
        // Merge by id per date: remote precedence
        const merged = mergeTasksById(getTasks(), remoteTasks);
        setTasks(merged);
        if (gist.updated_at) setLastGistUpdatedAt(gist.updated_at);
        return true;
      }
    }
  } catch (e) { console.error('Error loading tasks from Gist:', e); }
  return false;
}

/** @returns {Promise<void>} */
async function findExistingGist() {
  if (!state.userSession || !state.userSession.token || state.userGistId) return;
  try {
    const res = await fetch('https://api.github.com/gists?per_page=100', { headers: { 'Authorization': `token ${state.userSession.token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (!res.ok) return; const gists = await res.json();
    const match = (gists || []).find((/** @type {any} */ g) => g.files && g.files['calendar-tasks.json']);
    if (match && match.id) {
      setUserGistId(match.id);
      if (match.updated_at) setLastGistUpdatedAt(match.updated_at);
    }
  } catch (e) { console.error('Error discovering existing gist:', e); }
}

/** @param {TasksByDate} [localData={}] @param {TasksByDate} [remoteData={}] @returns {TasksByDate} */
function mergeTasksById(localData = {}, remoteData = {}) {
  const result = { ...localData };
  const allDates = new Set([...Object.keys(localData || {}), ...Object.keys(remoteData || {})]);
  allDates.forEach(date => {
    const l = (localData[date] || []); const r = (remoteData[date] || []);
    const byId = new Map(); l.forEach(t => byId.set(t.id, t)); r.forEach(t => byId.set(t.id, { ...byId.get(t.id), ...t }));
    const merged = Array.from(byId.values()); if (merged.length > 0) result[date] = merged; else if (result[date]) delete result[date];
  });
  return result;
}

/** @returns {void} */
function scheduleBackgroundSync() {
  if (state.backgroundSyncTimer) return;
  if (isLoggedInWithBackend()) return; // backend is source of truth
  if (!state.userSession || !state.userSession.token || !state.userGistId) return;
  state.backgroundSyncTimer = setInterval(checkAndPullGist, state.currentSyncIntervalMs);
}

/** @returns {Promise<void>} */
async function checkAndPullGist() {
  if (!state.userSession || !state.userSession.token || !state.userGistId) return;
  try {
    const res = await fetch(`https://api.github.com/gists/${state.userGistId}`, { headers: { 'Authorization': `token ${state.userSession.token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (!res.ok) { state.currentSyncIntervalMs = Math.min(state.maxSyncIntervalMs, state.currentSyncIntervalMs * 2); resetBackgroundTimer(); return; }
    const gist = await res.json(); const updated = gist.updated_at || null; if (!updated || updated === state.lastGistUpdatedAt) return;
    const tasksFile = gist.files && gist.files['calendar-tasks.json'];
    if (tasksFile && tasksFile.content) {
      const remoteTasks = JSON.parse(tasksFile.content);
      const merged = mergeTasksById(getTasks(), remoteTasks);
      if (JSON.stringify(getTasks()) !== JSON.stringify(merged)) { setTasks(merged); notifyTasksUpdated(); }
      setLastGistUpdatedAt(updated);
      if (state.currentSyncIntervalMs !== state.baseSyncIntervalMs) { state.currentSyncIntervalMs = state.baseSyncIntervalMs; resetBackgroundTimer(); }
    }
  } catch (e) {
    console.error('Background sync error:', e);
    state.currentSyncIntervalMs = Math.min(state.maxSyncIntervalMs, state.currentSyncIntervalMs * 2);
    resetBackgroundTimer();
  }
}

/** @returns {void} */
function resetBackgroundTimer() {
  if (state.backgroundSyncTimer) { clearInterval(state.backgroundSyncTimer); state.backgroundSyncTimer = null; }
  if (state.userSession && state.userSession.token && state.userGistId) {
    state.backgroundSyncTimer = setInterval(checkAndPullGist, state.currentSyncIntervalMs);
  }
}

// Notifications
/** @returns {void} */
function checkNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(); const currentTime = now.getTime();
  let notificationLog = JSON.parse(localStorage.getItem('notificationLog') || '{}');
  let hasNew = false;
  Object.entries(getTasks()).forEach(([date, list]) => {
    if (date === 'undated') return;
    (list || []).forEach(task => {
      if (task.completed || !task.isReminder) return;
      const dt = new Date(date + 'T00:00:00');
      if (task.time) { const [h, m] = task.time.split(':'); dt.setHours(parseInt(h), parseInt(m), 0, 0); }
      else { dt.setHours(9, 0, 0, 0); }
      const taskTime = dt.getTime(); const reminderStart = taskTime - (24 * 60 * 60 * 1000);
      if (currentTime >= reminderStart && currentTime <= taskTime) {
        const intervals = Math.floor((currentTime - reminderStart) / (60 * 60 * 1000));
        const key = `${task.id}_${intervals}`;
        if (!notificationLog[key]) {
          const timeUntil = Math.ceil((taskTime - currentTime) / (60 * 60 * 1000));
          const label = timeUntil > 0 ? `en ${timeUntil} hora${timeUntil !== 1 ? 's' : ''}` : 'ahora';
          new Notification('Recordatorio de Tarea', { body: `${task.title}\nFecha: ${date}${task.time ? ` - ${task.time}` : ''}\nProgramada ${label}`, icon: '/favicon.ico', tag: `reminder_${task.id}`, requireInteraction: true });
          notificationLog[key] = { taskId: task.id, sentAt: currentTime, interval: intervals, taskTitle: task.title };
          hasNew = true;
        }
      }
    });
  });
  const sevenDaysAgo = currentTime - (7 * 24 * 60 * 60 * 1000);
  Object.keys(notificationLog).forEach(k => { if (notificationLog[k].sentAt < sevenDaysAgo) { delete notificationLog[k]; hasNew = true; } });
  if (hasNew) localStorage.setItem('notificationLog', JSON.stringify(notificationLog));
}

/** @returns {void} */
function testNotification() {
  if (!('Notification' in window)) {
    showToast('Este navegador no soporta notificaciones.', { type: 'error' });
    return;
  }
  if (Notification.permission !== 'granted') {
    showToast('Permite las notificaciones para usar recordatorios.', { type: 'warning', duration: 4200 });
    Notification.requestPermission();
    return;
  }
  new Notification('Prueba de Notificaci\u00f3n', { body: 'El sistema de recordatorios est\u00e1 funcionando correctamente.\nFecha: ' + new Date().toLocaleString(), icon: '/favicon.ico', requireInteraction: true });
  showToast('Notificación de prueba enviada.', { type: 'success' });
}

/** @returns {void} */
function clearNotificationLog() { localStorage.removeItem('notificationLog'); }

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  calendarBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('calendar-btn'));
  agendaBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('agenda-btn'));
  loginBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('login-btn'));
  logoutBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('logout-btn'));
  userInfo = document.getElementById('user-info');
  userAvatar = /** @type {HTMLImageElement | null} */ (document.getElementById('user-avatar'));
  userName = document.getElementById('user-name');
  calendarView = document.getElementById('calendar-view');
  agendaView = document.getElementById('agenda-view');
  weeklyBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('weekly-btn'));
  weeklyView = document.getElementById('weekly-view');
  if (calendarBtn) calendarBtn.addEventListener('click', showCalendar);
  if (agendaBtn) agendaBtn.addEventListener('click', showAgenda);
  if (weeklyBtn) weeklyBtn.addEventListener('click', showWeekly);
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);

  window.addEventListener('online', () => {
    showSyncToast('Conexión restaurada.');
    if (isLoggedInWithBackend()) {
      showSyncToast('Sincronizando cambios...', false);
      pushLocalTasksToBackend()
        .then(() => loadTasksIntoState())
        .then(() => {
          showSyncToast('Sincronización completada.');
          notifyTasksUpdated();
        })
        .catch(err => {
          console.error('Auto-sync failed:', err);
          showSyncToast('Error al sincronizar.', true);
        });
    }
  });

  window.addEventListener('offline', () => {
    showToast('Sin conexión. Los cambios se guardarán localmente.', {
      type: 'warning',
      duration: 4200
    });
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (/** @type {MessageEvent} */ event) => {
      if (event.data?.type === 'sync-complete') {
        showSyncToast('Sincronización offline completada.');
      }
    });
  }

  // Initialize the application
  initCalendar();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      const today = new Date().toISOString().split('T')[0];
      showTaskInputModal(today);
    }
  });

  handleOAuthCallback().finally(hideAppLoading);
  updateLoginButton();
  showCalendar();
  setInterval(checkNotifications, 60000);

  // Re-render views when tasks change
  document.addEventListener('tasksUpdated', () => {
    if (calendarView && !calendarView.classList.contains('hidden')) renderCalendar();
    if (weeklyView && !weeklyView.classList.contains('hidden')) renderWeekly();
    if (agendaView && !agendaView.classList.contains('hidden')) {
      const monthFilter = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-filter'));
      const statusFilter = /** @type {HTMLSelectElement | null} */ (document.getElementById('status-filter'));
      const priorityFilter = /** @type {HTMLSelectElement | null} */ (document.getElementById('priority-filter'));
      renderAgenda(
        monthFilter?.value || state.filters.month || 'all',
        statusFilter?.value || state.filters.status || 'all',
        priorityFilter?.value || state.filters.priority || 'all'
      );
    }
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkAndPullGist(); });
});

// Expose for inline buttons in index.html/agenda
window.showPdfExportModal = showPdfExportModal;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.testNotification = testNotification;
