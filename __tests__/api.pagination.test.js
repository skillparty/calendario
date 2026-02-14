// @ts-nocheck
import { describe, test, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';

let fetchAllTasksFromBackend;

beforeAll(async () => {
  global.window = { location: { hostname: 'localhost' } };
  global.fetch = jest.fn();

  const apiModule = await import('../api.js');
  fetchAllTasksFromBackend = apiModule.fetchAllTasksFromBackend;
});

beforeEach(() => {
  global.fetch.mockReset();
});

afterAll(() => {
  delete global.fetch;
  delete global.window;
});

describe('fetchAllTasksFromBackend', () => {
  test('stops safely when backend ignores pagination and repeats the same chunk', async () => {
    const repeatedChunk = [
      { id: 1, title: 'A' },
      { id: 2, title: 'B' }
    ];

    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: repeatedChunk })
    });

    const result = await fetchAllTasksFromBackend(2);

    expect(result).toEqual(repeatedChunk);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('keeps paginating while pages are unique and stops on short last page', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 1 }, { id: 2 }] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 3 }] })
      });

    const result = await fetchAllTasksFromBackend(2);

    expect(result.map(t => t.id)).toEqual([1, 2, 3]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
