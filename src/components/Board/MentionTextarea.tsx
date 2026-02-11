import { useState, useRef, useCallback, useEffect } from 'react';
import type { Agent } from '../../types';

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  agents: Agent[];
}

export function MentionTextarea({ value, onChange, onSubmit, placeholder, agents }: MentionTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = agents.filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  const findMentionQuery = useCallback((text: string, cursorPos: number): string | null => {
    const before = text.slice(0, cursorPos);
    const match = before.match(/@(\w*)$/);
    return match ? match[1] : null;
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart;
    const mentionQuery = findMentionQuery(newValue, cursorPos);
    if (mentionQuery !== null) {
      setQuery(mentionQuery);
      setShowDropdown(true);
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
    }
  }, [onChange, findMentionQuery]);

  const insertMention = useCallback((agent: Agent) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const before = value.slice(0, cursorPos);
    const after = value.slice(cursorPos);
    const mentionStart = before.lastIndexOf('@');
    const newValue = before.slice(0, mentionStart) + `@${agent.name} ` + after;

    onChange(newValue);
    setShowDropdown(false);

    // Restore focus after state update
    requestAnimationFrame(() => {
      const newCursorPos = mentionStart + agent.name.length + 2;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filtered[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  }, [showDropdown, filtered, selectedIndex, insertMention, onSubmit]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current && !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={2}
        className="w-full bg-board-bg border border-border-color rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent resize-none"
      />
      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-1 w-56 bg-card-bg border border-border-color rounded-lg shadow-lg overflow-hidden z-50"
        >
          {filtered.map((agent, i) => (
            <button
              key={agent.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(agent);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                i === selectedIndex
                  ? 'bg-accent/20 text-text-primary'
                  : 'text-text-secondary hover:bg-board-bg'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-white text-xs shrink-0">
                {agent.name.charAt(0).toUpperCase()}
              </div>
              {agent.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
