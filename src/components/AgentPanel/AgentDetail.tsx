import { useState, useEffect } from 'react';
import { useAgents } from '../../hooks';
import { useStore } from '../../store';
import { StatusIndicator } from '../Sidebar/StatusIndicator';
import { ChatPanel } from './ChatPanel';
import { MemoryViewer } from './MemoryViewer';
import { apiFetch } from '../../services/api';

type Tab = 'chat' | 'memory' | 'identity';

export function AgentDetail() {
  const { selectedAgent, selectedAgentId, getAgentStatus } = useAgents();
  const setPanelCollapsed = useStore((state) => state.setPanelCollapsed);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAgentId) {
      apiFetch(`/api/agents/${selectedAgentId}/identity`)
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Chat' },
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
      <div className={`flex-1 ${activeTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto p-4'}`}>
        {activeTab === 'chat' && (
          <ChatPanel agentId={selectedAgentId} />
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
