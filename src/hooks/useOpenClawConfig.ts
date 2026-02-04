import { useEffect, useState } from 'react';
import type { OpenClawConfig } from '../types';
import { useStore } from '../store';

export function useOpenClawConfig() {
  const [config, setConfig] = useState<OpenClawConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setOpenclawPath, setAgents } = useStore();

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error('Failed to load OpenClaw config');
        }
        const data = await response.json();
        setConfig(data.config);
        setOpenclawPath(data.path);

        if (data.config?.agents?.list) {
          setAgents(data.config.agents.list);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [setOpenclawPath, setAgents]);

  return { config, loading, error };
}
