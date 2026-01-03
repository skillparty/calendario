// Calendar rendering and task creation/viewing for Calendar10
// Handles calendar grid, day modal, and task creation/editing modal
/**
 * @typedef {import('./types').Task} Task
 */

import { state, setCurrentDate, getTasks, updateTasks, formatDateLocal, notifyTasksUpdated } from './state.js';
import { isLoggedInWithBackend, createTaskOnBackend, updateTaskOnBackend, pushLocalTasksToBackend } from './api.js';

// Utilities
/** @param {number} month @returns {string} */
function getMonthName(month) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return months[month];
}

/** @param {Date} date @returns {boolean} */
function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/** @returns {void} */
export function renderCalendar() {
  const calendarView = document.getElementById('calendar-view');
  if (!calendarView) return;
  const currentDate = state.currentDate;
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextMonthYear = month === 11 ? year + 1 : year;

  let html = `
        <div class="calendar-navigation">
            <button id="prev-month" class="calendar-nav-btn calendar-nav-prev" title="Ir a ${getMonthName(prevMonth)} ${prevMonthYear}" aria-label="Mes anterior">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span class="nav-month-label">${getMonthName(prevMonth)}</span>
            </button>
            <div class="calendar-current-month">
                <h2 class="calendar-month-name">${getMonthName(month)}</h2>
                <span class="calendar-year">${year}</span>
            </div>
            <button id="next-month" class="calendar-nav-btn calendar-nav-next" title="Ir a ${getMonthName(nextMonth)} ${nextMonthYear}" aria-label="Mes siguiente">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span class="nav-month-label">${getMonthName(nextMonth)}</span>
            </button>
        </div>
        <div class="calendar-grid">
            <div class="day">Dom</div>
            <div class="day">Lun</div>
            <div class="day">Mar</div>
            <div class="day">Mié</div>
            <div class="day">Jue</div>
            <div class="day">Vie</div>
            <div class="day">Sáb</div>
    `;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let date = new Date(startDate); date <= lastDay; date.setDate(date.getDate() + 1)) {
    const dayClass = date.getMonth() === month ? 'day' : 'day other-month';
    const todayClass = isToday(date) ? ' today' : '';
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const isPastDate = dayStart < today;
    const pastClass = isPastDate ? ' past-date' : '';

    const dateKey = formatDateLocal(date);
    /** @type {Task[]} */
    const dayTasks = (getTasks()[dateKey] || []);
    const pendingTasks = dayTasks.filter(t => !t.completed).length;
    const completedTasks = dayTasks.filter(t => t.completed).length;
    const totalTasks = pendingTasks + completedTasks;

    let taskPreview = '';
    if (dayTasks.length > 0) {
      const sortedTasks = dayTasks
        .filter(t => !t.completed)
        .sort((a, b) => {
          if (!a.time && !b.time) return 0;
          if (!a.time) return 1;
          if (!b.time) return -1;
          return a.time.localeCompare(b.time);
        })
        .slice(0, 3);
      taskPreview = sortedTasks.map(task => {
        const timeStr = task.time ? `${task.time}` : '';
        const title = task.title.length > 20 ? task.title.substring(0, 20) + '...' : task.title;
        const priorityClass = task.priority === 1 ? 'high' : task.priority === 2 ? 'medium' : 'low';
        return `<div class="task-preview-item ${priorityClass}">
          ${timeStr ? `<span class="task-time">${timeStr}</span>` : ''}
          <span class="task-title">${title}</span>
        </div>`;
      }).join('');
    }

    const hasTasksClass = dayTasks.length > 0 ? ' has-tasks' : '';

    html += `<div class="${dayClass}${todayClass}${pastClass}${hasTasksClass}" data-date="${dateKey}">
            <div class="day-content">
                <div class="day-header">
                    <span class="day-number">${date.getDate()}</span>
                    ${!isPastDate ? `<button class="day-add-btn" data-date="${dateKey}" title="Agregar tarea">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </button>` : ''}
                </div>
                ${totalTasks > 0 ? `
                    <div class="task-info">
                        <span class="task-badge pending">${pendingTasks}</span>
                        ${completedTasks > 0 ? `<span class="task-badge completed">${completedTasks}</span>` : ''}
                    </div>
                ` : ''}
                ${taskPreview ? `<div class="task-preview-list">${taskPreview}</div>` : ''}
            </div>
        </div>`;
  }
  html += '</div>';
  calendarView.innerHTML = html;

  const prev = document.getElementById('prev-month');
  const next = document.getElementById('next-month');
  if (prev) prev.addEventListener('click', () => { setCurrentDate(new Date(year, month - 1, 1)); renderCalendar(); });
  if (next) next.addEventListener('click', () => { setCurrentDate(new Date(year, month + 1, 1)); renderCalendar(); });
}

