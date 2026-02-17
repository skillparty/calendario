// Agenda rendering, filters, and undated tasks for Calendar10
// Responsible for list view, filters, toggle/delete actions, and sidebar
/**
 * @typedef {import('./types').Task} Task
 */

import { state, getTasks, setTasks, setFilters, updateTasks, notifyTasksUpdated } from './state.js';
import { isLoggedInWithBackend, updateTaskOnBackend, deleteTaskOnBackend, pushLocalTasksToBackend } from './api.js';
import { showTaskInputModal, getServerTaskId } from './calendar.js';
import { openModal, closeModal } from './utils/modal.js';
import { getIcon, icons } from './icons.js';
import { escapeHtml } from './utils/helpers.js';
import { showUndoToast, showToast } from './utils/UIFeedback.js';
import { confirmDeleteTask, toggleTask, deleteTask } from './utils/taskActions.js';

let agendaSearchTerm = '';

/** Apply search filter on currently rendered task cards (module-level for delegation) */
function applySearchFilterDOM() {
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
}

/**
 * Handle inline editing of task title
 * @param {HTMLElement} titleEl
 * @param {string} taskId
 */
function handleInlineTitleEdit(titleEl, taskId) {
  const currentTitle = titleEl.textContent || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-title-input';
  input.value = currentTitle;
  
  const save = () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      const previousState = JSON.parse(JSON.stringify(getTasks()));
      updateTasks(draft => {
        // Find task across all dates
        for (const date in draft) {
          const task = draft[date].find(t => String(t.id) === String(taskId));
          if (task) {
            task.title = newTitle;
            break;
          }
        }
      });
      notifyTasksUpdated();
      
      // Backend sync
      if (isLoggedInWithBackend()) {
        const task = document.querySelector(`[data-task-id="${taskId}"]`);
        const serverId = getServerTaskId(/** @type {Task} */ ({ id: taskId, serverId: task ? Number(/** @type {HTMLElement} */ (task).dataset.serverId) : undefined }));
        if (serverId) {
          updateTaskOnBackend(serverId, { title: newTitle }).catch(err => {
            console.error('Title update failed:', err);
            setTasks(previousState);
            showToast('Error al actualizar. Cambios revertidos.', { type: 'error' });
          });
        } else {
          pushLocalTasksToBackend().catch(() => {/* offline/retry handled internally usually, but could revert here too if critical */});
        }
      }
    }
    if (input.parentNode) {
      titleEl.textContent = newTitle || currentTitle;
      input.replaceWith(titleEl);
      titleEl.classList.remove('editing');
    }
  };

  const cancel = () => {
    if (input.parentNode) {
      input.replaceWith(titleEl);
      titleEl.classList.remove('editing');
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      input.blur();
    } else if (e.key === 'Escape') {
      cancel();
    }
  });

  titleEl.classList.add('editing');
  titleEl.replaceWith(input);
  input.focus();
}

/**
 * Handle inline priority cycling
 * @param {HTMLElement} badgeEl
 * @param {string} taskId
 * @param {number} currentPriority
 */
