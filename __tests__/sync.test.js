// @ts-nocheck
import { describe, test, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';

let pushLocalTasksToBackend, loadTasksIntoState, fetchAllTasksFromBackend;
let mockState;

beforeAll(async () => {
  // Minimal browser globals
  global.window = { location: { hostname: 'localhost' } };
  global.localStorage = (() => {
    let store = {};
    return {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; }
    };
  })();
  global.document = { dispatchEvent: () => { }, addEventListener: () => { } };
  global.fetch = jest.fn();

  const apiMod = await import('../src/services/api.ts?t=' + Date.now());
  pushLocalTasksToBackend = apiMod.pushLocalTasksToBackend;
  loadTasksIntoState = apiMod.loadTasksIntoState;
  fetchAllTasksFromBackend = apiMod.fetchAllTasksFromBackend;
});

beforeEach(() => {
  global.fetch.mockReset();
});

afterAll(() => {
  delete global.window;
  delete global.localStorage;
  delete global.document;
  delete global.fetch;
});

// Helper: mock a successful paginated response with given tasks
function mockBackendTasks(tasks) {
  global.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: tasks })
  });
}

// Helper: mock a successful POST response returning a new task id
function mockCreateResponse(id) {
  return {
    ok: true,
    status: 201,
    clone: () => ({ json: async () => ({ id }) }),
    json: async () => ({ id })
  };
}

describe('fetchAllTasksFromBackend', () => {
  test('returns empty array when backend returns empty data', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] })
    });
    const result = await fetchAllTasksFromBackend(100);
    expect(result).toEqual([]);
  });

  test('throws when backend returns non-ok status', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      clone: () => ({ text: async () => 'Unauthorized' })
    });
    await expect(fetchAllTasksFromBackend(100)).rejects.toThrow('Tasks list HTTP 401');
  });

  test('aggregates tasks across multiple pages', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 3, title: 'C' }] })
      });

    const result = await fetchAllTasksFromBackend(2);
    expect(result).toHaveLength(3);
    expect(result.map(t => t.id)).toEqual([1, 2, 3]);
  });

  test('deduplicates tasks with same id across pages', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] })
      });

    const result = await fetchAllTasksFromBackend(2);
    expect(result).toHaveLength(2);
  });
});

describe('loadTasksIntoState', () => {
  test('returns false when not logged in with backend', async () => {
    // No JWT in state → isLoggedInWithBackend() returns false
    const result = await loadTasksIntoState();
    expect(result).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('pushLocalTasksToBackend', () => {
  test('does nothing when not logged in with backend', async () => {
    await pushLocalTasksToBackend();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('apiFetch retry behavior', () => {
  test('retries on 502 and succeeds on third attempt', async () => {
    const { apiFetch } = await import('../src/services/api.ts');
    const bad502 = { ok: false, status: 502, statusText: 'Bad Gateway', clone: () => ({ text: async () => 'Bad Gateway' }) };
    global.fetch
      .mockResolvedValueOnce(bad502)
      .mockResolvedValueOnce(bad502)
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' });

    const res = await apiFetch('/api/tasks', {}, 3);
    expect(res.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test('throws after exhausting all retries on network error', async () => {
    const { apiFetch } = await import('../src/services/api.ts');
    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(apiFetch('/api/tasks', {}, 2)).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
