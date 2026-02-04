import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { AgentStatus } from '../types';

const POLL_INTERVAL = 5000; // 5 seconds

export function useAgentStatus() {
  const agents = useStore((state) => state.agents);
  const setAgentStatus = useStore((state) => state.setAgentStatus);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function pollStatus() {
      for (const agent of agents) {
        try {
          const response = await fetch(`/api/agents/${agent.id}/status`);
          if (response.ok) {
            const status: AgentStatus = await response.json();
            setAgentStatus(agent.id, status);
          } else {
            // No status file, mark as offline
            setAgentStatus(agent.id, {
              agentId: agent.id,
              status: 'offline',
              lastHeartbeat: new Date().toISOString(),
            });
          }
        } catch {
          setAgentStatus(agent.id, {
            agentId: agent.id,
            status: 'offline',
            lastHeartbeat: new Date().toISOString(),
          });
        }
      }
    }

    // Initial poll
    if (agents.length > 0) {
      pollStatus();
    }

    // Set up interval
    intervalRef.current = setInterval(pollStatus, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [agents, setAgentStatus]);
}
