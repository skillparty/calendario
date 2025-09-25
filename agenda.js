// Agenda rendering, filters, and undated tasks for Calendar10
// Responsible for list view, filters, toggle/delete actions, and sidebar
/**
 * @typedef {import('./types').Task} Task
 */

import { state, getTasks, setFilters, updateTasks } from './state.js';
import { isLoggedInWithBackend, updateTaskOnBackend, deleteTaskOnBackend, pushLocalTasksToBackend } from './api.js';
import { showTaskInputModal } from './calendar.js';

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
        <div class="agenda-main">
            <div class="agenda-header">
                <h2 class="agenda-title">
                    <span class="agenda-icon">📋</span>
                    <span>Agenda de Tareas</span>
                </h2>
                <button onclick="showTaskInputModal(null)" class="btn-add-task-header">
                    <span class="btn-icon">➕</span>
                    <span class="btn-text">Nueva Tarea</span>
                </button>
            </div>
            
            <div class="agenda-filters-container">
                <div class="agenda-filters">
                    <div class="filter-group">
                        <label for="month-filter" class="filter-label">
                            <span class="filter-icon">📅</span>
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
                            <span class="filter-icon">📊</span>
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
                        <span class="search-icon">🔍</span>
                    </div>
                </div>
                
                <div class="filter-stats">
                    <span class="stat-badge" id="total-tasks-badge">0 tareas</span>
                    <span class="stat-badge pending" id="pending-tasks-badge">0 pendientes</span>
                    <span class="stat-badge completed" id="completed-tasks-badge">0 completadas</span>
                </div>
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
      return new Date(a.date) - new Date(b.date);
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
  function getColorByDay(dateString) {
    if (!dateString) return { bg: 'rgba(156, 163, 175, 0.1)', border: '#9ca3af', text: '#6b7280' }; // Gris para sin fecha
    
    const date = new Date(dateString + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, etc.
    
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
          <div class="empty-state-icon">📝</div>
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
        <button onclick="showTaskInputModal(null)" class="btn-primary empty-state-btn">
          <span class="btn-icon">➕</span>
          <span>Agregar Primera Tarea</span>
        </button>
      </div>
    `;
  } else {
    // Agrupar tareas por fecha
    const tasksByDate = {};
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
            <span class="date-group-icon">📌</span>
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
      
      html += `
        <li class="task-date-group">
          <div class="date-group-header" style="border-left: 4px solid ${dayColors.border};">
            <span class="date-group-icon">${isToday ? '📍' : '📅'}</span>
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
  
  function renderTaskCard(task, filterMonth, filterStatus) {
    const completedClass = task.completed ? ' completed' : '';
    const timeDisplay = task.time ? task.time : '';
    const description = task.description && task.description.trim() ? task.description.trim() : '';
    const priorityClass = task.priority === 1 ? 'high' : task.priority === 2 ? 'medium' : 'low';
    const priorityLabel = task.priority === 1 ? 'Alta' : task.priority === 2 ? 'Media' : 'Baja';
    const priorityIcon = task.priority === 1 ? '🔴' : task.priority === 2 ? '🟡' : '🟢';
    const reminderIcon = task.isReminder ? '🔔' : '';
    
    const dayColors = getColorByDay(task.date);
    
    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
    
    return `
      <li class="task-card${completedClass}" data-task-id="${task.id}" data-priority="${task.priority}">
        <div class="task-card-content">
          <div class="task-card-header">
            <div class="task-card-check">
              <button onclick="event.stopPropagation(); toggleTaskWithAnimation('${task.id}', '${filterMonth}', '${filterStatus}')"
                      class="task-check-btn${task.completed ? ' checked' : ''}"
                      title="${task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}"
                      aria-label="${task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}"
                      aria-pressed="${task.completed}">
                <span class="check-icon">${task.completed ? '✓' : ''}</span>
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
                    <span class="meta-icon">⏰</span>
                    <span>${timeDisplay}</span>
                  </span>
                ` : ''}
                ${task.date ? `
                  <span class="meta-item date" style="color: ${dayColors.text};">
                    <span class="meta-icon">📅</span>
                    <span>${formatDateShort(task.date)}</span>
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
          <div class="task-card-actions">
            <button onclick="event.stopPropagation(); showTaskInputModal(null, ${JSON.stringify(task).replace(/"/g, '&quot;')})"
                    class="task-action-btn edit"
                    title="Editar"
                    aria-label="Editar tarea">
              <span class="action-icon">✏️</span>
            </button>
            <button onclick="event.stopPropagation(); confirmDeleteTask('${task.id}', '${escapeHtml(task.title)}', '${filterMonth}', '${filterStatus}')"
                    class="task-action-btn delete"
                    title="Eliminar"
                    aria-label="Eliminar tarea">
              <span class="action-icon">🗑️</span>
            </button>
          </div>
        </div>
      </li>
    `;
  }
  
  function formatDateShort(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-ES', options);
  }

  html += `</ul>
            </div>
        </div>
        <div class="agenda-sidebar">
            <div class="sidebar-section quick-actions-section">
                <h3 class="sidebar-title">
                    <span class="sidebar-icon">🚀</span>
                    <span>Acciones Rápidas</span>
                </h3>
                <div class="quick-actions">
                    <button onclick="showTaskInputModal(null)" class="btn-action primary">
                        <span class="btn-icon">➕</span>
                        <span>Nueva Tarea</span>
                    </button>
                    <button onclick="showPdfExportModal()" class="btn-action secondary">
                        <span class="btn-icon">📄</span>
                        <span>Exportar PDF</span>
                    </button>
                    <button onclick="testNotification()" class="btn-action secondary">
                        <span class="btn-icon">🔔</span>
                        <span>Notificaciones</span>
                    </button>
                </div>
            </div>
            
            <div class="sidebar-section stats-section">
                <h3 class="sidebar-title">
                    <span class="sidebar-icon">📊</span>
                    <span>Estadísticas</span>
                </h3>
                <div class="stats-grid">
                    <div class="stat-card total">
                        <div class="stat-value">${totalTasks}</div>
                        <div class="stat-label">Total</div>
                        <div class="stat-bar">
                            <div class="stat-bar-fill" style="width: 100%"></div>
                        </div>
                    </div>
                    <div class="stat-card completed">
                        <div class="stat-value">${completedTasks}</div>
                        <div class="stat-label">Completadas</div>
                        <div class="stat-bar">
                            <div class="stat-bar-fill" style="width: ${totalTasks > 0 ? (completedTasks / totalTasks * 100) : 0}%"></div>
                        </div>
                    </div>
                    <div class="stat-card pending">
                        <div class="stat-value">${pendingTasks}</div>
                        <div class="stat-label">Pendientes</div>
                        <div class="stat-bar">
                            <div class="stat-bar-fill" style="width: ${totalTasks > 0 ? (pendingTasks / totalTasks * 100) : 0}%"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="sidebar-section upcoming-section">
                <h3 class="sidebar-title">
                    <span class="sidebar-icon">📅</span>
                    <span>Próximas Tareas</span>
                </h3>
                <div class="upcoming-tasks">
                    ${getUpcomingTasksHTML(allTasks)}
                </div>
            </div>
        </div>
    </div>`;

  agendaView.innerHTML = html;

  // Actualizar badges de estadísticas
  setTimeout(() => {
    const totalBadge = document.getElementById('total-tasks-badge');
    const pendingBadge = document.getElementById('pending-tasks-badge');
    const completedBadge = document.getElementById('completed-tasks-badge');
    
    if (totalBadge) totalBadge.textContent = `${totalTasks} ${totalTasks === 1 ? 'tarea' : 'tareas'}`;
    if (pendingBadge) pendingBadge.textContent = `${pendingTasks} ${pendingTasks === 1 ? 'pendiente' : 'pendientes'}`;
    if (completedBadge) completedBadge.textContent = `${completedTasks} ${completedTasks === 1 ? 'completada' : 'completadas'}`;
  }, 0);

  const monthSel = document.getElementById('month-filter');
  const statusSel = document.getElementById('status-filter');
  const searchInput = document.getElementById('search-filter');
  
  if (monthSel) monthSel.value = filterMonth;
  if (statusSel) statusSel.value = filterStatus;
  
  if (monthSel) monthSel.addEventListener('change', e => renderAgenda(e.target.value, filterStatus));
  if (statusSel) statusSel.addEventListener('change', e => renderAgenda(filterMonth, e.target.value));
  
  // Añadir funcionalidad de búsqueda
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const taskCards = document.querySelectorAll('.task-card');
      const dateGroups = document.querySelectorAll('.task-date-group');
      
      taskCards.forEach(card => {
        const title = card.querySelector('.task-card-title')?.textContent.toLowerCase() || '';
        const description = card.querySelector('.task-card-description')?.textContent.toLowerCase() || '';
        const shouldShow = title.includes(searchTerm) || description.includes(searchTerm);
        
        card.style.display = shouldShow ? '' : 'none';
      });
      
      // Ocultar grupos de fecha vacíos
      dateGroups.forEach(group => {
        const visibleTasks = group.querySelectorAll('.task-card:not([style*="display: none"])');
        group.style.display = visibleTasks.length > 0 ? '' : 'none';
      });
      
      // Mostrar mensaje si no hay resultados
      const visibleCards = document.querySelectorAll('.task-card:not([style*="display: none"])');
      const emptySearch = document.querySelector('.empty-search');
      
      if (visibleCards.length === 0 && searchTerm) {
        if (!emptySearch) {
          const container = document.querySelector('.task-list-container');
          const emptyDiv = document.createElement('div');
          emptyDiv.className = 'empty-search';
          emptyDiv.innerHTML = `
            <div class="empty-search-icon">🔍</div>
            <h3>No se encontraron tareas</h3>
            <p>No hay tareas que coincidan con "${searchTerm}"</p>
          `;
          container.appendChild(emptyDiv);
        }
      } else if (emptySearch) {
        emptySearch.remove();
      }
    });
  }
}