/** @returns {void} */
export function initCalendar() {
  // Event delegation for calendar interactions
  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.day-add-btn');
    if (addBtn) {
      e.stopPropagation();
      const date = addBtn.dataset.date;
      if (date) {
        const selectedDate = new Date(date + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          alert('No puedes agregar tareas a fechas pasadas. Por favor selecciona la fecha actual o una fecha futura.');
          return;
        }
        addTask(date);
      }
      return;
    }

    const dayContent = e.target.closest('.day-content');
    if (dayContent && !e.target.closest('.day-add-btn')) {
      const day = dayContent.closest('.day:not(.other-month)');
      const calendarView = document.getElementById('calendar-view');
      if (day && day.dataset.date && calendarView && !calendarView.classList.contains('hidden')) {
        e.stopPropagation();
        showDayTasks(day.dataset.date);
      }
    }
  });
}

/** @param {string} date */
export function addTask(date) {
  showTaskInputModal(date);
}

/** @param {string} message @param {boolean} [isError=false] */
function showSyncStatus(message, isError = false) {
  let el = document.getElementById('sync-status-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sync-status-banner';
    el.style.position = 'fixed';
    el.style.bottom = '16px';
    el.style.left = '16px';
    el.style.padding = '6px 12px';
    el.style.fontSize = '12px';
    el.style.fontFamily = 'JetBrains Mono, monospace';
    el.style.borderRadius = '8px';
    el.style.zIndex = '99999';
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15)';
    el.style.maxWidth = '60vw';
    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'hidden';
    el.style.textOverflow = 'ellipsis';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.background = isError ? '#d1495b' : '#829399';
  el.style.color = '#fff';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { if (el && el.parentNode) el.parentNode.removeChild(el); }, isError ? 5000 : 2200);
}

/** @param {string|null} [date=null] @param {Task|null} [existingTask=null] */
export function showTaskInputModal(date = null, existingTask = null) {
  // Remove any existing task input modals first
  const existingModals = document.querySelectorAll('.modal');
  existingModals.forEach(m => {
    if (m.querySelector('#task-title-input')) {
      m.remove();
    }
  });

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('data-modal-type', 'task-input');
  modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn" onclick="this.parentElement.parentElement.remove()">&times;</span>
            <h3>${existingTask ? 'Editar Tarea' : (date ? 'Nueva Tarea' : 'Nueva Tarea Rápida')}</h3>
            <div style="margin: 15px 0;">
                <label for="task-title-input">Título:</label>
                <input type="text" id="task-title-input" placeholder="Ingrese el título de la tarea" 
                       value="${existingTask ? existingTask.title : ''}" 
                       style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            ${!date ? `
            <div style="margin: 15px 0;">
                <label for="task-date-input">Fecha (opcional):</label>
                <input type="date" id="task-date-input" 
                       value="${existingTask && existingTask.date ? existingTask.date : ''}"
                       style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            ` : ''}
            <div style="margin: 15px 0;">
                <label for="task-time-input">Hora (opcional):</label>
                <input type="time" id="task-time-input" 
                       value="${existingTask && existingTask.time ? existingTask.time : ''}"
                       style="width: 100%; padding: 8px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div style="margin: 15px 0;">
                <label>
                    <input type="checkbox" id="task-reminder-input" ${existingTask ? (existingTask.isReminder ? 'checked' : '') : 'checked'}>
                    Es un recordatorio
                </label>
            </div>
            <div style="text-align: right; margin-top: 20px;">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                        style="background: #f44336; color: white; border: none; padding: 8px 16px; margin-right: 8px; cursor: pointer; border-radius: 4px;">
                    Cancelar
                </button>
                <button onclick="saveTaskFromModal('${date || ''}', ${existingTask ? `'${existingTask.id}'` : 'null'})" 
                        style="background: #4CAF50; color: white; border: none; padding: 8px 16px; cursor: pointer; border-radius: 4px;">
                    ${existingTask ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);
  
  // Prevent multiple modal opens
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  const titleInput = document.getElementById('task-title-input');
  if (titleInput) titleInput.focus();
}

