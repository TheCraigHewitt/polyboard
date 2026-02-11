import type { ChatMessage } from '../../types';

export function normalizeMessageContent(
  content: string | Array<{ text: string }>
): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => c.text).join('');
  return '';
}

export function parseSessionEvent(line: string): ChatMessage | null {
  try {
    const event = JSON.parse(line);
    if (event.type !== 'user' && event.type !== 'assistant') return null;

    const raw = event.message?.content;
    if (!raw) return null;

    const content = normalizeMessageContent(raw).trim();
    if (!content) return null;

    return {
      id: `${event.timestamp || Date.now()}-${event.type}`,
      role: event.type as 'user' | 'assistant',
      content,
      timestamp: event.timestamp || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Map<string, ChatMessage>();
  for (const msg of messages) {
    seen.set(msg.id, msg);
  }
  return Array.from(seen.values());
}
