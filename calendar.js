// Calendar rendering and task creation/viewing for Calendar10
// Handles calendar grid, day modal, and task creation/editing modal
/**
 * @typedef {import('./types').Task} Task
 */

import { state, setCurrentDate, getTasks, updateTasks, formatDateLocal, notifyTasksUpdated } from './state.js';
import { isLoggedInWithBackend, createTaskOnBackend, updateTaskOnBackend, pushLocalTasksToBackend } from './api.js';
import { showSyncToast, showToast } from './utils/UIFeedback.js';
import { openModal, closeModal } from './utils/modal.js';
import { icons } from './icons.js';
import { escapeHtml } from './utils/helpers.js';

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

/** @returns {string} */
function createLocalTaskId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {{ id?: string|number; serverId?: number } | null | undefined} task
 * @returns {number | null}
 */
function getServerTaskId(task) {
  if (!task) return null;
  if (typeof task.serverId === 'number') return task.serverId;
  if (typeof task.id === 'number') return task.id;
  if (typeof task.id === 'string' && /^\d+$/.test(task.id)) return parseInt(task.id, 10);
  return null;
}

/**
 * @param {string} id
 * @returns {Task | null}
 */
function findTaskById(id) {
  const all = Object.values(getTasks());
  for (const list of all) {
    const task = (list || []).find((t) => String(t.id) === String(id));
    if (task) return task;
  }
  return null;
}

/** @returns {void} */
function closeTaskInputModal() {
  const modal = document.querySelector('.modal[data-modal-type="task-input"]');
  if (modal instanceof HTMLElement) {
    closeModal(modal, { removeFromDom: true });
  }
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

  let html = `
        <div class="calendar-nav">
            <button id="prev-month" title="Mes anterior">
                ← ${getMonthName(month === 0 ? 11 : month - 1)}
            </button>
            <h2>${getMonthName(month)} ${year}</h2>
            <button id="next-month" title="Mes siguiente">
                ${getMonthName(month === 11 ? 0 : month + 1)} →
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
        .slice(0, 2);
      const previewItems = sortedTasks.map(task => {
        const title = task.title.length > 15 ? task.title.substring(0, 15) + '...' : task.title;
        return `<div class="task-preview-item"><span class="task-time">${task.time || ''}</span><span class="task-title">${escapeHtml(title)}</span></div>`;
      }).join('');
      taskPreview = `<div class="task-preview-list">${previewItems}</div>`;
    }

    html += `<div class="${dayClass}${todayClass}${pastClass}" data-date="${dateKey}">
            <div class="day-content">
                <span class="day-number">${date.getDate()}</span>
                ${totalTasks > 0 ? `<small class="task-count">${pendingTasks} pendiente(s)</small>` : ''}
                ${taskPreview}
                ${!isPastDate ? `<button class="day-add-btn" data-date="${dateKey}" title="Agregar recordatorio">+</button>` : ''}
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
    const target = /** @type {HTMLElement} */ (e.target);
    const addBtn = target?.closest('.day-add-btn');
    if (addBtn) {
      e.stopPropagation();
      const date = /** @type {HTMLElement} */ (addBtn).dataset.date;
      if (date) {
        const selectedDate = new Date(date + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          showToast('No puedes agregar tareas a fechas pasadas.', {
            type: 'warning',
            duration: 3800
          });
          return;
        }
        addTask(date);
      }
      return;
    }

    const dayContent = target?.closest('.day-content');
    if (dayContent && !target?.closest('.day-add-btn')) {
      const day = /** @type {HTMLElement | null} */ (dayContent.closest('.day:not(.other-month)'));
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
  showSyncToast(message, isError);
}

/** @param {string|null} [date=null] @param {Task|null} [existingTask=null] */
export function showTaskInputModal(date = null, existingTask = null) {
  // Remove any existing task input modal first
  closeTaskInputModal();

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('data-modal-type', 'task-input');
  modal.setAttribute('aria-hidden', 'true');
  const existingPriority = existingTask && existingTask.priority != null ? existingTask.priority : 3;
  modal.innerHTML = `
        <div class="modal-content task-input-modal-content" role="dialog" aria-modal="true" aria-labelledby="task-input-modal-title">
            <button type="button" class="close-btn" data-action="close-task-modal" aria-label="Cerrar modal">&times;</button>
            <h3 id="task-input-modal-title">${existingTask ? 'Editar Tarea' : (date ? 'Nueva Tarea' : 'Nueva Tarea Rápida')}</h3>
            <div class="task-input-form-group">
                <label for="task-title-input">Título</label>
                <input type="text" id="task-title-input" placeholder="Nombre de la tarea" 
                       value="${existingTask ? escapeHtml(existingTask.title) : ''}" 
                       class="task-input-control">
            </div>
            <div class="task-input-form-group">
                <label for="task-description-input">Descripción (opcional)</label>
                <textarea id="task-description-input" placeholder="Agrega detalles..." 
                       rows="2" class="task-input-control">${existingTask && existingTask.description ? escapeHtml(existingTask.description) : ''}</textarea>
            </div>
            <div class="task-input-row">
                ${!date ? `
                <div class="task-input-form-group">
                    <label for="task-date-input">Fecha</label>
                    <input type="date" id="task-date-input" 
                           value="${existingTask && existingTask.date ? existingTask.date : ''}"
                           class="task-input-control">
                </div>
                ` : ''}
                <div class="task-input-form-group">
                    <label for="task-time-input">Hora</label>
                    <input type="time" id="task-time-input" 
                           value="${existingTask && existingTask.time ? existingTask.time : ''}"
                           class="task-input-control">
                </div>
            </div>
            <div class="task-input-form-group">
                <label>Prioridad</label>
                <div class="priority-selector" role="radiogroup" aria-label="Prioridad de la tarea">
                    <button type="button" class="priority-option${existingPriority === 1 ? ' selected' : ''}" data-priority="1" aria-pressed="${existingPriority === 1}">
                        <span class="priority-dot high"></span> Alta
                    </button>
                    <button type="button" class="priority-option${existingPriority === 2 ? ' selected' : ''}" data-priority="2" aria-pressed="${existingPriority === 2}">
                        <span class="priority-dot medium"></span> Media
                    </button>
                    <button type="button" class="priority-option${existingPriority === 3 ? ' selected' : ''}" data-priority="3" aria-pressed="${existingPriority === 3}">
                        <span class="priority-dot low"></span> Baja
                    </button>
                </div>
            </div>
            <div class="task-input-form-group task-input-checkbox">
                <label>
                    <input type="checkbox" id="task-reminder-input" ${existingTask ? (existingTask.isReminder ? 'checked' : '') : 'checked'}>
                    <span>${icons.bell}</span>
                    <span>Recordatorio</span>
                </label>
            </div>
            <div class="task-input-actions">
                <button type="button" data-action="close-task-modal" class="task-input-cancel-btn">
                    Cancelar
                </button>
                <button type="button" data-action="save-task-modal" class="task-input-save-btn">
                    ${existingTask ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    `;
  document.body.appendChild(modal);

  modal.querySelectorAll('[data-action="close-task-modal"]').forEach((button) => {
    button.addEventListener('click', () => closeModal(modal, { removeFromDom: true }));
  });

  // Priority selector interaction
  modal.querySelectorAll('.priority-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.priority-option').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
    });
  });

  const saveButton = modal.querySelector('[data-action="save-task-modal"]');
  if (saveButton) {
    saveButton.addEventListener('click', () => saveTaskFromModal(date || '', existingTask ? String(existingTask.id) : null));
  }

  const titleInput = modal.querySelector('#task-title-input');
  if (titleInput) {
    titleInput.addEventListener('keydown', (event) => {
      if (/** @type {KeyboardEvent} */ (event).key === 'Enter') {
        event.preventDefault();
        saveTaskFromModal(date || '', existingTask ? String(existingTask.id) : null);
      }
    });
  }

  openModal(modal, {
    initialFocusSelector: '#task-title-input',
    removeOnClose: true
  });
}

