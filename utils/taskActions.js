import { state, getTasks, setTasks, updateTasks, notifyTasksUpdated } from '../state.js';
import { isLoggedInWithBackend, updateTaskOnBackend, deleteTaskOnBackend, pushLocalTasksToBackend, createTaskOnBackend } from '../api.js';
import { showUndoToast, showToast } from './UIFeedback.js';

/**
 * @param {{ id?: string|number; serverId?: number|string } | null | undefined} task
 * @returns {number | string | null}
 */
function getServerTaskIdLocal(task) {
  if (!task) return null;
  if (task.serverId !== undefined && task.serverId !== null) return task.serverId;
  // If id is number, return it
  if (typeof task.id === 'number') return task.id;
  // If id is numeric string, return it as string (safer than parseInt for large IDs)
  if (typeof task.id === 'string' && /^\d+$/.test(task.id)) return task.id;
  return null;
}

/** @param {string} id */
export function deleteTask(id) {
  const previousState = JSON.parse(JSON.stringify(getTasks()));
  
  // remove from local state
  updateTasks(draft => {
    Object.keys(draft).forEach(date => {
      draft[date] = (draft[date] || []).filter(t => String(t.id) !== String(id));
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
      const t = (list || []).find(x => String(x.id) === String(id));
      if (t) t.completed = !t.completed;
    });
  });
  notifyTasksUpdated(); // This triggers app-wide re-render (calendar & agenda)

  if (isLoggedInWithBackend()) {
    // find task and try update
    /** @type {import('../types').Task|null} */
    let found = null;
    Object.values(getTasks()).some(list => {
      const t = (list || []).find(x => String(x.id) === String(id));
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