/** @param {Task[]} allTasks @returns {Task[]} */
function filterUpcomingTasks(allTasks) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return allTasks
    .filter(t => !t.completed && t.date)
    .filter(t => new Date(t.date + 'T00:00:00') >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
}

function getUpcomingTasksHTML(allTasks) {
  const list = filterUpcomingTasks(allTasks);
  if (list.length === 0) return '<p class="no-upcoming">No hay tareas próximas programadas</p>';
  return list.map(task => {
    const taskDate = new Date(task.date + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isToday = taskDate.toDateString() === today.toDateString();
    const tom = new Date(today); tom.setDate(tom.getDate() + 1);
    const isTomorrow = taskDate.toDateString() === tom.toDateString();
    const label = isToday ? 'Hoy' : (isTomorrow ? 'Mañana' : formatDateForDisplay(task.date));
    return `<div class="upcoming-task" onclick="showTaskInputModal(null, ${JSON.stringify(task).replace(/"/g, '&quot;')})">
              <div class="upcoming-task-title">${task.title}</div>
              <div class="upcoming-task-date">${label}${task.time ? ` - ${task.time}` : ''}</div>
            </div>`;
  }).join('');
}

/** @param {string} dateString @returns {string} */
function formatDateForDisplay(dateString) {
  const date = new Date(dateString + 'T00:00:00');
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
      const serverId = /^\d+$/.test(found.id) ? found.id : null;
      const promise = serverId ? updateTaskOnBackend(serverId, { completed: found.completed }) : pushLocalTasksToBackend();
      Promise.resolve(promise).catch(() => {/* soft-fail */});
    }
  }
}

