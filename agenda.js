// Agenda rendering, filters, and undated tasks for Calendar10
// Responsible for list view, filters, toggle/delete actions, and sidebar
/**
 * @typedef {import('./types').Task} Task
 */

import { state, getTasks, setFilters, updateTasks } from './state.js';
import { isLoggedInWithBackend, updateTaskOnBackend, deleteTaskOnBackend, pushLocalTasksToBackend } from './api.js';
import { showTaskInputModal } from './calendar.js';
import { openModal, closeModal } from './utils/modal.js';
import { getIcon, icons } from './icons.js';

let agendaSearchTerm = '';

/**
 * @param {() => void} fn
 * @param {number} [delay=180]
 * @returns {() => void}
 */
function debounce(fn, delay = 180) {
  /** @type {number | null} */
  let timer = null;
  return () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      fn();
    }, delay);
  };
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * @param {Task} task
 * @returns {string}
 */
function serializeTask(task) {
  return encodeURIComponent(JSON.stringify(task));
}

/**
 * @param {string} encoded
 * @returns {Task | null}
 */
function parseTask(encoded) {
  if (!encoded) return null;
  try {
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    return null;
  }
}

/**
 * @param {Task | null} task
 * @returns {number | null}
 */
function getServerTaskId(task) {
  if (!task) return null;
  if (typeof task.serverId === 'number') return task.serverId;
  if (/^\d+$/.test(String(task.id))) return parseInt(String(task.id), 10);
  return null;
}

/**
 * @param {MouseEvent} event
 */
function handleAgendaActionClick(event) {
  const target = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  if (!action) return;

  if (action === 'open-task-modal') {
    event.preventDefault();
    showTaskInputModal(null);
    return;
  }

  if (action === 'open-pdf-modal') {
    event.preventDefault();
    if (typeof window.showPdfExportModal === 'function') {
      window.showPdfExportModal();
    }
    return;
  }

  if (action === 'test-notification') {
    event.preventDefault();
    if (typeof window.testNotification === 'function') {
      window.testNotification();
    }
    return;
  }

  const filterMonth = state.filters.month || 'all';
  const filterStatus = state.filters.status || 'all';

  if (action === 'toggle-task') {
    event.preventDefault();
    event.stopPropagation();
    const taskId = target.dataset.taskId;
    if (taskId) toggleTaskWithAnimation(taskId, filterMonth, filterStatus);
    return;
  }

  if (action === 'edit-task') {
    event.preventDefault();
    event.stopPropagation();
    const task = parseTask(target.dataset.task || '');
    if (task) showTaskInputModal(null, task);
    return;
  }

  if (action === 'delete-task') {
    event.preventDefault();
    event.stopPropagation();
    const taskId = target.dataset.taskId;
    const taskTitle = target.dataset.taskTitle || '';
    if (taskId) confirmDeleteTask(taskId, taskTitle, filterMonth, filterStatus);
  }
}

/**
 * @param {KeyboardEvent} event
 */
function handleAgendaActionKeydown(event) {
  const trigger = event.target instanceof HTMLElement ? event.target.closest('[data-action]') : null;
  if (!(trigger instanceof HTMLElement)) return;

  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  trigger.click();
}

/**
 * Render the agenda list view
 * @param {string} [filterMonth='all']
 * @param {string} [filterStatus='all']
 * @returns {void}
 */