/** @param {string} dateString @returns {string} */
function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  /** @type {Intl.DateTimeFormatOptions} */
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
      ? '<p class="modal-empty-muted">No se agregaron tareas para esta fecha.</p>'
      : '<p>No hay tareas para este día.</p>';
  } else {
    dayTasks.forEach(task => {
      const div = document.createElement('div');
      div.className = `modal-task ${task.completed ? 'completed' : 'pending'}`;
      div.innerHTML = `
                <div class="task-content">
                    <strong>${escapeHtml(task.title)}</strong>
                    ${task.time ? `<small class="modal-task-time"><span class="icon" aria-hidden="true">${icons.clock}</span> ${escapeHtml(task.time)}</small>` : ''}
                    <div class="task-actions">
                        <button type="button" data-action="toggle-task" data-task-id="${task.id}" data-date="${date}">
                            ${task.completed ? 'Desmarcar' : 'Marcar como hecho'}
                        </button>
                        ${!isPastDate ? `<button type="button" data-action="delete-task" data-task-id="${task.id}" class="delete-btn"><span class="icon" aria-hidden="true">${icons.trash}</span> Eliminar</button>` : ''}
                    </div>
                </div>
            `;
      modalTasks.appendChild(div);
    });
  }

  modalTasks.onclick = (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest('button[data-action]') : null;
    if (!(target instanceof HTMLElement)) return;

    const taskId = target.dataset.taskId;
    if (!taskId) return;

    if (target.dataset.action === 'toggle-task') {
      if (typeof window.toggleTask === 'function') {
        window.toggleTask(taskId);
        setTimeout(() => showDayTasks(date), 100);
      }
    }

    if (target.dataset.action === 'delete-task') {
      if (typeof window.deleteTask === 'function') {
        window.deleteTask(taskId);
        showDayTasks(date);
      }
    }
  };

  addTaskBtn.style.display = isPastDate ? 'none' : 'block';
  if (!isPastDate) addTaskBtn.onclick = () => addTask(date);

  const closeBtn = /** @type {HTMLElement | null} */ (modal.querySelector('.close-btn'));
  if (closeBtn) {
    closeBtn.onclick = (/** @type {MouseEvent} */ event) => {
      event.stopPropagation();
      closeModal(modal);
    };
  }

  openModal(modal, {
    initialFocusSelector: isPastDate ? '.close-btn' : '#add-task-modal-btn'
  });
}

