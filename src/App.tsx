import { useEffect, useState } from 'react';
import { AppLayout } from './components/Layout';
import { AgentSidebar } from './components/Sidebar';
import { KanbanBoard } from './components/Board';
import { AgentDetail } from './components/AgentPanel';
import { LoginPage } from './components/Auth/LoginPage';
import { useOpenClawConfig, useAgentStatus, useWebSocket } from './hooks';
import { useStore } from './store';

function Dashboard() {
  const { loading, error } = useOpenClawConfig();

  useAgentStatus();
  useWebSocket();

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

function App() {
  const theme = useStore((state) => state.theme);
  const authenticated = useStore((state) => state.authenticated);
  const requiresAuth = useStore((state) => state.requiresAuth);
  const setAuthenticated = useStore((state) => state.setAuthenticated);
  const setRequiresAuth = useStore((state) => state.setRequiresAuth);
  const [authChecked, setAuthChecked] = useState(false);

  // Apply theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Check auth state on mount
  useEffect(() => {
    fetch('/api/auth/check', { credentials: 'include', headers: getAuthHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setRequiresAuth(data.required);
        setAuthenticated(!data.required || data.authenticated);
      })
      .catch(() => {
        // Fail secure: require auth if we can't verify
        setRequiresAuth(true);
        setAuthenticated(false);
      })
      .finally(() => setAuthChecked(true));
  }, [setAuthenticated, setRequiresAuth]);

  // Listen for 401 events from apiFetch
  useEffect(() => {
    function handleUnauthorized() {
      window.localStorage.removeItem('polyboardApiToken');
      setAuthenticated(false);
      setRequiresAuth(true);
    }
    window.addEventListener('polyboard:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('polyboard:unauthorized', handleUnauthorized);
  }, [setAuthenticated, setRequiresAuth]);

  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-board-bg">
        <div className="text-text-primary">Loading...</div>
      </div>
    );
  }

  if (requiresAuth && !authenticated) {
    return <LoginPage />;
  }

  return <Dashboard />;
}

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined'
    ? window.localStorage.getItem('polyboardApiToken')
    : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default App;