export function renderAgenda(filterMonth = 'all', filterStatus = 'all') {
  const agendaView = document.getElementById('agenda-view');
  if (!agendaView) return;

  setFilters(filterMonth, filterStatus);

  let html = `
    <div class="agenda-container">
        <!-- Header Section -->
        <header class="agenda-header">
            <div class="header-content">
                <h2 class="agenda-title">
                    ${getIcon('clipboard', 'agenda-icon')}
                    <span class="title-text">Agenda de Tareas</span>
                </h2>
                <button type="button" data-action="open-task-modal" class="btn-add-task-header">
                    ${getIcon('plus', 'btn-icon')}
                    <span class="btn-text">Nueva Tarea</span>
                </button>
            </div>
        </header>
        
        <!-- Filters Section -->
        <section class="agenda-filters-section">
            <div class="filters-wrapper">
                <div class="filters-row">
                    <div class="filter-group">
                        <label for="month-filter" class="filter-label">
                            ${getIcon('calendar', 'filter-icon')}
                            <span>Mes</span>
                        </label>
                        <select id="month-filter" class="filter-select">
                            <option value="all">Todos los meses</option>
                            <option value="0">Enero</option>
                            <option value="1">Febrero</option>
                            <option value="2">Marzo</option>
                            <option value="3">Abril</option>
                            <option value="4">Mayo</option>
                            <option value="5">Junio</option>
                            <option value="6">Julio</option>
                            <option value="7">Agosto</option>
                            <option value="8">Septiembre</option>
                            <option value="9">Octubre</option>
                            <option value="10">Noviembre</option>
                            <option value="11">Diciembre</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="status-filter" class="filter-label">
                            ${getIcon('barChart', 'filter-icon')}
                            <span>Estado</span>
                        </label>
                        <select id="status-filter" class="filter-select">
                            <option value="all">Todas las tareas</option>
                            <option value="pending">Pendientes</option>
                            <option value="completed">Completadas</option>
                        </select>
                    </div>
                    
                    <div class="filter-search">
                        <input type="text" id="search-filter" placeholder="Buscar tareas..." class="search-input">
                        ${getIcon('search', 'search-icon')}
                    </div>
                </div>
                
                <div class="stats-row">
                    <div class="stat-badge total" id="total-tasks-badge">
                        <span class="stat-number">0</span>
                        <span class="stat-label">Total</span>
                    </div>
                    <div class="stat-badge pending" id="pending-tasks-badge">
                        <span class="stat-number">0</span>
                        <span class="stat-label">Pendientes</span>
                    </div>
                    <div class="stat-badge completed" id="completed-tasks-badge">
                        <span class="stat-number">0</span>
                        <span class="stat-label">Completadas</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- Main Content Area -->
        <main class="agenda-main-content">
            <div class="content-grid">
                <section class="tasks-section">
                    <div class="section-header">
                        <h3 class="section-title">
                            ${getIcon('clipboard', 'section-icon')}
                            <span>Lista de Tareas</span>
                        </h3>
                    </div>
                    <div class="task-list-container">
                        <ul class="task-list">
    `;

  /** @type {Task[]} */
  let allTasks = Object.entries(getTasks()).flatMap(([date, list]) => (list || []).map(t => ({ ...t, date: date === 'undated' ? null : date })))
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return -1;
      if (!b.date) return 1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

  if (filterMonth !== 'all') {
    const targetMonth = parseInt(filterMonth);
    allTasks = allTasks.filter(task => {
      if (!task.date) return false;
      const taskDate = new Date(task.date + 'T00:00:00');
      return taskDate.getMonth() === targetMonth;
    });
  }
  if (filterStatus !== 'all') {
    allTasks = allTasks.filter(task => task.completed === (filterStatus === 'completed'));
  }

  // Función para obtener color por día de la semana
  /** @param {string|null} dateString */
  function getColorByDay(dateString) {
    if (!dateString) return { bg: 'rgba(156, 163, 175, 0.1)', border: '#9ca3af', text: '#6b7280' }; // Gris para sin fecha
    
    const date = new Date(dateString + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    
    /** @type {Record<number, {bg: string, border: string, text: string}>} */
    const dayColors = {
      0: { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#dc2626' },   // Domingo - Rojo
      1: { bg: 'rgba(59, 130, 246, 0.1)', border: '#3b82f6', text: '#2563eb' }, // Lunes - Azul
      2: { bg: 'rgba(34, 197, 94, 0.1)', border: '#22c55e', text: '#16a34a' },  // Martes - Verde
      3: { bg: 'rgba(168, 85, 247, 0.1)', border: '#a855f7', text: '#9333ea' }, // Miércoles - Púrpura
      4: { bg: 'rgba(245, 158, 11, 0.1)', border: '#f59e0b', text: '#d97706' }, // Jueves - Ámbar
      5: { bg: 'rgba(236, 72, 153, 0.1)', border: '#ec4899', text: '#db2777' }, // Viernes - Rosa
      6: { bg: 'rgba(20, 184, 166, 0.1)', border: '#14b8a6', text: '#0d9488' }  // Sábado - Teal
    };
    
    return dayColors[dayOfWeek];
  }

  // Actualizar badges de estadísticas
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.completed).length;
  const pendingTasks = totalTasks - completedTasks;
  
  if (allTasks.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-animation">
          <div class="empty-state-icon">${icons.inbox}</div>
          <div class="empty-state-circles">
            <span class="circle circle-1"></span>
            <span class="circle circle-2"></span>
            <span class="circle circle-3"></span>
          </div>
        </div>
        <h3 class="empty-state-title">No hay tareas que mostrar</h3>
        <p class="empty-state-description">
          ${filterMonth !== 'all' || filterStatus !== 'all'
            ? 'No se encontraron tareas con los filtros actuales. Prueba ajustando los filtros o crea una nueva tarea.'
            : '¡Comienza agregando tu primera tarea del día!'}
        </p>
        <button type="button" data-action="open-task-modal" class="btn-primary empty-state-btn">
          ${getIcon('plus', 'btn-icon')}
          <span>Agregar Primera Tarea</span>
        </button>
      </div>
    `;
  } else {
    // Agrupar tareas por fecha
    /** @type {Record<string, Task[]>} */
    const tasksByDate = {};
    /** @type {Task[]} */
    const undatedTasks = [];
    
    allTasks.forEach(task => {
      if (task.date) {
        if (!tasksByDate[task.date]) {
          tasksByDate[task.date] = [];
        }
        tasksByDate[task.date].push(task);
      } else {
        undatedTasks.push(task);
      }
    });
    
    // Renderizar tareas sin fecha primero si existen
    if (undatedTasks.length > 0) {
      html += `
        <li class="task-date-group">
          <div class="date-group-header">
            ${getIcon('pin', 'date-group-icon')}
            <h3 class="date-group-title">Tareas sin fecha</h3>
            <span class="date-group-count">${undatedTasks.length}</span>
          </div>
          <ul class="date-group-tasks">
      `;
      
      undatedTasks.forEach(task => {
        html += renderTaskCard(task, filterMonth, filterStatus);
      });
      
      html += `</ul></li>`;
    }
    
    // Renderizar tareas agrupadas por fecha
    Object.keys(tasksByDate).sort().forEach(date => {
      const tasksForDate = tasksByDate[date];
      const dateObj = new Date(date + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isToday = dateObj.toDateString() === today.toDateString();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = dateObj.toDateString() === tomorrow.toDateString();
      
      let dateLabel = formatDateForDisplay(date);
      if (isToday) dateLabel = 'Hoy';
      else if (isTomorrow) dateLabel = 'Mañana';
      
      const dayColors = getColorByDay(date);
      
      // Agregar ID único para la fecha de hoy para hacer scroll automático
      const todayId = isToday ? ' id="today-group"' : '';
      
      html += `
        <li class="task-date-group"${todayId}>
          <div class="date-group-header" style="border-left: 4px solid ${dayColors.border};">
            ${isToday ? getIcon('pin', 'date-group-icon') : getIcon('calendar', 'date-group-icon')}
            <h3 class="date-group-title">${dateLabel}</h3>
            <span class="date-group-count">${tasksForDate.length}</span>
          </div>
          <ul class="date-group-tasks">
      `;
      
      tasksForDate.forEach(task => {
        html += renderTaskCard(task, filterMonth, filterStatus);
      });
      
      html += `</ul></li>`;
    });
  }
  
  /** @param {Task} task @param {string} filterMonth @param {string} filterStatus */
  function renderTaskCard(task, filterMonth, filterStatus) {
    const completedClass = task.completed ? ' completed' : '';
    const timeDisplay = task.time ? task.time : '';
    const description = task.description && task.description.trim() ? task.description.trim() : '';
    const priorityClass = task.priority === 1 ? 'high' : task.priority === 2 ? 'medium' : 'low';
    const priorityLabel = task.priority === 1 ? 'Alta' : task.priority === 2 ? 'Media' : 'Baja';
    const priorityIcon = task.priority === 1 ? icons.priorityHigh : task.priority === 2 ? icons.priorityMedium : icons.priorityLow;
    const reminderIcon = task.isReminder ? icons.bell : '';
    
    const dayColors = getColorByDay(task.date);
    
    return `
      <li class="task-card${completedClass}" data-task-id="${task.id}" data-priority="${task.priority}">
        <div class="task-card-content">
          <div class="task-card-header">
            <div class="task-card-check">
              <button type="button" data-action="toggle-task" data-task-id="${task.id}"
                      class="task-check-btn${task.completed ? ' checked' : ''}"
                      title="${task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}"
                      aria-label="${task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}"
                      aria-pressed="${task.completed}">
                <span class="check-icon">${task.completed ? icons.check : ''}</span>
              </button>
            </div>
            <div class="task-card-body">
              <div class="task-card-title-row">
                <h4 class="task-card-title${task.completed ? ' completed' : ''}">${escapeHtml(task.title)}</h4>
                <div class="task-card-badges">
                  ${reminderIcon ? `<span class="badge reminder" title="Recordatorio activo">${reminderIcon}</span>` : ''}
                  <span class="badge priority ${priorityClass}" title="Prioridad: ${priorityLabel}">
                    ${priorityIcon}
                  </span>
                </div>
              </div>
              ${description ? `<p class="task-card-description">${escapeHtml(description)}</p>` : ''}
              <div class="task-card-meta">
                ${timeDisplay ? `
                  <span class="meta-item time">
                    ${getIcon('clock', 'meta-icon')}
                    <span>${timeDisplay}</span>
                  </span>
                ` : ''}
                ${task.date ? `
                  <span class="meta-item date" style="color: ${dayColors.text};">
                    ${getIcon('date', 'meta-icon')}
                    <span>${formatDateShort(task.date)}</span>
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
          <div class="task-card-actions">
            <button type="button" data-action="edit-task" data-task="${serializeTask(task)}"
                    class="task-action-btn edit"
                    title="Editar"
                    aria-label="Editar tarea">
              <span class="action-icon">${icons.edit}</span>
            </button>
            <button type="button" data-action="delete-task" data-task-id="${task.id}" data-task-title="${escapeHtml(task.title)}"
                    class="task-action-btn delete"
                    title="Eliminar"
                    aria-label="Eliminar tarea">
              <span class="action-icon">${icons.trash}</span>
            </button>
          </div>
        </div>
      </li>
    `;
  }
  
  /** @param {string} dateString */
  function formatDateShort(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    /** @type {Intl.DateTimeFormatOptions} */
    const options = { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-ES', options);
  }

  html += `
                        </ul>
                    </div>
                </section>
                
                <aside class="sidebar-section">
                    <div class="sidebar-content">
                        <div class="sidebar-block quick-actions-block">
                            <h3 class="sidebar-title">
                                ${getIcon('zap', 'sidebar-icon')}
                                <span>Acciones Rápidas</span>
                            </h3>
                            <div class="quick-actions">
                                <button type="button" data-action="open-task-modal" class="btn-action primary">
                                    ${getIcon('plus', 'btn-icon')}
                                    <span>Nueva Tarea</span>
                                </button>
                                <button type="button" data-action="open-pdf-modal" class="btn-action secondary">
                                    ${getIcon('fileText', 'btn-icon')}
                                    <span>Exportar PDF</span>
                                </button>
                                <button type="button" data-action="test-notification" class="btn-action secondary">
                                    ${getIcon('bell', 'btn-icon')}
                                    <span>Test Notificaciones</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="sidebar-block stats-block">
                            <h3 class="sidebar-title">
                                ${getIcon('barChart', 'sidebar-icon')}
                                <span>Resumen</span>
                            </h3>
                            <div class="stats-overview">
                                <div class="stat-item total">
                                    <div class="stat-value">${totalTasks}</div>
                                    <div class="stat-label">Total</div>
                                    <div class="stat-progress">
                                        <div class="progress-bar" style="width: 100%"></div>
                                    </div>
                                </div>
                                <div class="stat-item completed">
                                    <div class="stat-value">${completedTasks}</div>
                                    <div class="stat-label">Completadas</div>
                                    <div class="stat-progress">
                                        <div class="progress-bar" style="width: ${totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0}%"></div>
                                    </div>
                                </div>
                                <div class="stat-item pending">
                                    <div class="stat-value">${pendingTasks}</div>
                                    <div class="stat-label">Pendientes</div>
                                    <div class="stat-progress">
                                        <div class="progress-bar" style="width: ${totalTasks > 0 ? (pendingTasks / totalTasks * 100) : 0}%"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="sidebar-block upcoming-block">
                            <h3 class="sidebar-title">
                                ${getIcon('clock', 'sidebar-icon')}
                                <span>Próximas</span>
                            </h3>
                            <div class="upcoming-tasks">
                                ${getUpcomingTasksHTML(allTasks)}
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    </div>`;

  agendaView.innerHTML = html;

  if (!agendaView.dataset.actionsBound) {
    agendaView.addEventListener('click', (event) => handleAgendaActionClick(/** @type {MouseEvent} */ (event)));
    agendaView.addEventListener('keydown', (event) => handleAgendaActionKeydown(/** @type {KeyboardEvent} */ (event)));
    agendaView.dataset.actionsBound = 'true';
  }

  // Actualizar badges de estadísticas
  setTimeout(() => {
    const totalBadge = document.getElementById('total-tasks-badge');
    const pendingBadge = document.getElementById('pending-tasks-badge');
    const completedBadge = document.getElementById('completed-tasks-badge');
    
    if (totalBadge) {
      const numberEl = totalBadge.querySelector('.stat-number');
      if (numberEl) numberEl.textContent = String(totalTasks);
    }
    if (pendingBadge) {
      const numberEl = pendingBadge.querySelector('.stat-number');
      if (numberEl) numberEl.textContent = String(pendingTasks);
    }
    if (completedBadge) {
      const numberEl = completedBadge.querySelector('.stat-number');
      if (numberEl) numberEl.textContent = String(completedTasks);
    }
  }, 0);

  // Auto-scroll a la fecha actual si existe
  requestAnimationFrame(() => {
    const todayGroup = document.getElementById('today-group');
    const taskListContainer = document.querySelector('.task-list-container');
    
    if (todayGroup && taskListContainer) {
      // Calcular posición con offset para dejar espacio arriba
      const containerTop = /** @type {HTMLElement} */ (taskListContainer).offsetTop;
      const todayGroupTop = /** @type {HTMLElement} */ (todayGroup).offsetTop;
      const offset = 100; // Espacio superior para mejor visualización
      
      // Hacer scroll suave hacia la fecha actual
      taskListContainer.scrollTo({
        top: todayGroupTop - offset,
        behavior: 'smooth'
      });
      
      // Agregar animación de highlight temporal a la fecha de hoy
      const todayHeader = /** @type {HTMLElement | null} */ (todayGroup.querySelector('.date-group-header'));
      if (todayHeader) {
        todayHeader.style.animation = 'highlightToday 2s ease-in-out';
      }
    }
  });

  const monthSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-filter'));
  const statusSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('status-filter'));
  const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('search-filter'));
  
  if (monthSel) monthSel.value = filterMonth;
  if (statusSel) statusSel.value = filterStatus;
  
  if (monthSel) {
    monthSel.addEventListener('change', (e) => {
      const target = e.target;
      if (target instanceof HTMLSelectElement) {
        renderAgenda(target.value, statusSel?.value || 'all');
      }
    });
  }
  if (statusSel) {
    statusSel.addEventListener('change', (e) => {
      const target = e.target;
      if (target instanceof HTMLSelectElement) {
        renderAgenda(monthSel?.value || 'all', target.value);
      }
    });
  }

  const applySearchFilter = () => {
    const searchTerm = agendaSearchTerm.trim().toLowerCase();
    const taskCards = document.querySelectorAll('.task-card');
    const dateGroups = document.querySelectorAll('.task-date-group');

    taskCards.forEach(card => {
      const title = card.querySelector('.task-card-title')?.textContent?.toLowerCase() || '';
      const description = card.querySelector('.task-card-description')?.textContent?.toLowerCase() || '';
      const shouldShow = title.includes(searchTerm) || description.includes(searchTerm);
      card.classList.toggle('hidden-by-search', !shouldShow);
    });

    dateGroups.forEach(group => {
      const visibleTasks = group.querySelectorAll('.task-card:not(.hidden-by-search)');
      group.classList.toggle('hidden-by-search', visibleTasks.length === 0);
    });

    const visibleCards = document.querySelectorAll('.task-card:not(.hidden-by-search)');
    const emptySearch = document.querySelector('.empty-search');

    if (visibleCards.length === 0 && searchTerm) {
      if (!emptySearch) {
        const container = document.querySelector('.task-list-container');
        if (!container) return;
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-search';
        emptyDiv.innerHTML = `
          <div class="empty-search-icon">${icons.search}</div>
          <h3>No se encontraron tareas</h3>
          <p>No hay tareas que coincidan con "${escapeHtml(searchTerm)}"</p>
        `;
        container.appendChild(emptyDiv);
      }
    } else if (emptySearch) {
      emptySearch.remove();
    }
  };
  
  if (searchInput) {
    searchInput.value = agendaSearchTerm;
    const debouncedSearch = debounce(applySearchFilter, 180);
    searchInput.addEventListener('input', (e) => {
      const target = e.target;
      if (target instanceof HTMLInputElement) {
        agendaSearchTerm = target.value;
        debouncedSearch();
      }
    });
  }

  applySearchFilter();
}

/** @param {Task[]} allTasks @returns {Task[]} */
function filterUpcomingTasks(allTasks) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return allTasks
    .filter(t => !t.completed && t.date)
    .filter(t => t.date ? new Date(t.date + 'T00:00:00') >= today : false)
    .sort((a, b) => new Date(a.date || '').getTime() - new Date(b.date || '').getTime())
    .slice(0, 5);
}

