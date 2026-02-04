import { useStore } from '../../store';

export function Header() {
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);
  const wsConnected = useStore((state) => state.wsConnected);
  const filterPipeline = useStore((state) => state.filterPipeline);
  const setFilterPipeline = useStore((state) => state.setFilterPipeline);

  const pipelines = [
    { value: 'all', label: 'All Pipelines' },
    { value: 'advisory', label: 'Advisory' },
    { value: 'content', label: 'Content' },
    { value: 'email', label: 'Email' },
    { value: 'general', label: 'General' },
  ] as const;

  return (
    <header className="h-14 border-b border-border-color bg-card-bg flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-text-primary">Polyboard</h1>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              wsConnected ? 'bg-green-500' : 'bg-gray-400'
            }`}
            title={wsConnected ? 'Connected to gateway' : 'Disconnected'}
          />
          <span className="text-xs text-text-secondary">
            {wsConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Pipeline Filter */}
        <select
          value={filterPipeline}
          onChange={(e) => setFilterPipeline(e.target.value as typeof filterPipeline)}
          className="bg-board-bg border border-border-color rounded px-2 py-1 text-sm text-text-primary"
        >
          {pipelines.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 hover:bg-board-bg rounded transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
