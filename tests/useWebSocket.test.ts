import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useWebSocket } from '../src/hooks/useWebSocket';
import { useStore } from '../src/store';

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose();
    }
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
}

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

describe('useWebSocket', () => {
  let originalFetch: typeof fetch | undefined;
  let originalWebSocket: typeof WebSocket | undefined;

  beforeEach(() => {
    resetStore();
    originalFetch = globalThis.fetch;
    originalWebSocket = globalThis.WebSocket;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
    if (originalWebSocket) {
      globalThis.WebSocket = originalWebSocket;
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('connects to gateway websocket and updates agent status', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ url: 'ws://localhost:1234' }),
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    const { result } = renderHook(() => useWebSocket());

    await waitFor(() => expect(MockWebSocket.instances.length).toBe(1));
    const instance = MockWebSocket.instances[0];

    act(() => {
      instance.readyState = MockWebSocket.OPEN;
      instance.onopen?.();
    });
    expect(useStore.getState().wsConnected).toBe(true);

    act(() => {
      instance.onmessage?.({
        data: JSON.stringify({
          type: 'agent_status',
          data: { agentId: 'agent1', status: 'working', lastHeartbeat: '2024-01-01T00:00:00Z' },
        }),
      });
    });
    expect(useStore.getState().agentStatuses.agent1.status).toBe('working');

    act(() => {
      result.current.disconnect();
    });
    expect(instance.close).toHaveBeenCalledTimes(1);
  });
});