/** @param {Task[]} allTasks */
function getUpcomingTasksHTML(allTasks) {
  const list = filterUpcomingTasks(allTasks);
  if (list.length === 0) return '<p class="no-upcoming">No hay tareas próximas programadas</p>';
  return list.map(task => {
    const taskDate = new Date(task.date + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isToday = taskDate.toDateString() === today.toDateString();
    const tom = new Date(today); tom.setDate(tom.getDate() + 1);
    const isTomorrow = taskDate.toDateString() === tom.toDateString();
    const label = isToday ? 'Hoy' : (isTomorrow ? 'Mañana' : formatDateForDisplay(task.date || ''));
    return `<div class="upcoming-task" data-action="edit-task" data-task="${serializeTask(task)}" role="button" tabindex="0">
              <div class="upcoming-task-title">${escapeHtml(task.title)}</div>
              <div class="upcoming-task-date">${label}${task.time ? ` - ${task.time}` : ''}</div>
            </div>`;
  }).join('');
}

/** @param {string} dateString @returns {string} */
function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  /** @type {Intl.DateTimeFormatOptions} */
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('es-ES', options);
}

/** @param {string} id */
function toggleTask(id) {
  updateTasks(draft => {
    Object.values(draft).forEach(list => {
      const t = (list || []).find(x => x.id === id);
      if (t) t.completed = !t.completed;
    });
  });

  if (isLoggedInWithBackend()) {
    // find task and try update
    /** @type {Task|null} */
    let found = null;
    Object.values(getTasks()).some(list => {
      const t = (list || []).find(x => x.id === id);
      if (t) { found = t; return true; }
      return false;
    });
    if (found) {
      const serverId = getServerTaskId(/** @type {Task} */ (found));
      const promise = serverId ? updateTaskOnBackend(serverId, { completed: /** @type {Task} */ (found).completed }) : pushLocalTasksToBackend();
      Promise.resolve(promise).catch(() => {/* soft-fail */});
    }
  }
}

