import { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';

interface MemoryViewerProps {
  agentId: string;
}

export function MemoryViewer({ agentId }: MemoryViewerProps) {
  const [memory, setMemory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMemory() {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/agents/${agentId}/memory`);
        if (res.ok) {
          const { content } = await res.json();
          setMemory(content);
        } else {
          setMemory(null);
        }
      } catch {
        setMemory(null);
      } finally {
        setLoading(false);
      }
    }

    loadMemory();
  }, [agentId]);

  if (loading) {
    return (
      <div className="p-4 text-text-secondary text-sm">
        Loading memory...
      </div>
    );
  }

  if (!memory) {
    return (
      <div className="p-4 text-text-secondary text-sm text-center">
        No memory file found
      </div>
    );
  }

  return (
    <div className="p-4">
      <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono bg-board-bg p-3 rounded-lg overflow-auto max-h-96">
        {memory}
      </pre>
    </div>
  );
}