/** @param {string} dateString @returns {string} */
function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
}

/** @param {string} date */
export function showDayTasks(date) {
  const modal = document.getElementById('day-modal');
  const modalDate = document.getElementById('modal-date');
  const modalTasks = document.getElementById('modal-tasks');
  const addTaskBtn = document.getElementById('add-task-modal-btn');
  if (!modal || !modalDate || !modalTasks || !addTaskBtn) return;

  const selectedDate = new Date(date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastDate = selectedDate < today;

  modalDate.textContent = formatDateForDisplay(date);
  modalTasks.innerHTML = '';

  const dayTasks = getTasks()[date] || [];
  if (dayTasks.length === 0) {
    modalTasks.innerHTML = isPastDate
      ? '<p style="color: var(--text-muted); font-style: italic;">No se agregaron tareas para esta fecha.</p>'
      : '<p>No hay tareas para este día.</p>';
  } else {
    dayTasks.forEach(task => {
      const div = document.createElement('div');
      div.className = `modal-task ${task.completed ? 'completed' : 'pending'}`;
      div.innerHTML = `
                <div class="task-content">
                    <strong>${task.title}</strong>
                    ${task.time ? `<small style="color: var(--text-secondary);">⏰ ${task.time}</small>` : ''}
                    <div class="task-actions">
                        <button onclick="toggleTask('${task.id}'); setTimeout(() => showDayTasks('${date}'), 100)">
                            ${task.completed ? 'Desmarcar' : 'Marcar como hecho'}
                        </button>
                        ${!isPastDate ? `<button onclick="deleteTask('${task.id}')" class="delete-btn">🗑️ Eliminar</button>` : ''}
                    </div>
                </div>
            `;
      modalTasks.appendChild(div);
    });
  }

  addTaskBtn.style.display = isPastDate ? 'none' : 'block';
  if (!isPastDate) addTaskBtn.onclick = () => addTask(date);

  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  const closeBtn = modal.querySelector('.close-btn');
  const closeModal = () => {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    document.removeEventListener('keydown', onEsc);
  };
  const onEsc = (e) => { if (e.key === 'Escape') closeModal(); };
  if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); closeModal(); };
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  document.addEventListener('keydown', onEsc);
}