// Toggle task without animation, preserving scroll position
/** @param {string} id @param {string} filterMonth @param {string} filterStatus */
function toggleTaskWithAnimation(id, filterMonth, filterStatus) {
  // Save current scroll position
  const taskListContainer = document.querySelector('.task-list-container');
  const scrollPosition = taskListContainer ? taskListContainer.scrollTop : 0;
  
  // Toggle task immediately
  toggleTask(id);
  renderAgenda(filterMonth, filterStatus);
  
  // Restore scroll position after render
  requestAnimationFrame(() => {
    const newTaskListContainer = document.querySelector('.task-list-container');
    if (newTaskListContainer) {
      newTaskListContainer.scrollTop = scrollPosition;
    }
  });
}

// Improved delete confirmation
/** @param {string} id @param {string} title @param {string} filterMonth @param {string} filterStatus */
function confirmDeleteTask(id, title, filterMonth, filterStatus) {
  const existing = document.querySelector('.delete-confirm-modal');
  if (existing instanceof HTMLElement) {
    closeModal(existing, { removeFromDom: true });
  }

  const modal = document.createElement('div');
  modal.className = 'delete-confirm-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="delete-confirm-content" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
      <h3>${getIcon('alertTriangle', 'confirm-icon')} Confirmar eliminaci\u00f3n</h3>
      <p>¿Estás seguro de que deseas eliminar la tarea?</p>
      <p class="task-title-preview">"${escapeHtml(title)}"</p>
      <div class="delete-confirm-actions">
        <button type="button" data-action="cancel-delete" class="btn-cancel">Cancelar</button>
        <button type="button" data-action="confirm-delete" class="btn-delete-confirm">Eliminar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const cancelBtn = modal.querySelector('[data-action="cancel-delete"]');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => closeModal(modal, { removeFromDom: true }));
  }

  const confirmBtn = modal.querySelector('[data-action="confirm-delete"]');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      closeModal(modal, { removeFromDom: true });
      deleteTaskConfirmed(id, filterMonth, filterStatus);
    });
  }

  openModal(modal, {
    dialogSelector: '.delete-confirm-content',
    initialFocusSelector: '[data-action="confirm-delete"]',
    removeOnClose: true
  });
}

