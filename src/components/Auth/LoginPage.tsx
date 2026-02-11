import { useState, FormEvent } from 'react';
import { useStore } from '@/store';

export function LoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuthenticated = useStore((state) => state.setAuthenticated);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (res.status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
        return;
      }

      if (!res.ok) {
        setError('Invalid token');
        return;
      }

      // Store token for bearer auth (WebSocket, etc.)
      window.localStorage.setItem('polyboardApiToken', token);
      setAuthenticated(true);
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-board-bg">
      <div className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-text-primary mb-1 text-center">
          Polyboard
        </h1>
        <p className="text-sm text-text-secondary mb-6 text-center">
          Enter your API token to continue
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="API Token"
            autoFocus
            className="w-full px-3 py-2 rounded border border-border-color bg-card-bg text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />

          {error && (
            <p className="mt-2 text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full mt-4 px-4 py-2 rounded bg-accent text-white font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