/** @param {string} originalDate @param {string|null} existingTaskId */
export function saveTaskFromModal(originalDate, existingTaskId) {
  const titleInput = document.getElementById('task-title-input');
  const dateInput = document.getElementById('task-date-input');
  const timeInput = document.getElementById('task-time-input');
  const reminderInput = document.getElementById('task-reminder-input');

  if (!titleInput || !titleInput.value || !titleInput.value.trim()) {
    alert('Por favor ingrese un título para la tarea');
    return;
  }
  const title = titleInput.value.trim();

  let taskDate = null;
  if (dateInput && dateInput.value && dateInput.value.trim() !== '') {
    taskDate = dateInput.value;
  } else if (originalDate && originalDate.trim() !== '') {
    taskDate = originalDate;
  }
  if (taskDate === '') taskDate = null;

  const time = timeInput.value || null;
  const isReminder = !!(reminderInput && reminderInput.checked);

  if (!existingTaskId && taskDate) {
    const selectedDate = new Date(taskDate + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      alert('No puedes agregar tareas a fechas pasadas. Por favor selecciona la fecha actual o una fecha futura.');
      return;
    }
  }

  if (existingTaskId) {
    // Update existing task in state
    updateTasks(draft => {
      let moved = null;
      Object.keys(draft).forEach(date => {
        const idx = (draft[date] || []).findIndex(t => t.id === existingTaskId);
        if (idx !== -1) {
          const task = draft[date][idx];
          task.title = title; task.time = time; task.isReminder = isReminder;
          if (taskDate !== date) {
            draft[date].splice(idx, 1);
            if (draft[date].length === 0 && date !== 'undated') delete draft[date];
            task.date = taskDate;
            const targetKey = taskDate || 'undated';
            if (!draft[targetKey]) draft[targetKey] = [];
            draft[targetKey].push(task);
          }
          moved = true;
        }
      });
    });

    // Close modal immediately after local update (before backend sync)
    const modals = document.querySelectorAll('.modal');
    modals.forEach(m => m.remove());
    notifyTasksUpdated();

    // Backend update if logged in (async, doesn't block UI)
    if (isLoggedInWithBackend()) {
      const serverId = /^\d+$/.test(existingTaskId) ? existingTaskId : null;
      if (serverId) {
        updateTaskOnBackend(serverId, {
          title,
          date: (taskDate && taskDate !== 'undated' && taskDate !== '') ? taskDate : null,
          time: (time && time.trim && time.trim() !== '') ? time.trim() : null,
          is_reminder: isReminder
        }).then(() => showSyncStatus('Actualizado ✅'))
          .catch(() => showSyncStatus('Actualizado localmente (sin conexión)', true));
      } else {
        pushLocalTasksToBackend();
      }
    }
    return;
  }

  // Create new task
  const task = {
    id: Date.now().toString(),
    title,
    completed: false,
    isReminder
  };

  // Only add date if it's valid
  if (taskDate && taskDate.trim() !== '') {
    task.date = taskDate;
    
    // Only add time if date is present
    if (time && time.trim() !== '') {
      task.time = time;
    }
  }

  updateTasks(draft => {
    const key = taskDate ? taskDate : 'undated';
    if (!draft[key]) draft[key] = [];
    draft[key].push(task);
  });

  // Close modal immediately after local save (before backend sync)
  const modals = document.querySelectorAll('.modal');
  modals.forEach(m => m.remove());
  notifyTasksUpdated();

  // Backend sync if logged in (async, doesn't block UI)
  console.log('=== TASK CREATION DEBUG ===');
  console.log('taskDate:', taskDate);
  console.log('Final task object:', task);
  console.log('Task has date field:', 'date' in task);
  console.log('Checking backend login status:', isLoggedInWithBackend());
  if (isLoggedInWithBackend()) {
    console.log('Creating task on backend:', task);
    console.log('User session:', state.userSession);
    createTaskOnBackend(task)
      .then(() => {
        console.log('Task created successfully on backend');
        showSyncStatus('Guardado ✅');
      })
      .catch(async (err) => {
        console.error('Create task failed:', err);
        showSyncStatus('Guardado localmente (sin conexión)', true);
      });
  } else {
    console.log('Not logged in with backend - saving locally only');
  }

  if (isReminder && 'Notification' in window) {
    if (Notification.permission === 'default') Notification.requestPermission();
  }
}

// Expose globals for inline HTML handlers (browser only)
if (typeof window !== 'undefined') {
  window.showTaskInputModal = showTaskInputModal;
  window.saveTaskFromModal = saveTaskFromModal;
  window.showDayTasks = showDayTasks;
  window.addTask = addTask;
}
