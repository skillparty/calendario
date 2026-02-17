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
 * Delete with undo toast.
 * Implements "Immediate Delete" pattern: deletes data immediately (after UI animation)
 * and offers restoration via the Undo button.
 * 
 * @param {string} id 
 * @param {string} title 
 */
export function confirmDeleteTask(id, title) {
  const taskCard = /** @type {HTMLElement | null} */ (document.querySelector(`.task-card[data-task-id="${id}"]`));
  
  // 1. Capture task data for potential restoration
  const allTasks = getTasks();
  let taskToRestore = null;
  for (const dateKey in allTasks) {
    const found = allTasks[dateKey].find(t => String(t.id) === String(id));
    if (found) {
      taskToRestore = JSON.parse(JSON.stringify(found));
      break;
    }
  }

  // 2. Animate UI out
  if (taskCard) {
    taskCard.style.transition = 'all 0.3s ease';
    taskCard.style.transform = 'translateX(-100%)';
    taskCard.style.opacity = '0';
    taskCard.style.maxHeight = taskCard.scrollHeight + 'px';
  }

  // 3. Delete data after animation
  setTimeout(() => {
    deleteTask(id);
  }, 300);

  // 4. Show Undo Toast
  showUndoToast(`"${title}" eliminada`, {
    duration: 5000,
    onUndo: () => {
      if (taskToRestore) {
        restoreTask(taskToRestore);
        showToast('Tarea restaurada', { type: 'success', duration: 2000 });
      }
    }
  });
}

/**
 * Restore a deleted task to state and sync
 * @param {import('../types').Task} task 
 */
function restoreTask(task) {
  // Mark as dirty to ensure sync
  task.dirty = true;
  // We keep the same ID to prevent duplicates if it was a local-only task,
  // but if it was synced, we might want to handle it carefully.
  // For simplicity, we restore it as-is. backend sync will handle upsert or re-create.
  
  updateTasks(draft => {
    const dateKey = task.date || 'undated';
    if (!draft[dateKey]) draft[dateKey] = [];
    draft[dateKey].push(task);
  });
  notifyTasksUpdated();
  
  if (isLoggedInWithBackend()) {
     pushLocalTasksToBackend().catch(err => console.error('Restore sync failed:', err));
  }
}


/** @param {string} id */
export function toggleTask(id) {
  const previousState = JSON.parse(JSON.stringify(getTasks()));
  
  updateTasks(draft => {
    Object.values(draft).forEach(list => {
      const t = (list || []).find(x => String(x.id) === String(id));
      if (t) {
        t.completed = !t.completed;
        t.dirty = true;
        t.lastModified = Date.now();
      }
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
      
      Promise.resolve(promise)
        .then(() => {
           // Clear dirty flag on success
           if (serverId) {
             updateTasks(draft => {
               Object.values(draft).forEach(list => {
                 const t = (list || []).find(x => String(x.id) === String(id));
                 if (t) t.dirty = false;
               });
             });
             notifyTasksUpdated();
           }
        })
        .catch(err => {
        console.error('Toggle task sync failed:', err);
        showToast('Sincronización pendiente. Se reintentará automáticamente.', { type: 'warning' });
      });
    }
  }
}
