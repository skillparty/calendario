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
import { showPdfExportModal } from './pdf.js';

// GitHub OAuth constants
const GITHUB_CLIENT_ID = 'Ov23liO2tcNCvR8xrHov';
const GITHUB_REDIRECT_URI = 'https://calendario-frontend-ashy.vercel.app';
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

/** @param {string} message @param {boolean} [isError=false] */
function showAuthStatus(message, isError = false) {
  let el = document.getElementById('auth-status-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'auth-status-banner';
    Object.assign(el.style, {
      position: 'fixed', top: '0', left: '50%', transform: 'translateX(-50%)', padding: '6px 14px',
      fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', borderRadius: '0 0 8px 8px', zIndex: 99999,
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
    });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.background = isError ? '#d1495b' : '#545f66';
  el.style.color = '#fff';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, isError ? 6000 : 3500);
}

/** @param {string} message @param {boolean} [isError=false] */
function showSyncStatus(message, isError = false) {
  let el = document.getElementById('sync-status-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sync-status-banner';
    Object.assign(el.style, {
      position: 'fixed', bottom: '16px', left: '16px', padding: '6px 12px', fontSize: '12px',
      fontFamily: 'JetBrains Mono, monospace', borderRadius: '8px', zIndex: 99999, boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      maxWidth: '60vw', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
    });
    document.body.appendChild(el);
  }
  el.textContent = message; el.style.background = isError ? '#d1495b' : '#829399'; el.style.color = '#fff';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, isError ? 5000 : 2200);
}

/** @returns {void} */
function showCalendar() {
  document.body.setAttribute('data-current-view', 'calendar');
  if (calendarView) calendarView.classList.remove('hidden');
  if (agendaView) agendaView.classList.add('hidden');
  if (calendarBtn) { calendarBtn.classList.add('active'); calendarBtn.setAttribute('aria-pressed', 'true'); }
  if (agendaBtn) { agendaBtn.classList.remove('active'); agendaBtn.setAttribute('aria-pressed', 'false'); }
  renderCalendar();
}

/** @returns {void} */
function showAgenda() {
  document.body.setAttribute('data-current-view', 'agenda');
  // FORCE AGENDA VIEW TO ALWAYS BE VISIBLE
  if (agendaView) {
    agendaView.classList.remove('hidden');
    agendaView.style.display = 'block';
    agendaView.style.visibility = 'visible';
    agendaView.style.opacity = '1';
  }
  if (calendarView) calendarView.classList.add('hidden');
  if (agendaBtn) { agendaBtn.classList.add('active'); agendaBtn.setAttribute('aria-pressed', 'true'); }
  if (calendarBtn) { calendarBtn.classList.remove('active'); calendarBtn.setAttribute('aria-pressed', 'false'); }
  const monthFilterEl = document.getElementById('month-filter');
  const statusFilterEl = document.getElementById('status-filter');
  renderAgenda(monthFilterEl?.value || 'all', statusFilterEl?.value || 'all');
}

/** @returns {void} */
function updateLoginButton() {
  loginBtn = document.getElementById('login-btn');
  logoutBtn = document.getElementById('logout-btn');
  userInfo = document.getElementById('user-info');
  userAvatar = document.getElementById('user-avatar');
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
    if (userStatus && !userStatus.querySelector('.online-indicator')) {
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
        if (!data || !data.success || !data.token || !data.user) throw new Error('Auth payload inválido');
        setUserSession({ jwt: data.token, user: data.user, loginTime: Date.now() });
        const cleanUrl = window.location.origin + window.location.pathname; window.history.replaceState({}, document.title, cleanUrl);
        updateLoginButton();
        await loadTasksIntoState();
        showAuthStatus('Inicio de sesión exitoso');
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
            await loadTasksIntoState();
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
      description: 'Calendario Digital - Tasks Data', public: false,
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
    const match = (gists || []).find(g => g.files && g.files['calendar-tasks.json']);
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
          new Notification('🔔 Recordatorio de Tarea', { body: `${task.title}\n📅 ${date}${task.time ? ` ⏰ ${task.time}` : ''}\n⏳ Programada ${label}`, icon: '/favicon.ico', tag: `reminder_${task.id}`, requireInteraction: true });
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
  if (!('Notification' in window)) { alert('Este navegador no soporta notificaciones'); return; }
  if (Notification.permission !== 'granted') { alert('Por favor, permite las notificaciones primero'); Notification.requestPermission(); return; }
  new Notification('🧪 Prueba de Notificación', { body: 'El sistema de recordatorios está funcionando correctamente.\n📅 Fecha: ' + new Date().toLocaleString(), icon: '/favicon.ico', requireInteraction: true });
}

/** @returns {void} */
function clearNotificationLog() { localStorage.removeItem('notificationLog'); }

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  calendarBtn = document.getElementById('calendar-btn');
  agendaBtn = document.getElementById('agenda-btn');
  loginBtn = document.getElementById('login-btn');
  logoutBtn = document.getElementById('logout-btn');
  userInfo = document.getElementById('user-info');
  userAvatar = document.getElementById('user-avatar');
  userName = document.getElementById('user-name');
  calendarView = document.getElementById('calendar-view');
  agendaView = document.getElementById('agenda-view');
  if (calendarBtn) calendarBtn.addEventListener('click', showCalendar);
  if (agendaBtn) agendaBtn.addEventListener('click', showAgenda);
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);

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

  handleOAuthCallback();
  updateLoginButton();
  showCalendar();
  setInterval(checkNotifications, 60000);

  // Re-render views when tasks change
  document.addEventListener('tasksUpdated', () => {
    if (calendarView && !calendarView.classList.contains('hidden')) renderCalendar();
    if (agendaView && !agendaView.classList.contains('hidden')) {
      const m = (document.getElementById('month-filter') || {}).value || 'all';
      const s = (document.getElementById('status-filter') || {}).value || 'all';
      renderAgenda(m, s);
    }
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkAndPullGist(); });
});

// Expose for inline buttons in index.html/agenda
window.showPdfExportModal = showPdfExportModal;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.testNotification = testNotification;
