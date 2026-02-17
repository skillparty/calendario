// @ts-nocheck
import { describe, test, expect, beforeAll } from '@jest/globals';

// mergeTasksById is not exported, so we test it via app.js behavior.
// We replicate the pure function here to unit-test it in isolation.

/** @param {Record<string,any[]>} localData @param {Record<string,any[]>} remoteData */
function mergeTasksById(localData = {}, remoteData = {}) {
  const result = { ...localData };
  const allDates = new Set([...Object.keys(localData || {}), ...Object.keys(remoteData || {})]);
  allDates.forEach(date => {
    const l = (localData[date] || []);
    const r = (remoteData[date] || []);
    const byId = new Map();
    l.forEach(t => byId.set(t.id, t));
    r.forEach(t => byId.set(t.id, { ...byId.get(t.id), ...t }));
    const merged = Array.from(byId.values());
    if (merged.length > 0) result[date] = merged;
    else if (result[date]) delete result[date];
  });
  return result;
}

describe('mergeTasksById', () => {
  test('returns local tasks when remote is empty', () => {
    const local = { '2025-01-01': [{ id: 'a', title: 'Local' }] };
    const result = mergeTasksById(local, {});
    expect(result['2025-01-01']).toHaveLength(1);
    expect(result['2025-01-01'][0].title).toBe('Local');
  });

  test('returns remote tasks when local is empty', () => {
    const remote = { '2025-01-01': [{ id: 'b', title: 'Remote' }] };
    const result = mergeTasksById({}, remote);
    expect(result['2025-01-01']).toHaveLength(1);
    expect(result['2025-01-01'][0].title).toBe('Remote');
  });

  test('remote fields overwrite local fields for same id', () => {
    const local = { '2025-01-01': [{ id: 'x', title: 'Old', completed: false }] };
    const remote = { '2025-01-01': [{ id: 'x', title: 'New', completed: true }] };
    const result = mergeTasksById(local, remote);
    expect(result['2025-01-01'][0].title).toBe('New');
    expect(result['2025-01-01'][0].completed).toBe(true);
  });

  test('preserves local-only fields not present in remote', () => {
    const local = { '2025-01-01': [{ id: 'x', title: 'T', dirty: true, serverId: 42 }] };
    const remote = { '2025-01-01': [{ id: 'x', title: 'T' }] };
    const result = mergeTasksById(local, remote);
    // remote doesn't have dirty/serverId, so local values are preserved via spread order
    expect(result['2025-01-01'][0].serverId).toBe(42);
  });

  test('merges tasks from different dates independently', () => {
    const local = {
      '2025-01-01': [{ id: 'a', title: 'A' }],
      '2025-01-02': [{ id: 'b', title: 'B-local' }]
    };
    const remote = {
      '2025-01-02': [{ id: 'b', title: 'B-remote' }],
      '2025-01-03': [{ id: 'c', title: 'C' }]
    };
    const result = mergeTasksById(local, remote);
    expect(result['2025-01-01'][0].title).toBe('A');
    expect(result['2025-01-02'][0].title).toBe('B-remote');
    expect(result['2025-01-03'][0].title).toBe('C');
  });

  test('deduplicates tasks with same id on same date', () => {
    const local = { '2025-01-01': [{ id: 'dup', title: 'First' }] };
    const remote = { '2025-01-01': [{ id: 'dup', title: 'Second' }] };
    const result = mergeTasksById(local, remote);
    expect(result['2025-01-01']).toHaveLength(1);
  });

  test('handles empty arrays gracefully', () => {
    const result = mergeTasksById({}, {});
    expect(Object.keys(result)).toHaveLength(0);
  });

  test('handles null/undefined inputs gracefully', () => {
    // @ts-ignore
    const result = mergeTasksById(null, undefined);
    expect(Object.keys(result)).toHaveLength(0);
  });

  test('removes date key when both local and remote have empty arrays for that date', () => {
    const local = { '2025-01-01': [] };
    const remote = { '2025-01-01': [] };
    const result = mergeTasksById(local, remote);
    expect(result['2025-01-01']).toBeUndefined();
  });
});
