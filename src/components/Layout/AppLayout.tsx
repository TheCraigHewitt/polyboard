import { ReactNode } from 'react';
import { Header } from './Header';
import { useStore } from '../../store';

interface AppLayoutProps {
  sidebar: ReactNode;
  board: ReactNode;
  panel: ReactNode;
}

export function AppLayout({ sidebar, board, panel }: AppLayoutProps) {
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const panelCollapsed = useStore((state) => state.panelCollapsed);

  return (
    <div className="h-screen flex flex-col bg-board-bg">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-64'
          } border-r border-border-color bg-card-bg transition-all duration-200 flex-shrink-0 overflow-hidden`}
        >
          {sidebar}
        </aside>

        {/* Main Board Area */}
        <main className="flex-1 overflow-auto">
          {board}
        </main>

        {/* Right Panel */}
        <aside
          className={`${
            panelCollapsed ? 'w-0' : 'w-96'
          } border-l border-border-color bg-card-bg transition-all duration-200 flex-shrink-0 overflow-hidden`}
        >
          {panel}
        </aside>
      </div>
    </div>
  );
}
