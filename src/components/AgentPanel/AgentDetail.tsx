import { useState, useEffect } from 'react';
import { useAgents } from '../../hooks';
import { useStore } from '../../store';
import { StatusIndicator } from '../Sidebar/StatusIndicator';
import { ActivityFeed } from './ActivityFeed';
import { MemoryViewer } from './MemoryViewer';

type Tab = 'activity' | 'memory' | 'identity';

export function AgentDetail() {
  const { selectedAgent, selectedAgentId, getAgentStatus } = useAgents();
  const setPanelCollapsed = useStore((state) => state.setPanelCollapsed);
  const [activeTab, setActiveTab] = useState<Tab>('activity');
  const [identity, setIdentity] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (selectedAgentId) {
      fetch(`/api/agents/${selectedAgentId}/identity`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => setIdentity(data?.content || null))
        .catch(() => setIdentity(null));
    }
  }, [selectedAgentId]);

  if (!selectedAgent || !selectedAgentId) {
    return (
      <div className="h-full flex items-center justify-center text-text-secondary">
        <p>Select an agent to view details</p>
      </div>
    );
  }

  const status = getAgentStatus(selectedAgentId);

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch('/api/gateway/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          tool: 'send_message',
          params: { message: message.trim() },
        }),
      });

      if (res.ok) {
        setMessage('');
        // Could show success feedback
      } else {
        // Could show error feedback
        console.error('Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'activity', label: 'Activity' },
    { id: 'memory', label: 'Memory' },
    { id: 'identity', label: 'Identity' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border-color">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-medium text-lg">
              {selectedAgent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-medium text-text-primary">{selectedAgent.name}</h2>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <StatusIndicator status={status.status} size="sm" />
                <span>{status.statusReason || status.status}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setPanelCollapsed(true)}
            className="p-1 hover:bg-board-bg rounded transition-colors"
            title="Close panel"
          >
            <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {selectedAgent.description && (
          <p className="text-sm text-text-secondary">{selectedAgent.description}</p>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-b border-border-color">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Send message to agent..."
            className="flex-1 bg-board-bg border border-border-color rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            disabled={sending}
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !message.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-color">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'activity' && (
          <ActivityFeed agentId={selectedAgentId} />
        )}
        {activeTab === 'memory' && (
          <MemoryViewer agentId={selectedAgentId} />
        )}
        {activeTab === 'identity' && (
          <div>
            {identity ? (
              <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono bg-board-bg p-3 rounded-lg overflow-auto">
                {identity}
              </pre>
            ) : (
              <div className="text-text-secondary text-sm text-center">
                No identity file found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
