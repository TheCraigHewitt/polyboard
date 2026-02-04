/* @vitest-environment node */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '../src/store';

const resetStore = () => {
  useStore.setState({
    theme: 'dark',
    agents: [],
    agentStatuses: {},
    tasks: [],
    selectedAgentId: null,
    selectedTaskId: null,
    filterPipeline: 'all',
    filterAgent: 'all',
    sidebarCollapsed: false,
    panelCollapsed: true,
    wsConnected: false,
    openclawPath: null,
  });
};

describe('store', () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  it('adds and updates tasks', () => {
    useStore.getState().addTask({
      id: 't1',
      title: 'Task',
      status: 'inbox',
      createdBy: 'human',
      pipeline: 'general',
      tags: [],
      notes: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    expect(useStore.getState().tasks.length).toBe(1);

    vi.setSystemTime(new Date('2024-01-01T01:00:00Z'));
    useStore.getState().updateTask('t1', { title: 'Updated' });
    const task = useStore.getState().tasks[0];
    expect(task.title).toBe('Updated');
    expect(task.updatedAt).toBe('2024-01-01T01:00:00.000Z');
  });

  it('moves tasks and updates timestamps', () => {
    useStore.getState().addTask({
      id: 't2',
      title: 'Task',
      status: 'inbox',
      createdBy: 'human',
      pipeline: 'general',
      tags: [],
      notes: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });

    vi.setSystemTime(new Date('2024-01-01T02:00:00Z'));
    useStore.getState().moveTask('t2', 'active');
    const task = useStore.getState().tasks[0];
    expect(task.status).toBe('active');
    expect(task.updatedAt).toBe('2024-01-01T02:00:00.000Z');
  });
});
