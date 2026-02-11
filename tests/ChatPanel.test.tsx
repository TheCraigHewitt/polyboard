import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { ChatPanel } from '../src/components/AgentPanel/ChatPanel';

function mockResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  };
}

const AGENT_ID = 'agent-1';
const SESSION_ID = 'session-abc';

const userLine = JSON.stringify({
  type: 'user',
  timestamp: '2024-01-01T10:00:00Z',
  message: { content: 'hello' },
});
const assistantLine = JSON.stringify({
  type: 'assistant',
  timestamp: '2024-01-01T10:01:00Z',
  message: { content: 'hi there' },
});
const toolLine = JSON.stringify({
  type: 'tool_use',
  timestamp: '2024-01-01T10:00:30Z',
  message: { content: 'tool call' },
});

describe('ChatPanel', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
  });

  function setupHistoryResponses(lines: string[] = [userLine, assistantLine, toolLine]) {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ sessions: [SESSION_ID] }))
      .mockResolvedValueOnce(mockResponse({ lines }));
  }

  it('shows loading state initially', () => {
    fetchMock.mockResolvedValue(mockResponse({ sessions: [] }));
    render(<ChatPanel agentId={AGENT_ID} />);
    expect(screen.getByText('Loading conversation...')).toBeInTheDocument();
  });

  it('shows empty state when no sessions exist', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ sessions: [] }));

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    });
  });

  it('loads and displays conversation history', async () => {
    setupHistoryResponses();

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('hello')).toBeInTheDocument();
      expect(screen.getByText('hi there')).toBeInTheDocument();
    });

    // Tool events should not appear
    expect(screen.queryByText('tool call')).not.toBeInTheDocument();
  });

  it('displays messages in chronological order', async () => {
    const laterUser = JSON.stringify({
      type: 'user',
      timestamp: '2024-01-01T10:05:00Z',
      message: { content: 'later message' },
    });
    const earlierAssistant = JSON.stringify({
      type: 'assistant',
      timestamp: '2024-01-01T09:55:00Z',
      message: { content: 'earlier reply' },
    });

    setupHistoryResponses([laterUser, earlierAssistant]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('later message')).toBeInTheDocument();
      expect(screen.getByText('earlier reply')).toBeInTheDocument();
    });

    // Earlier message should appear first in DOM
    const messages = screen.getAllByText(/earlier reply|later message/);
    expect(messages[0].textContent).toBe('earlier reply');
    expect(messages[1].textContent).toBe('later message');
  });

  it('handles sessions API failure gracefully', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({}, false));

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    });
  });

  it('handles transcript API failure gracefully', async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse({ sessions: [SESSION_ID] }))
      .mockResolvedValueOnce(mockResponse({}, false));

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    });
  });

  it('sends a message and shows sending status', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Send message to agent...')).toBeInTheDocument();
    });

    // Set up the invoke response (will resolve later)
    let resolveInvoke!: (value: unknown) => void;
    const invokePromise = new Promise((resolve) => { resolveInvoke = resolve; });
    fetchMock.mockReturnValueOnce(invokePromise);

    const input = screen.getByPlaceholderText('Send message to agent...');
    fireEvent.change(input, { target: { value: 'test message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    // Message should appear in the chat
    await waitFor(() => {
      expect(screen.getByText('test message')).toBeInTheDocument();
    });

    // Input should be cleared
    expect(input).toHaveValue('');

    // Resolve the invoke call (no reply in body)
    await act(async () => {
      resolveInvoke(mockResponse({}));
    });
  });

  it('shows error status when send fails', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Send message to agent...')).toBeInTheDocument();
    });

    // Fail the invoke
    fetchMock.mockResolvedValueOnce(mockResponse({}, false));

    const input = screen.getByPlaceholderText('Send message to agent...');
    fireEvent.change(input, { target: { value: 'will fail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send')).toBeInTheDocument();
    });
  });

  it('shows error status when send throws', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Send message to agent...')).toBeInTheDocument();
    });

    fetchMock.mockRejectedValueOnce(new Error('network error'));

    const input = screen.getByPlaceholderText('Send message to agent...');
    fireEvent.change(input, { target: { value: 'network fail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send')).toBeInTheDocument();
    });
  });

  it('appends inline reply from gateway response', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Send message to agent...')).toBeInTheDocument();
    });

    fetchMock.mockResolvedValueOnce(mockResponse({ reply: 'agent says hi' }));

    const input = screen.getByPlaceholderText('Send message to agent...');
    fireEvent.change(input, { target: { value: 'greet me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('agent says hi')).toBeInTheDocument();
    });
  });

  it('does not send empty messages', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Send message to agent...')).toBeInTheDocument();
    });

    const sendButton = screen.getByRole('button', { name: 'Send' });
    expect(sendButton).toBeDisabled();

    // Try with whitespace only
    const input = screen.getByPlaceholderText('Send message to agent...');
    fireEvent.change(input, { target: { value: '   ' } });
    expect(sendButton).toBeDisabled();
  });

  it('sends message on Enter key', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Send message to agent...')).toBeInTheDocument();
    });

    fetchMock.mockResolvedValueOnce(mockResponse({}));

    const input = screen.getByPlaceholderText('Send message to agent...');
    fireEvent.change(input, { target: { value: 'enter test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('enter test')).toBeInTheDocument();
    });
  });

  it('does not send on Shift+Enter', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Send message to agent...')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('Send message to agent...');
    fireEvent.change(input, { target: { value: 'no send' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    // Message should not appear in chat (still just in input)
    expect(screen.queryByText('no send')).not.toBeInTheDocument();
  });

  it('picks up messages from WebSocket custom events', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('polyboard:agent_message', {
          detail: {
            agentId: AGENT_ID,
            content: 'ws reply',
            timestamp: '2024-01-01T12:00:00Z',
          },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('ws reply')).toBeInTheDocument();
    });
  });

  it('ignores WebSocket events for other agents', async () => {
    setupHistoryResponses([]);

    render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent('polyboard:agent_message', {
          detail: {
            agentId: 'other-agent',
            content: 'not for me',
            timestamp: '2024-01-01T12:00:00Z',
          },
        })
      );
    });

    // Should still show empty state
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });

  it('reloads history when agentId changes', async () => {
    setupHistoryResponses([userLine]);

    const { rerender } = render(<ChatPanel agentId={AGENT_ID} />);

    await waitFor(() => {
      expect(screen.getByText('hello')).toBeInTheDocument();
    });

    const newAssistant = JSON.stringify({
      type: 'assistant',
      timestamp: '2024-02-01T10:00:00Z',
      message: { content: 'different agent reply' },
    });

    fetchMock
      .mockResolvedValueOnce(mockResponse({ sessions: ['session-xyz'] }))
      .mockResolvedValueOnce(mockResponse({ lines: [newAssistant] }));

    rerender(<ChatPanel agentId="agent-2" />);

    await waitFor(() => {
      expect(screen.getByText('different agent reply')).toBeInTheDocument();
    });

    // Old agent's messages should be gone
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });
});