// New function with animation
function toggleTaskWithAnimation(id, filterMonth, filterStatus) {
  const taskCard = document.querySelector(`[data-task-id="${id}"]`);
  if (taskCard) {
    taskCard.style.transition = 'all 0.3s ease';
    taskCard.style.transform = 'scale(0.98)';
    setTimeout(() => {
      toggleTask(id);
      renderAgenda(filterMonth, filterStatus);
    }, 150);
  } else {
    toggleTask(id);
    renderAgenda(filterMonth, filterStatus);
  }
}

// Improved delete confirmation
function confirmDeleteTask(id, title, filterMonth, filterStatus) {
  const modal = document.createElement('div');
  modal.className = 'delete-confirm-modal';
  modal.innerHTML = `
    <div class="delete-confirm-content">
      <h3>⚠️ Confirmar eliminación</h3>
      <p>¿Estás seguro de que deseas eliminar la tarea?</p>
      <p class="task-title-preview">"${title}"</p>
      <div class="delete-confirm-actions">
        <button onclick="this.closest('.delete-confirm-modal').remove()" class="btn-cancel">Cancelar</button>
        <button onclick="deleteTaskConfirmed('${id}', '${filterMonth}', '${filterStatus}')" class="btn-delete-confirm">Eliminar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Add styles for the modal
  const style = document.createElement('style');
  style.textContent = `
    .delete-confirm-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease;
    }
    
    .delete-confirm-content {
      background: white;
      padding: 2rem;
      border-radius: 16px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.3s ease;
    }
    
    .delete-confirm-content h3 {
      margin: 0 0 1rem 0;
      color: #dc2626;
    }
    
    .task-title-preview {
      background: #f3f4f6;
      padding: 0.75rem;
      border-radius: 8px;
      font-weight: 500;
      margin: 1rem 0;
    }
    
    .delete-confirm-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
    
    .btn-cancel {
      padding: 0.75rem 1.5rem;
      background: #e5e7eb;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }
    
    .btn-delete-confirm {
      padding: 0.75rem 1.5rem;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 500;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function deleteTaskConfirmed(id, filterMonth, filterStatus) {
  const modal = document.querySelector('.delete-confirm-modal');
  if (modal) modal.remove();
  
  const taskCard = document.querySelector(`[data-task-id="${id}"]`);
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
    const serverId = id && /^\d+$/.test(id) ? id : null;
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
