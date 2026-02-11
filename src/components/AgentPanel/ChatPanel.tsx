import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChatMessage } from '../../types';
import { apiFetch } from '../../services/api';
import { parseSessionEvent, deduplicateMessages } from './chatUtils';

interface ChatPanelProps {
  agentId: string;
}

export function ChatPanel({ agentId }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Reset active ref and cancel polls when agentId changes or unmount
  useEffect(() => {
    activeRef.current = true;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    return () => {
      activeRef.current = false;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [agentId]);

  // Load conversation history
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setMessages([]);

      try {
        const sessionsRes = await apiFetch(
          `/api/agents/${agentId}/sessions?limit=1`
        );
        if (!sessionsRes.ok) {
          setLoading(false);
          return;
        }

        const { sessions } = await sessionsRes.json();
        if (!sessions?.length) {
          setLoading(false);
          return;
        }

        const transcriptRes = await apiFetch(
          `/api/sessions/transcript?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessions[0])}&maxLines=100`
        );
        if (!transcriptRes.ok || cancelled) {
          setLoading(false);
          return;
        }

        const { lines } = await transcriptRes.json();
        const parsed: ChatMessage[] = [];
        for (const line of lines) {
          const msg = parseSessionEvent(line);
          if (msg) parsed.push(msg);
        }

        parsed.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (!cancelled) setMessages(parsed);
      } catch {
        // Leave messages empty on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  // WebSocket listener for real-time messages
  useEffect(() => {
    function handleAgentMessage(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.agentId !== agentId) return;

      const msg: ChatMessage = {
        id: `ws-${Date.now()}`,
        role: 'assistant',
        content:
          typeof detail.content === 'string'
            ? detail.content
            : JSON.stringify(detail.content),
        timestamp: detail.timestamp || new Date().toISOString(),
      };

      setMessages((prev) => deduplicateMessages([...prev, msg]));
    }

    window.addEventListener('polyboard:agent_message', handleAgentMessage);
    return () => {
      window.removeEventListener('polyboard:agent_message', handleAgentMessage);
    };
  }, [agentId]);

  const pollForReply = useCallback(
    (afterTimestamp: string, attempt = 0) => {
      if (attempt >= 5 || !activeRef.current) return;

      pollTimerRef.current = setTimeout(async () => {
        if (!activeRef.current) return;
        try {
          const sessionsRes = await apiFetch(
            `/api/agents/${agentId}/sessions?limit=1`
          );
          if (!sessionsRes.ok) return;

          const { sessions } = await sessionsRes.json();
          if (!sessions?.length) return;

          const transcriptRes = await apiFetch(
            `/api/sessions/transcript?agentId=${encodeURIComponent(agentId)}&sessionId=${encodeURIComponent(sessions[0])}&maxLines=20`
          );
          if (!transcriptRes.ok) return;

          const { lines } = await transcriptRes.json();
          const newMessages: ChatMessage[] = [];
          for (const line of lines) {
            const msg = parseSessionEvent(line);
            if (
              msg &&
              msg.role === 'assistant' &&
              new Date(msg.timestamp).getTime() >
                new Date(afterTimestamp).getTime()
            ) {
              newMessages.push(msg);
            }
          }

          if (newMessages.length > 0) {
            setMessages((prev) =>
              deduplicateMessages([...prev, ...newMessages])
            );
            return;
          }
        } catch {
          // Continue polling
        }

        pollForReply(afterTimestamp, attempt + 1);
      }, 2000);
    },
    [agentId]
  );

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await apiFetch('/api/gateway/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          tool: 'send_message',
          params: { message: text },
        }),
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMsg.id ? { ...m, status: 'sent' } : m
          )
        );

        // Check if the response body contains a reply
        try {
          const data = await res.json();
          if (data?.reply) {
            const assistantMsg: ChatMessage = {
              id: `reply-${Date.now()}`,
              role: 'assistant',
              content:
                typeof data.reply === 'string'
                  ? data.reply
                  : JSON.stringify(data.reply),
              timestamp: new Date().toISOString(),
            };
            setMessages((prev) =>
              deduplicateMessages([...prev, assistantMsg])
            );
            return;
          }
        } catch {
          // No JSON body or no reply field — fall through to polling
        }

        pollForReply(userMsg.timestamp);
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMsg.id ? { ...m, status: 'error' } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMsg.id ? { ...m, status: 'error' } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-secondary text-sm">
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-text-secondary text-sm">
            No messages yet — send one to start a conversation
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-board-bg text-text-primary'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {msg.content}
              </p>
              <div
                className={`text-xs mt-1 ${
                  msg.role === 'user'
                    ? 'text-white/60'
                    : 'text-text-secondary'
                }`}
              >
                {new Date(msg.timestamp).toLocaleTimeString()}
                {msg.status === 'sending' && (
                  <span className="ml-2 inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin align-middle" />
                )}
                {msg.status === 'error' && (
                  <span className="ml-2 text-red-400">Failed to send</span>
                )}
              </div>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border-color">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Send message to agent..."
            className="flex-1 bg-board-bg border border-border-color rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
