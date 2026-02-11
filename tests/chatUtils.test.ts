import { describe, it, expect } from 'vitest';
import {
  normalizeMessageContent,
  parseSessionEvent,
  deduplicateMessages,
} from '../src/components/AgentPanel/chatUtils';
import type { ChatMessage } from '../src/types';

describe('normalizeMessageContent', () => {
  it('returns string content as-is', () => {
    expect(normalizeMessageContent('hello')).toBe('hello');
  });

  it('joins array content text fields', () => {
    const content = [{ text: 'hello ' }, { text: 'world' }];
    expect(normalizeMessageContent(content)).toBe('hello world');
  });

  it('returns empty string for empty array', () => {
    expect(normalizeMessageContent([])).toBe('');
  });

  it('returns empty string for unexpected types', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeMessageContent(42 as any)).toBe('');
  });
});

describe('parseSessionEvent', () => {
  it('parses a user message event', () => {
    const line = JSON.stringify({
      type: 'user',
      timestamp: '2024-01-01T10:00:00Z',
      message: { content: 'hello agent' },
    });

    const result = parseSessionEvent(line);
    expect(result).toEqual({
      id: '2024-01-01T10:00:00Z-user',
      role: 'user',
      content: 'hello agent',
      timestamp: '2024-01-01T10:00:00Z',
    });
  });

  it('parses an assistant message with array content', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2024-01-01T10:01:00Z',
      message: { content: [{ text: 'I will ' }, { text: 'help you' }] },
    });

    const result = parseSessionEvent(line);
    expect(result).not.toBeNull();
    expect(result!.role).toBe('assistant');
    expect(result!.content).toBe('I will help you');
  });

  it('returns null for non-user/assistant events', () => {
    const line = JSON.stringify({
      type: 'tool_use',
      timestamp: '2024-01-01T10:00:00Z',
      message: { content: 'some tool call' },
    });
    expect(parseSessionEvent(line)).toBeNull();
  });

  it('returns null for events without message content', () => {
    const line = JSON.stringify({
      type: 'user',
      timestamp: '2024-01-01T10:00:00Z',
    });
    expect(parseSessionEvent(line)).toBeNull();
  });

  it('returns null for whitespace-only content', () => {
    const line = JSON.stringify({
      type: 'assistant',
      timestamp: '2024-01-01T10:00:00Z',
      message: { content: '   ' },
    });
    expect(parseSessionEvent(line)).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseSessionEvent('not json{')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSessionEvent('')).toBeNull();
  });

  it('falls back to Date.now for missing timestamp', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: 'no timestamp' },
    });

    const before = Date.now();
    const result = parseSessionEvent(line);
    expect(result).not.toBeNull();
    expect(result!.content).toBe('no timestamp');
    // ID should contain a numeric timestamp fallback
    expect(result!.id).toMatch(/^\d+-user$/);
  });
});

describe('deduplicateMessages', () => {
  it('removes duplicate messages by id, keeping latest', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'first', timestamp: '2024-01-01T10:00:00Z' },
      { id: '2', role: 'assistant', content: 'response', timestamp: '2024-01-01T10:01:00Z' },
      { id: '1', role: 'user', content: 'updated', timestamp: '2024-01-01T10:02:00Z' },
    ];

    const result = deduplicateMessages(messages);
    expect(result).toHaveLength(2);
    expect(result.find((m) => m.id === '1')!.content).toBe('updated');
  });

  it('preserves order based on first occurrence position', () => {
    const messages: ChatMessage[] = [
      { id: 'a', role: 'user', content: 'first', timestamp: '2024-01-01T10:00:00Z' },
      { id: 'b', role: 'assistant', content: 'second', timestamp: '2024-01-01T10:01:00Z' },
      { id: 'c', role: 'user', content: 'third', timestamp: '2024-01-01T10:02:00Z' },
    ];

    const result = deduplicateMessages(messages);
    expect(result.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('handles empty array', () => {
    expect(deduplicateMessages([])).toEqual([]);
  });

  it('handles single message', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'only', timestamp: '2024-01-01T10:00:00Z' },
    ];
    expect(deduplicateMessages(messages)).toEqual(messages);
  });
});
