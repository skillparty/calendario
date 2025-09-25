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
        <div class="agenda-main">
            <h2>📋 Agenda de Tareas</h2>
            <div class="agenda-filters">
                <select id="month-filter">
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
                <select id="status-filter">
                    <option value="all">Todas las tareas</option>
                    <option value="pending">Pendientes</option>
                    <option value="completed">Completadas</option>
                </select>
            </div>
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

  if (allTasks.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <h3 class="empty-state-title">No hay tareas que mostrar</h3>
        <p class="empty-state-description">
          ${filterMonth !== 'all' || filterStatus !== 'all' 
            ? 'Prueba ajustando los filtros o crea una nueva tarea.' 
            : '¡Comienza agregando tu primera tarea!'}
        </p>
        <button onclick="showTaskInputModal(null)" class="btn-primary empty-state-btn">
          ➕ Agregar Primera Tarea
        </button>
      </div>
    `;
  } else {
    allTasks.forEach(task => {
      const completedClass = task.completed ? ' completed' : '';
      const formattedDate = task.date ? formatDateForDisplay(task.date) : 'Sin fecha';
      const timeDisplay = task.time ? task.time : '';
      const dateStyle = !task.date ? 'color: #999; font-style: italic;' : '';
      const description = task.description && task.description.trim() ? task.description.trim() : '';
      const priorityIcon = task.priority === 1 ? '🔴' : task.priority === 2 ? '🟡' : '🟢';
      const reminderIcon = task.isReminder ? '🔔' : '';
      
      html += `<li class="task${completedClass}">
              <div class="task-info">
                  <div class="task-content">
                      <div class="task-header">
                          <h4 class="task-title">${task.title}</h4>
                          <div class="task-indicators">
                              ${reminderIcon}
                              <span class="task-priority" title="Prioridad: ${task.priority === 1 ? 'Alta' : task.priority === 2 ? 'Media' : 'Baja'}">${priorityIcon}</span>
                          </div>
                      </div>
                      ${description ? `<p class="task-description">${description}</p>` : ''}
                      <div class="task-meta" style="${dateStyle}">
                          <span class="task-date">${formattedDate}</span>
                          ${timeDisplay ? `<span class="task-time">${timeDisplay}</span>` : ''}
                      </div>
                  </div>
                  <div class="task-buttons">
                      <button onclick="showTaskInputModal(null, ${JSON.stringify(task).replace(/"/g, '&quot;')})" class="btn-edit" title="Editar tarea">✏️</button>
                      <button onclick="toggleTask('${task.id}'); renderAgenda('${filterMonth}', '${filterStatus}')" class="btn-toggle" title="${task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}">${task.completed ? '↩️' : '✅'}</button>
                      <button onclick="deleteTask('${task.id}')" class="btn-delete" title="Eliminar tarea">🗑️</button>
                  </div>
              </div>
          </li>`;
    });
  }

  html += `</ul></div>
        <div class="agenda-sidebar">
            <h3>🚀 Acciones Rápidas</h3>
            <div class="quick-actions">
                <button onclick="showTaskInputModal(null)" class="btn-primary btn-full">➕ Agregar Tarea Rápida</button>
                <button onclick="showPdfExportModal()" class="btn-secondary btn-full">📄 Exportar PDF</button>
                <button onclick="testNotification()" class="btn-secondary btn-full" title="Probar sistema de notificaciones">🔔 Probar Notificaciones</button>
            </div>
            <h3>📊 Estadísticas</h3>
            <div class="stats-container">
                <div class="stat-item"><span class="stat-number">${allTasks.length}</span><span class="stat-label">Total</span></div>
                <div class="stat-item"><span class="stat-number">${allTasks.filter(t => t.completed).length}</span><span class="stat-label">Completadas</span></div>
                <div class="stat-item"><span class="stat-number">${allTasks.filter(t => !t.completed).length}</span><span class="stat-label">Pendientes</span></div>
            </div>
            <h3>📅 Próximas Tareas</h3>
            <div class="upcoming-tasks">${getUpcomingTasksHTML(allTasks)}</div>
        </div>`;

  agendaView.innerHTML = html;

  const monthSel = document.getElementById('month-filter');
  const statusSel = document.getElementById('status-filter');
  if (monthSel) monthSel.value = filterMonth;
  if (statusSel) statusSel.value = filterStatus;
  if (monthSel) monthSel.addEventListener('change', e => renderAgenda(e.target.value, filterStatus));
  if (statusSel) statusSel.addEventListener('change', e => renderAgenda(filterMonth, e.target.value));
}

/** @param {Task[]} allTasks @returns {Task[]} */
export function filterUpcomingTasks(allTasks) {
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
export function toggleTask(id) {
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

/** @param {string} id */
export function deleteTask(id) {
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
  window.deleteTask = deleteTask;
  window.showTaskInputModal = showTaskInputModal;
}