function handleInlinePriorityCycle(badgeEl, taskId, currentPriority) {
  // Cycle: 1(High) -> 2(Medium) -> 3(Low) -> 1(High)
  const newPriority = currentPriority >= 3 ? 1 : currentPriority + 1;
  const previousState = JSON.parse(JSON.stringify(getTasks()));
  
  updateTasks(draft => {
    for (const date in draft) {
      const task = draft[date].find(t => t.id === taskId);
      if (task) {
        task.priority = newPriority;
        break;
      }
    }
  });
  notifyTasksUpdated();

  // Backend sync
  if (isLoggedInWithBackend()) {
    const task = document.querySelector(`[data-task-id="${taskId}"]`);
    const serverId = getServerTaskId(/** @type {Task} */ ({ id: taskId }));
    
    // Note: We might need to find the real serverId if not in DOM, but typically loadTasksIntoState populates it.
    // For now rely on robust sync or DOM data if added.
    // Actually, let's look up the task properly
    const allTasks = getTasks();
    let realTask = null;
    for (const date in allTasks) {
      realTask = allTasks[date].find(t => t.id === taskId);
      if (realTask) break;
    }
    
    if (realTask) {
        const sid = getServerTaskId(realTask);
        if (sid) {
          updateTaskOnBackend(sid, { priority: newPriority }).catch(err => {
            console.error('Priority update failed:', err);
            setTasks(previousState);
            showToast('Error al actualizar. Cambios revertidos.', { type: 'error' });
          });
        } else {
          pushLocalTasksToBackend();
        }
    }
  }
}

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
  const prioritySel = /** @type {HTMLSelectElement | null} */ (document.getElementById('priority-filter'));
  const filterPriority = prioritySel?.value || 'all';

  if (action === 'toggle-task') {
    event.preventDefault();
    event.stopPropagation();
    const taskId = target.dataset.taskId;
    if (taskId) toggleTaskWithAnimation(taskId, filterMonth, filterStatus, filterPriority);
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
    if (taskId) confirmDeleteTask(taskId, taskTitle);
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
export function renderAgenda(filterMonth = 'all', filterStatus = 'all', filterPriority = 'all') {
  const agendaView = document.getElementById('agenda-view');
  if (!agendaView) return;

  // Capture previous scroll position to restore it after render
  const previousScrollContainer = agendaView.querySelector('.task-list-container');
  const previousScrollTop = previousScrollContainer ? previousScrollContainer.scrollTop : 0;
  const previousWindowScroll = window.scrollY;
  const hasPreviousContent = agendaView.querySelector('.task-card') !== null;
  
  // Animation class - only for initial entry
  const animationClass = hasPreviousContent ? '' : ' animate-entry';

  setFilters(filterMonth, filterStatus, filterPriority);

  let html = `
    <div class="agenda-container${animationClass}">
        <!-- Streamlined Toolbar -->
        <header class="agenda-toolbar${animationClass}">
            <div class="toolbar-brand">
                <h2 class="toolbar-title">
                    ${getIcon('clipboard', 'agenda-icon')}
                    <span class="title-text">Agenda</span>
                </h2>
            </div>
            
            <div class="toolbar-actions">
                <div class="toolbar-search">
                    <input type="text" id="search-filter" placeholder="Buscar..." class="search-input" value="${escapeHtml(agendaSearchTerm)}">
                    ${getIcon('search', 'search-icon')}
                </div>
                
                <div class="toolbar-filters">
                     <select id="month-filter" class="toolbar-select" title="Filtrar por Mes">
                        <option value="all"${filterMonth === 'all' ? ' selected' : ''}>Mes: Todos</option>
                        <option value="0"${filterMonth === '0' ? ' selected' : ''}>Enero</option>
                        <option value="1"${filterMonth === '1' ? ' selected' : ''}>Febrero</option>
                        <option value="2"${filterMonth === '2' ? ' selected' : ''}>Marzo</option>
                        <option value="3"${filterMonth === '3' ? ' selected' : ''}>Abril</option>
                        <option value="4"${filterMonth === '4' ? ' selected' : ''}>Mayo</option>
                        <option value="5"${filterMonth === '5' ? ' selected' : ''}>Junio</option>
                        <option value="6"${filterMonth === '6' ? ' selected' : ''}>Julio</option>
                        <option value="7"${filterMonth === '7' ? ' selected' : ''}>Agosto</option>
                        <option value="8"${filterMonth === '8' ? ' selected' : ''}>Septiembre</option>
                        <option value="9"${filterMonth === '9' ? ' selected' : ''}>Octubre</option>
                        <option value="10"${filterMonth === '10' ? ' selected' : ''}>Noviembre</option>
                        <option value="11"${filterMonth === '11' ? ' selected' : ''}>Diciembre</option>
                     </select>
                     
                     <select id="status-filter" class="toolbar-select" title="Filtrar por Estado">
                        <option value="all"${filterStatus === 'all' ? ' selected' : ''}>Estado: Todos</option>
                        <option value="pending"${filterStatus === 'pending' ? ' selected' : ''}>Pendientes</option>
                        <option value="completed"${filterStatus === 'completed' ? ' selected' : ''}>Completadas</option>
                     </select>
                     
                     <select id="priority-filter" class="toolbar-select" title="Filtrar por Prioridad">
                        <option value="all"${filterPriority === 'all' ? ' selected' : ''}>Prioridad: Todas</option>
                        <option value="1"${filterPriority === '1' ? ' selected' : ''}>Alta</option>
                        <option value="2"${filterPriority === '2' ? ' selected' : ''}>Media</option>
                        <option value="3"${filterPriority === '3' ? ' selected' : ''}>Baja</option>
                     </select>
                </div>

                <button type="button" data-action="open-task-modal" class="toolbar-btn-add">
                    ${getIcon('plus', 'btn-icon')}
                    <span>Nueva Tarea</span>
                </button>
            </div>
        </header>

        <!-- Mobile FAB -->
        <button type="button" data-action="open-task-modal" class="fab-add-task" aria-label="Nueva Tarea">
            <span class="icon">${icons.plus}</span>
        </button>

        <!-- Main Content Area -->
        <main class="agenda-main-content">
            <div class="content-grid">
                <section class="tasks-section">
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
  if (filterPriority !== 'all') {
    const targetPriority = parseInt(filterPriority);
    allTasks = allTasks.filter(task => task.priority === targetPriority);
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
                  ${task.dirty ? `<span class="badge dirty" title="Cambios sin sincronizar">${icons.cloudOff || getIcon('cloudOff', 'badge-icon')}</span>` : ''}
                  ${reminderIcon ? `<span class="badge reminder" title="Recordatorio activo">${reminderIcon}</span>` : ''}
                  <span class="badge priority ${priorityClass}" title="Prioridad: ${priorityLabel}">
                    ${priorityIcon}
                  </span>
                </div>
              </div>
              ${description ? `<p class="task-card-description">${escapeHtml(description)}</p>` : ''}
              ${task.tags && task.tags.length > 0 ? `<div class="task-card-tags">${task.tags.map(t => `<span class="task-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
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
                                <div class="stat-item total" id="total-tasks-stat">
                                    <div class="stat-value">${totalTasks}</div>
                                    <div class="stat-label">Total</div>
                                    <div class="stat-progress">
                                        <div class="progress-bar" style="width: 100%"></div>
                                    </div>
                                </div>
                                <div class="stat-item completed" id="completed-tasks-stat">
                                    <div class="stat-value">${completedTasks}</div>
                                    <div class="stat-label">Completadas</div>
                                    <div class="stat-progress">
                                        <div class="progress-bar" style="width: ${totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0}%"></div>
                                    </div>
                                </div>
                                <div class="stat-item pending" id="pending-tasks-stat">
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

  // Restore scroll position if it existed (Immediate)
  const newScrollContainer = agendaView.querySelector('.task-list-container');
  if (newScrollContainer && previousScrollTop > 0) {
    newScrollContainer.scrollTo({ top: previousScrollTop, behavior: 'instant' });
  }
  if (previousWindowScroll > 0) {
    window.scrollTo({ top: previousWindowScroll, behavior: 'instant' });
  }

  // Backup restoration in next frame (handles potential layout shifts)
  requestAnimationFrame(() => {
    if (newScrollContainer && previousScrollTop > 0 && Math.abs(newScrollContainer.scrollTop - previousScrollTop) > 5) {
      newScrollContainer.scrollTo({ top: previousScrollTop, behavior: 'instant' });
    }
    if (previousWindowScroll > 0 && Math.abs(window.scrollY - previousWindowScroll) > 5) {
      window.scrollTo({ top: previousWindowScroll, behavior: 'instant' });
    }
  });

  // Final fallback for persistence
  setTimeout(() => {
    if (newScrollContainer && previousScrollTop > 0 && Math.abs(newScrollContainer.scrollTop - previousScrollTop) > 5) {
      newScrollContainer.scrollTop = previousScrollTop;
    }
  }, 10);

  if (!agendaView.dataset.actionsBound) {
    agendaView.addEventListener('click', (event) => {
      handleAgendaActionClick(/** @type {MouseEvent} */ (event));

      // Inline edit title
      const target = /** @type {HTMLElement} */ (event.target);
      const titleEl = target.closest('.task-card-title');
      if (titleEl && !titleEl.classList.contains('editing') && !titleEl.classList.contains('completed')) {
        const card = titleEl.closest('.task-card');
        const taskId = card instanceof HTMLElement ? card.dataset.taskId : null;
        if (taskId) handleInlineTitleEdit(/** @type {HTMLElement} */ (titleEl), taskId);
      }

      // Inline priority cycle
      const badgeEl = target.closest('.badge.priority');
      if (badgeEl) {
        const card = badgeEl.closest('.task-card');
        const taskId = card instanceof HTMLElement ? card.dataset.taskId : null;
        const currentPriority = parseInt(card instanceof HTMLElement ? (card.dataset.priority || '3') : '3', 10);
        if (taskId) handleInlinePriorityCycle(/** @type {HTMLElement} */ (badgeEl), taskId, currentPriority);
      }
    });
    agendaView.addEventListener('keydown', (event) => handleAgendaActionKeydown(/** @type {KeyboardEvent} */ (event)));

    // Delegated change handler for filters (prevents accumulating listeners)
    agendaView.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      const monthSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-filter'));
      const statusSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('status-filter'));
      const prioritySel = /** @type {HTMLSelectElement | null} */ (document.getElementById('priority-filter'));
      if (target.id === 'month-filter' || target.id === 'status-filter' || target.id === 'priority-filter') {
        renderAgenda(monthSel?.value || 'all', statusSel?.value || 'all', prioritySel?.value || 'all');
      }
    });

    // Delegated input handler for search (prevents accumulating listeners)
    const debouncedApplySearch = debounce(() => {
      const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('search-filter'));
      if (searchInput) agendaSearchTerm = searchInput.value;
      applySearchFilterDOM();
    }, 180);
    agendaView.addEventListener('input', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.id === 'search-filter') {
        agendaSearchTerm = target.value;
        debouncedApplySearch();
      }
    });

    agendaView.dataset.actionsBound = 'true';
  }

  // Actualizar badges de estadísticas (Sidebar)
  setTimeout(() => {
    // Initial sync just in case, though HTML generation should be correct.
    // This is mostly useful if we add animations or if calculations drift.
    // We can reuse the update function logic if we export it or just leave as is for now since HTML is fresh.
  }, 0);

  // Auto-scroll a la fecha actual si existe
  requestAnimationFrame(() => {
    const todayGroup = document.getElementById('today-group');
    const taskListContainer = document.querySelector('.task-list-container');
    
    // Solo hacer auto-scroll si es la carga inicial (no hay contenido previo)
    if (!hasPreviousContent && todayGroup && taskListContainer) {
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

  // Restore filter/search values after re-render
  const monthSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('month-filter'));
  const statusSel = /** @type {HTMLSelectElement | null} */ (document.getElementById('status-filter'));
  const prioritySel = /** @type {HTMLSelectElement | null} */ (document.getElementById('priority-filter'));
  const searchInput = /** @type {HTMLInputElement | null} */ (document.getElementById('search-filter'));
  
  if (monthSel) monthSel.value = filterMonth;
  if (statusSel) statusSel.value = filterStatus;
  if (prioritySel) prioritySel.value = filterPriority;
  if (searchInput) searchInput.value = agendaSearchTerm;

  // Apply existing search filter after re-render
  applySearchFilterDOM();
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

// Toggle task with targeted DOM update (no full re-render)
/** @param {string} id @param {string} filterMonth @param {string} filterStatus @param {string} [filterPriority='all'] */
function toggleTaskWithAnimation(id, filterMonth, filterStatus, filterPriority = 'all') {
  toggleTask(id, { silent: true });

  // Find the completed state from the updated store
  /** @type {boolean | undefined} */
  let isNowCompleted;
  Object.values(getTasks()).some(list => {
    const t = (list || []).find(x => String(x.id) === String(id));
    if (t) { isNowCompleted = t.completed; return true; }
    return false;
  });

  // Targeted DOM update
  const card = /** @type {HTMLElement | null} */ (document.querySelector(`.task-card[data-task-id="${id}"]`));
  if (card && typeof isNowCompleted === 'boolean') {
    card.classList.toggle('completed', isNowCompleted);

    const checkBtn = /** @type {HTMLElement | null} */ (card.querySelector('.task-check-btn'));
    if (checkBtn) {
      checkBtn.classList.toggle('checked', isNowCompleted);
      checkBtn.title = isNowCompleted ? 'Marcar como pendiente' : 'Marcar como completada';
      checkBtn.setAttribute('aria-label', checkBtn.title);
      checkBtn.setAttribute('aria-pressed', String(isNowCompleted));
      const checkIcon = checkBtn.querySelector('.check-icon');
      if (checkIcon) checkIcon.innerHTML = isNowCompleted ? icons.check : '';
    }

    const titleEl = card.querySelector('.task-card-title');
    if (titleEl) titleEl.classList.toggle('completed', isNowCompleted);

    // Update stat badges in-place
    updateStatBadges();
  } else {
    // Fallback: full re-render if card not found
    renderAgenda(filterMonth, filterStatus, filterPriority);
  }
}

/** Update stat badge numbers from current task data without re-rendering */
function updateStatBadges() {
  const allCards = document.querySelectorAll('.task-card');
  let total = 0, completed = 0;
  allCards.forEach(c => {
    if (!c.classList.contains('hidden-by-search')) {
      total++;
      if (c.classList.contains('completed')) completed++;
    }
  });
  const pending = total - completed;

  // Update Sidebar Stats
  /** 
   * @param {string} id 
   * @param {number} value 
   * @param {number} totalCount 
   */
  const updateStatItem = (id, value, totalCount) => {
      const el = document.getElementById(id);
      if (el) {
          const valEl = el.querySelector('.stat-value');
          if (valEl) valEl.textContent = String(value);
          const barEl = /** @type {HTMLElement | null} */ (el.querySelector('.progress-bar'));
          if (barEl) {
              const pct = totalCount > 0 ? (value / totalCount * 100) : 0;
              barEl.style.width = `${pct}%`;
          }
      }
  };

  updateStatItem('total-tasks-stat', total, total); // Total progress always 100% or relative? usually 100%
  updateStatItem('completed-tasks-stat', completed, total);
  updateStatItem('pending-tasks-stat', pending, total);
}

// Expose for inline handlers (browser only)
if (typeof window !== 'undefined') {
  window.renderAgenda = renderAgenda;
  window.toggleTask = toggleTask;
  window.toggleTaskWithAnimation = toggleTaskWithAnimation;
  window.confirmDeleteTask = confirmDeleteTask;
  window.deleteTask = deleteTask;
  window.showTaskInputModal = showTaskInputModal;
}
