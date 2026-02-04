import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, Agent, AgentStatus, Theme, Pipeline, TaskStatus } from '../types';

interface AppStore {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  agentStatuses: Record<string, AgentStatus>;
  setAgentStatus: (agentId: string, status: AgentStatus) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;

  // Selection
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;

  // Filters
  filterPipeline: Pipeline | 'all';
  setFilterPipeline: (pipeline: Pipeline | 'all') => void;
  filterAgent: string | 'all';
  setFilterAgent: (agentId: string | 'all') => void;

  // Layout
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  panelCollapsed: boolean;
  setPanelCollapsed: (collapsed: boolean) => void;

  // Connection
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
  openclawPath: string | null;
  setOpenclawPath: (path: string | null) => void;
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      // Agents
      agents: [],
      setAgents: (agents) => set({ agents }),
      agentStatuses: {},
      setAgentStatus: (agentId, status) =>
        set((state) => ({
          agentStatuses: { ...state.agentStatuses, [agentId]: status },
        })),

      // Tasks
      tasks: [],
      setTasks: (tasks) => set({ tasks }),
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
      updateTask: (taskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        })),
      deleteTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
        })),
      moveTask: (taskId, newStatus) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t
          ),
        })),

      // Selection
      selectedAgentId: null,
      setSelectedAgentId: (id) => set({ selectedAgentId: id }),
      selectedTaskId: null,
      setSelectedTaskId: (id) => set({ selectedTaskId: id }),

      // Filters
      filterPipeline: 'all',
      setFilterPipeline: (pipeline) => set({ filterPipeline: pipeline }),
      filterAgent: 'all',
      setFilterAgent: (agentId) => set({ filterAgent: agentId }),

      // Layout
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      panelCollapsed: true,
      setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),

      // Connection
      wsConnected: false,
      setWsConnected: (connected) => set({ wsConnected: connected }),
      openclawPath: null,
      setOpenclawPath: (path) => set({ openclawPath: path }),
    }),
    {
      name: 'polyboard-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        panelCollapsed: state.panelCollapsed,
        filterPipeline: state.filterPipeline,
        filterAgent: state.filterAgent,
      }),
    }
  )
);
