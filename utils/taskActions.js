import { state, getTasks, setTasks, updateTasks, notifyTasksUpdated } from '../state.js';
import { isLoggedInWithBackend, updateTaskOnBackend, deleteTaskOnBackend, pushLocalTasksToBackend, createTaskOnBackend } from '../api.js';
import { getServerTaskId } from '../calendar.js'; // Circular? getServerTaskId is in calendar.js.
// We should probably move getServerTaskId to state.js or helpers.js or duplicate/import here.
// Actually, getServerTaskId is simple. Let's duplicate or better: move to helpers.
// For now, I'll copy it to avoid touching calendar.js exports too much.
import { showUndoToast, showToast } from './UIFeedback.js';

/**
 * @param {{ id?: string|number; serverId?: number } | null | undefined} task
 * @returns {number | null}
 */
function getServerTaskIdLocal(task) {
  if (!task) return null;
  if (typeof task.serverId === 'number') return task.serverId;
  if (typeof task.id === 'number') return task.id;
  if (typeof task.id === 'string' && /^\d+$/.test(task.id)) return parseInt(task.id, 10);
  return null;
}

/** @param {string} id */
export function deleteTask(id) {
  const previousState = JSON.parse(JSON.stringify(getTasks()));
  
  // remove from local state
  updateTasks(draft => {
    Object.keys(draft).forEach(date => {
      draft[date] = (draft[date] || []).filter(t => t.id !== id);
      if ((draft[date] || []).length === 0) delete draft[date];
    });
  });
  notifyTasksUpdated();

  if (isLoggedInWithBackend()) {
    const serverId = /^\d+$/.test(String(id)) ? parseInt(String(id), 10) : null;
    const promise = serverId ? deleteTaskOnBackend(serverId) : pushLocalTasksToBackend();
    Promise.resolve(promise).catch(err => {
      console.error('Delete failed:', err);
      setTasks(previousState);
      showToast('Error al eliminar. Tarea restaurada.', { type: 'error' });
    });
  }
}

/** 
 * Delete with undo toast
 * @param {string} id 
 * @param {string} title 
 */
export function confirmDeleteTask(id, title) {
  const taskCard = /** @type {HTMLElement | null} */ (document.querySelector(`.task-card[data-task-id="${id}"]`));

  // Slide card out immediately if visible (Agenda view)
  if (taskCard) {
    taskCard.style.transition = 'all 0.3s ease';
    taskCard.style.transform = 'translateX(-100%)';
    taskCard.style.opacity = '0';
    taskCard.style.maxHeight = taskCard.scrollHeight + 'px';
    setTimeout(() => {
      if (taskCard.parentNode) {
        taskCard.style.maxHeight = '0';
        taskCard.style.padding = '0';
        taskCard.style.margin = '0';
        taskCard.style.overflow = 'hidden';
      }
    }, 300);
  }

  // Show undo toast — deletion is deferred until toast expires
  showUndoToast(`"${title}" eliminada`, {
    duration: 5000,
    onUndo: () => {
      // Restore card visually
      if (taskCard) {
        taskCard.style.transition = 'all 0.3s ease';
        taskCard.style.transform = '';
        taskCard.style.opacity = '';
        taskCard.style.maxHeight = '';
        taskCard.style.padding = '';
        taskCard.style.margin = '';
        taskCard.style.overflow = '';
      }
      showToast('Tarea restaurada', { type: 'success', duration: 2000 });
    },
    onExpire: () => {
      // Permanently delete
      deleteTask(id);
      // No need to call renderAgenda explicitly; notifyTasksUpdated in deleteTask will trigger it via app.js listener
    }
  });
}

/** @param {string} id */
export function toggleTask(id) {
  const previousState = JSON.parse(JSON.stringify(getTasks()));
  
  updateTasks(draft => {
    Object.values(draft).forEach(list => {
      const t = (list || []).find(x => x.id === id);
      if (t) t.completed = !t.completed;
    });
  });
  notifyTasksUpdated(); // This triggers app-wide re-render (calendar & agenda)

  if (isLoggedInWithBackend()) {
    // find task and try update
    /** @type {import('../types').Task|null} */
    let found = null;
    Object.values(getTasks()).some(list => {
      const t = (list || []).find(x => x.id === id);
      if (t) { found = t; return true; }
      return false;
    });
    if (found) {
      const serverId = getServerTaskIdLocal(found);
      const promise = serverId ? updateTaskOnBackend(serverId, { completed: /** @type {import('../types').Task} */ (found).completed }) : pushLocalTasksToBackend();
      Promise.resolve(promise).catch(err => {
        console.error('Toggle task failed:', err);
        setTasks(previousState);
        showToast('Error al actualizar. Estado revertido.', { type: 'error' });
      });
    }
  }
}
