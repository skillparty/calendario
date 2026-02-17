// @ts-nocheck
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Setup minimal browser globals before importing state
let setTasks, getTasks, updateTasks, setFilters, notifyTasksUpdated, state, formatDateLocal;

beforeEach(async () => {
  // Reset module registry so state is fresh each test
  global.localStorage = (() => {
    let store = {};
    return {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; }
    };
  })();

  global.document = {
    dispatchEvent: () => {},
    addEventListener: () => {},
  };

  // Dynamic import to get a fresh module each time via cache busting
  const mod = await import('../state.js?t=' + Date.now());
  setTasks = mod.setTasks;
  getTasks = mod.getTasks;
  updateTasks = mod.updateTasks;
  setFilters = mod.setFilters;
  notifyTasksUpdated = mod.notifyTasksUpdated;
  state = mod.state;
  formatDateLocal = mod.formatDateLocal;
});

afterEach(() => {
  delete global.localStorage;
  delete global.document;
});

describe('state: setTasks / getTasks', () => {
  test('setTasks stores tasks and getTasks retrieves them', () => {
    const tasks = { '2025-01-01': [{ id: 'a', title: 'Test', completed: false }] };
    setTasks(tasks);
    expect(getTasks()).toEqual(tasks);
  });

  test('setTasks persists to localStorage', () => {
    const tasks = { '2025-02-01': [{ id: 'b', title: 'Persist', completed: false }] };
    setTasks(tasks);
    const stored = JSON.parse(global.localStorage.getItem('calendarTasks'));
    expect(stored['2025-02-01'][0].title).toBe('Persist');
  });

  test('setTasks with empty object clears tasks', () => {
    setTasks({ '2025-01-01': [{ id: 'x', title: 'X', completed: false }] });
    setTasks({});
    expect(Object.keys(getTasks())).toHaveLength(0);
  });

  test('setTasks silent=true does not dispatch event', () => {
    let dispatched = false;
    global.document.dispatchEvent = () => { dispatched = true; };
    setTasks({ '2025-01-01': [{ id: 'a', title: 'T', completed: false }] }, { silent: true });
    expect(dispatched).toBe(false);
  });

  test('setTasks silent=false dispatches tasksUpdated event', () => {
    let dispatched = false;
    global.document.dispatchEvent = () => { dispatched = true; };
    setTasks({ '2025-01-01': [{ id: 'a', title: 'T', completed: false }] }, { silent: false });
    expect(dispatched).toBe(true);
  });
});

describe('state: updateTasks', () => {
  test('mutates a copy and saves it', () => {
    setTasks({ '2025-01-01': [{ id: 'a', title: 'Old', completed: false }] });
    updateTasks(draft => {
      draft['2025-01-01'][0].title = 'New';
    });
    expect(getTasks()['2025-01-01'][0].title).toBe('New');
  });

  test('does not mutate the original draft reference', () => {
    const original = { '2025-01-01': [{ id: 'a', title: 'Original', completed: false }] };
    setTasks(original);
    updateTasks(draft => {
      draft['2025-01-01'][0].title = 'Changed';
    });
    // original JS object should not be mutated (updateTasks deep-clones)
    expect(original['2025-01-01'][0].title).toBe('Original');
  });

  test('supports adding new date keys', () => {
    setTasks({});
    updateTasks(draft => {
      draft['2025-03-15'] = [{ id: 'new', title: 'New Task', completed: false }];
    });
    expect(getTasks()['2025-03-15']).toHaveLength(1);
  });

  test('supports deleting date keys', () => {
    setTasks({ '2025-01-01': [{ id: 'a', title: 'T', completed: false }] });
    updateTasks(draft => {
      delete draft['2025-01-01'];
    });
    expect(getTasks()['2025-01-01']).toBeUndefined();
  });

  test('silent option suppresses event', () => {
    let dispatched = false;
    global.document.dispatchEvent = () => { dispatched = true; };
    setTasks({}, { silent: true });
    updateTasks(draft => { draft['x'] = []; }, { silent: true });
    expect(dispatched).toBe(false);
  });
});

describe('state: setFilters', () => {
  test('sets month and status filters', () => {
    setFilters('3', 'pending');
    expect(state.filters.month).toBe('3');
    expect(state.filters.status).toBe('pending');
  });

  test('sets priority filter', () => {
    setFilters('all', 'all', '1');
    expect(state.filters.priority).toBe('1');
  });

  test('defaults priority to all when not provided', () => {
    setFilters('all', 'completed');
    expect(state.filters.priority).toBe('all');
  });
});

describe('formatDateLocal', () => {
  test('formats date as YYYY-MM-DD', () => {
    const d = new Date(2025, 5, 3); // June 3, 2025
    expect(formatDateLocal(d)).toBe('2025-06-03');
  });

  test('pads single-digit month and day', () => {
    const d = new Date(2025, 0, 9); // Jan 9
    expect(formatDateLocal(d)).toBe('2025-01-09');
  });
});
