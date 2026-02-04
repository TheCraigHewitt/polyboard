import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTasks } from '../src/hooks/useTasks';
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

function mockFetchSequence(responses: Array<{ ok: boolean; status: number; json: () => Promise<unknown> }>) {
  let idx = 0;
  return vi.fn(async () => {
    const response = responses[idx];
    idx += 1;
    return response;
  });
}

describe('useTasks', () => {
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    resetStore();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not save immediately after initial load', async () => {
    const fetchMock = mockFetchSequence([
      {
        ok: true,
        status: 200,
        json: async () => ({
          tasks: [{
            id: 't1',
            title: 'Task',
            status: 'inbox',
            pipeline: 'general',
            createdBy: 'human',
            tags: [],
            notes: [],
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          }],
          updatedAt: 't0',
        }),
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    renderHook(() => useTasks());

    await waitFor(() => expect(useStore.getState().tasks.length).toBe(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('saves tasks with baseUpdatedAt after changes', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      if (!init || !init.method) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tasks: [],
            updatedAt: 't0',
          }),
        };
      }
      const body = init.body ? JSON.parse(init.body.toString()) : {};
      expect(body.baseUpdatedAt).toBe('t0');
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, updatedAt: 't1' }),
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    const { result } = renderHook(() => useTasks());

    await waitFor(() => expect(useStore.getState().tasks.length).toBe(0));

    act(() => {
      result.current.createTask('New task');
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    await waitFor(() => {
      const hasPut = fetchMock.mock.calls.some((call) => call[1]?.method === 'PUT');
      expect(hasPut).toBe(true);
    });
  });

  it('reloads tasks on conflict', async () => {
    let putCalled = false;
    const fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      if (!init || !init.method) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            tasks: [],
            updatedAt: 't0',
          }),
        };
      }
      if (!putCalled) {
        putCalled = true;
        return {
          ok: false,
          status: 409,
          json: async () => ({
            current: {
              tasks: [{
                id: 'server',
                title: 'Server task',
                status: 'inbox',
                pipeline: 'general',
                createdBy: 'human',
                tags: [],
                notes: [],
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
              }],
              updatedAt: 't1',
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, updatedAt: 't2' }),
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    const { result } = renderHook(() => useTasks());
    await waitFor(() => expect(useStore.getState().tasks.length).toBe(0));

    act(() => {
      result.current.createTask('Local task');
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    await waitFor(() => expect(useStore.getState().tasks[0].id).toBe('server'));
  });
});
