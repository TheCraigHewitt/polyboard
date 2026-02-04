import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAgentStatus } from '../src/hooks/useAgentStatus';
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

describe('useAgentStatus', () => {
  let originalFetch: typeof fetch | undefined;

  beforeEach(() => {
    resetStore();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('polls agent statuses in parallel', async () => {
    useStore.setState({
      agents: [
        { id: 'agent1', name: 'Agent 1' },
        { id: 'agent2', name: 'Agent 2' },
      ],
    });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        agentId: 'agent1',
        status: 'idle',
        lastHeartbeat: '2024-01-01T00:00:00Z',
      }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    renderHook(() => useAgentStatus());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