/** @param {string} id @param {string} filterMonth @param {string} filterStatus */
function deleteTaskConfirmed(id, filterMonth, filterStatus) {
  const taskCard = /** @type {HTMLElement | null} */ (document.querySelector(`[data-task-id="${id}"]`));
  if (taskCard) {
    taskCard.style.transition = 'all 0.3s ease';
    taskCard.style.transform = 'translateX(-100%)';
    taskCard.style.opacity = '0';
    setTimeout(() => {
      deleteTask(id);
      renderAgenda(filterMonth, filterStatus);
    }, 300);
  } else {
    deleteTask(id);
    renderAgenda(filterMonth, filterStatus);
  }
}

/** @param {string} id */
function deleteTask(id) {
  // remove from local state
  updateTasks(draft => {
    Object.keys(draft).forEach(date => {
      draft[date] = (draft[date] || []).filter(t => t.id !== id);
      if ((draft[date] || []).length === 0) delete draft[date];
    });
  });

  if (isLoggedInWithBackend()) {
    const serverId = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : null;
    const promise = serverId ? deleteTaskOnBackend(serverId) : pushLocalTasksToBackend();
    Promise.resolve(promise).catch(() => {/* soft-fail */});
  }
}

// Expose for inline handlers (browser only)
if (typeof window !== 'undefined') {
  window.renderAgenda = renderAgenda;
  window.toggleTask = toggleTask;
  window.toggleTaskWithAnimation = toggleTaskWithAnimation;
  window.confirmDeleteTask = confirmDeleteTask;
  window.deleteTaskConfirmed = deleteTaskConfirmed;
  window.deleteTask = deleteTask;
  window.showTaskInputModal = showTaskInputModal;
}
