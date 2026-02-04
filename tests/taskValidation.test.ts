/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { normalizeTasksFile, normalizeTasksPayload } from '../src/services/taskValidation';

describe('task validation', () => {
  it('rejects invalid payloads', () => {
    expect(normalizeTasksPayload('nope')).toBeNull();
    expect(normalizeTasksPayload([{}])).toBeNull();
  });

  it('accepts valid tasks and preserves required fields', () => {
    const tasks = normalizeTasksPayload([{
      id: 't1',
      title: 'Task',
      status: 'inbox',
      pipeline: 'general',
      createdBy: 'human',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      tags: ['a', 1, 'b'],
      notes: [{
        id: 'n1',
        authorId: 'human',
        content: 'note',
        createdAt: '2024-01-01T00:00:00Z',
      }],
    }]);

    expect(tasks).not.toBeNull();
    expect(tasks?.[0].tags).toEqual(['a', 'b']);
    expect(tasks?.[0].notes.length).toBe(1);
  });

  it('normalizes tasks file with invalid entries filtered', () => {
    const data = normalizeTasksFile({
      version: 2,
      tasks: [
        {
          id: 't1',
          title: 'Valid',
          status: 'active',
          pipeline: 'general',
          createdBy: 'human',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          tags: [],
          notes: [],
        },
        {
          id: 'invalid',
        },
      ],
      updatedAt: '2024-01-01T00:00:00Z',
    });

    expect(data.version).toBe(2);
    expect(data.tasks.length).toBe(1);
    expect(data.tasks[0].id).toBe('t1');
  });
});
