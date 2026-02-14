// Weekly view with time slots for Calendar10
/**
 * @typedef {import('./types').Task} Task
 */

import { state, getTasks, formatDateLocal } from './state.js';
import { showTaskInputModal } from './calendar.js';
import { escapeHtml } from './utils/helpers.js';
import { icons } from './icons.js';

const HOURS_START = 6;
const HOURS_END = 22;
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** @type {Date} */
let weekStart = getWeekStart(new Date());

/** @param {Date} date @returns {Date} */
function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

/** @param {number} hour @returns {string} */
function formatHour(hour) {
  const h = hour % 12 || 12;
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${h} ${suffix}`;
}

/** @param {Date} date @returns {boolean} */
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/** @returns {void} */
export function renderWeekly() {
  const container = document.getElementById('weekly-view');
  if (!container) return;

  const tasks = getTasks();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Header with week navigation
  const weekEnd = new Date(days[6]);
  const monthLabel = days[0].getMonth() === days[6].getMonth()
    ? days[0].toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : `${days[0].toLocaleDateString('es-ES', { month: 'short' })} – ${days[6].toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`;

  let html = `
    <div class="weekly-nav">
      <button id="prev-week" class="weekly-nav-btn" title="Semana anterior">&larr;</button>
      <h2 class="weekly-title">${monthLabel}</h2>
      <button id="today-week" class="weekly-today-btn" title="Ir a hoy">Hoy</button>
      <button id="next-week" class="weekly-nav-btn" title="Semana siguiente">&rarr;</button>
    </div>
    <div class="weekly-grid">
      <div class="weekly-corner"></div>
  `;

  // Day column headers
  days.forEach(d => {
    const dateKey = formatDateLocal(d);
    const todayClass = isToday(d) ? ' weekly-day-today' : '';
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const isPast = dayStart < today;
    html += `
      <div class="weekly-day-header${todayClass}" data-date="${dateKey}">
        <span class="weekly-day-name">${DAY_NAMES[d.getDay()]}</span>
        <span class="weekly-day-number">${d.getDate()}</span>
      </div>
    `;
  });

  // Time slots
  for (let hour = HOURS_START; hour <= HOURS_END; hour++) {
    const hourStr = String(hour).padStart(2, '0');

    // Time label
    html += `<div class="weekly-time-label">${formatHour(hour)}</div>`;

    // Day cells for this hour
    days.forEach(d => {
      const dateKey = formatDateLocal(d);
      const dayTasks = tasks[dateKey] || [];
      const hourTasks = dayTasks.filter(t => {
        if (!t.time) return false;
        const taskHour = parseInt(t.time.split(':')[0], 10);
        return taskHour === hour;
      });

      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const isPast = dayStart < today;
      const cellClass = isPast ? 'weekly-cell weekly-cell-past' : 'weekly-cell';

      html += `<div class="${cellClass}" data-date="${dateKey}" data-hour="${hourStr}">`;
      hourTasks.forEach(task => {
        const completedClass = task.completed ? ' weekly-task-completed' : '';
        const priorityClass = task.priority === 1 ? 'high' : task.priority === 2 ? 'medium' : 'low';
        html += `
          <div class="weekly-task${completedClass} weekly-task-${priorityClass}" data-task-id="${task.id}" title="${escapeHtml(task.title)}">
            <span class="weekly-task-time">${task.time}</span>
            <span class="weekly-task-title">${escapeHtml(task.title.length > 18 ? task.title.substring(0, 18) + '…' : task.title)}</span>
          </div>
        `;
      });
      html += `</div>`;
    });
  }

  // All-day / no-time tasks row
  html += `<div class="weekly-time-label weekly-allday-label">Todo el día</div>`;
  days.forEach(d => {
    const dateKey = formatDateLocal(d);
    const dayTasks = (tasks[dateKey] || []).filter(t => !t.time);
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const isPast = dayStart < today;
    const cellClass = isPast ? 'weekly-cell weekly-allday weekly-cell-past' : 'weekly-cell weekly-allday';

    html += `<div class="${cellClass}" data-date="${dateKey}" data-hour="allday">`;
    dayTasks.forEach(task => {
      const completedClass = task.completed ? ' weekly-task-completed' : '';
      const priorityClass = task.priority === 1 ? 'high' : task.priority === 2 ? 'medium' : 'low';
      html += `
        <div class="weekly-task${completedClass} weekly-task-${priorityClass}" data-task-id="${task.id}" title="${escapeHtml(task.title)}">
          <span class="weekly-task-title">${escapeHtml(task.title.length > 18 ? task.title.substring(0, 18) + '…' : task.title)}</span>
        </div>
      `;
    });
    html += `</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Navigation
  const prevBtn = document.getElementById('prev-week');
  const nextBtn = document.getElementById('next-week');
  const todayBtn = document.getElementById('today-week');

  if (prevBtn) prevBtn.addEventListener('click', () => {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() - 7);
    renderWeekly();
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
    renderWeekly();
  });
  if (todayBtn) todayBtn.addEventListener('click', () => {
    weekStart = getWeekStart(new Date());
    renderWeekly();
  });

  // Click on empty cell to add task
  container.querySelectorAll('.weekly-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (target.closest('.weekly-task')) return;
      const el = /** @type {HTMLElement} */ (cell);
      const date = el.dataset.date;
      const hour = el.dataset.hour;
      if (!date) return;
      const dayStart = new Date(date + 'T00:00:00');
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      if (dayStart < todayStart) return;
      showTaskInputModal(date);
    });
  });

  // Click on task to edit
  container.querySelectorAll('.weekly-task').forEach(taskEl => {
    taskEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = /** @type {HTMLElement} */ (taskEl);
      const taskId = el.dataset.taskId;
      if (!taskId) return;
      const allTasks = getTasks();
      for (const [dateKey, list] of Object.entries(allTasks)) {
        const task = list.find(t => t.id === taskId);
        if (task) {
          showTaskInputModal(task.date, task);
          return;
        }
      }
    });
  });
}