/** @param {string} originalDate @param {string|null} existingTaskId */
export function saveTaskFromModal(originalDate, existingTaskId) {
  const titleInput = document.getElementById('task-title-input');
  const dateInput = document.getElementById('task-date-input');
  const timeInput = document.getElementById('task-time-input');
  const reminderInput = document.getElementById('task-reminder-input');

  const descriptionInput = document.getElementById('task-description-input');
  const prioritySelected = document.querySelector('.priority-option.selected');

  const titleEl = /** @type {HTMLInputElement | null} */ (titleInput);
  const dateEl = /** @type {HTMLInputElement | null} */ (dateInput);
  const timeEl = /** @type {HTMLInputElement | null} */ (timeInput);
  const reminderEl = /** @type {HTMLInputElement | null} */ (reminderInput);
  const descEl = /** @type {HTMLTextAreaElement | null} */ (descriptionInput);
  if (!titleEl || !titleEl.value || !titleEl.value.trim()) {
    showToast('Por favor ingrese un título para la tarea.', {
      type: 'warning',
      duration: 3600
    });
    return;
  }
  const title = titleEl.value.trim();

  let taskDate = null;
  if (dateEl && dateEl.value && dateEl.value.trim() !== '') {
    taskDate = dateEl.value;
  } else if (originalDate && originalDate.trim() !== '') {
    taskDate = originalDate;
  }
  if (taskDate === '') taskDate = null;

  const time = timeEl ? timeEl.value || null : null;
  const isReminder = !!(reminderEl && reminderEl.checked);
  const description = descEl ? descEl.value.trim() || '' : '';
  const priority = prioritySelected instanceof HTMLElement ? parseInt(prioritySelected.dataset.priority || '3', 10) : 3;

  if (!existingTaskId && taskDate) {
    const selectedDate = new Date(taskDate + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      showToast('No puedes agregar tareas a fechas pasadas.', {
        type: 'warning',
        duration: 3800
      });
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
                    task.description = description; task.priority = priority;
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

    // Close task input modal immediately after local update (before backend sync)
    closeTaskInputModal();
    notifyTasksUpdated();

    // Backend update if logged in (async, doesn't block UI)
    if (isLoggedInWithBackend()) {
      const existingTask = findTaskById(existingTaskId);
      const serverId = getServerTaskId(existingTask || { id: existingTaskId });
      if (serverId) {
        updateTaskOnBackend(serverId, {
          title,
          description: description || null,
          date: (taskDate && taskDate !== 'undated' && taskDate !== '') ? taskDate : null,
          time: (time && time.trim && time.trim() !== '') ? time.trim() : null,
          is_reminder: isReminder,
          priority
        }).then(() => showSyncStatus('Actualizado correctamente'))
          .catch(() => showSyncStatus('Actualizado localmente (sin conexión)', true));
      } else {
        pushLocalTasksToBackend();
      }
    }
    return;
  }

  // Create new task
  const localTaskId = createLocalTaskId();
  /** @type {Task} */
  const task = {
    id: localTaskId,
    title,
    description: description || undefined,
    date: taskDate && taskDate.trim() !== '' ? taskDate : null,
    time: taskDate && time && time.trim() !== '' ? time : null,
    completed: false,
    isReminder,
    priority
  };

  updateTasks(draft => {
    const key = taskDate ? taskDate : 'undated';
    if (!draft[key]) draft[key] = [];
    draft[key].push(task);
  });

  // Close task input modal immediately after local save (before backend sync)
  closeTaskInputModal();
  notifyTasksUpdated();

  // Backend sync if logged in (async, doesn't block UI)
  if (isLoggedInWithBackend()) {
    createTaskOnBackend(task)
      .then((createdTask) => {
        const serverId = createdTask && createdTask.id !== undefined ? Number(createdTask.id) : null;
        if (serverId && Number.isFinite(serverId)) {
          updateTasks((draft) => {
            Object.keys(draft).forEach((key) => {
              draft[key] = (draft[key] || []).map((item) => {
                if (String(item.id) !== localTaskId) return item;
                return {
                  ...item,
                  id: String(serverId),
                  serverId
                };
              });
            });
          });
          notifyTasksUpdated();
        }
        showSyncStatus('Guardado correctamente');
      })
      .catch(async (err) => {
        console.error('Create task failed:', err);
        showSyncStatus('Guardado localmente (sin conexión)', true);
      });
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
