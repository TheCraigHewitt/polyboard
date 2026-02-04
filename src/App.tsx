import { useEffect } from 'react';
import { AppLayout } from './components/Layout';
import { AgentSidebar } from './components/Sidebar';
import { KanbanBoard } from './components/Board';
import { AgentDetail } from './components/AgentPanel';
import { useOpenClawConfig, useAgentStatus, useWebSocket } from './hooks';
import { useStore } from './store';

function App() {
  const { loading, error } = useOpenClawConfig();
  const theme = useStore((state) => state.theme);

  // Initialize hooks
  useAgentStatus();
  useWebSocket();

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-board-bg">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-board-bg">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-xl font-semibold text-text-primary mb-2">
            OpenClaw Not Found
          </h1>
          <p className="text-text-secondary mb-4">{error}</p>
          <p className="text-sm text-text-secondary">
            Make sure OpenClaw is installed and{' '}
            <code className="bg-card-bg px-1 rounded">~/.openclaw/openclaw.json</code>{' '}
            exists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      sidebar={<AgentSidebar />}
      board={<KanbanBoard />}
      panel={<AgentDetail />}
    />
  );
}

export default App;
