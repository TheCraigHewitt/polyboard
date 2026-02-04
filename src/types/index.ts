export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo?: string;
  createdBy: string;
  pipeline: Pipeline;
  priority?: Priority;
  tags: string[];
  notes: TaskNote[];
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'inbox' | 'active' | 'review' | 'done';
export type Pipeline = 'advisory' | 'content' | 'email' | 'general';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskNote {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface TasksFile {
  version: number;
  tasks: Task[];
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  type?: string;
  description?: string;
  enabled?: boolean;
}

export interface AgentStatus {
  agentId: string;
  status: 'working' | 'idle' | 'error' | 'offline';
  statusReason?: string;
  lastHeartbeat: string;
  currentTask?: string;
}

export interface OpenClawConfig {
  agents?: {
    list?: Agent[];
  };
  gateway?: {
    port?: number;
    authToken?: string;
  };
}

export interface SessionEvent {
  type: string;
  timestamp: string;
  data?: unknown;
}

export interface ActivityItem {
  id: string;
  agentId: string;
  type: 'message' | 'task_update' | 'error' | 'status_change';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export type Theme = 'light' | 'dark';

export interface AppState {
  theme: Theme;
  selectedAgentId: string | null;
  selectedTaskId: string | null;
  filterPipeline: Pipeline | 'all';
  filterAgent: string | 'all';
  sidebarCollapsed: boolean;
  panelCollapsed: boolean;
}
