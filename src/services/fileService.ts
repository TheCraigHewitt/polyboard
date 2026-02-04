import fs from 'fs';
import path from 'path';
import os from 'os';
import type { TasksFile, AgentStatus, OpenClawConfig, Task } from '../types';

export function getOpenClawPath(): string {
  return process.env.OPENCLAW_CONFIG_PATH || path.join(os.homedir(), '.openclaw');
}

export function getMissionControlPath(): string {
  return path.join(getOpenClawPath(), 'mission-control');
}

export function getTasksFilePath(): string {
  return path.join(getMissionControlPath(), 'tasks.json');
}

export function getAgentPath(agentId: string): string {
  return path.join(getOpenClawPath(), 'agents', agentId);
}

export function getAgentStatusPath(agentId: string): string {
  return path.join(getAgentPath(agentId), 'STATUS.json');
}

export function ensureMissionControlDir(): void {
  const dir = getMissionControlPath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readOpenClawConfig(): OpenClawConfig | null {
  const configPath = path.join(getOpenClawPath(), 'openclaw.json');
  try {
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Failed to read OpenClaw config:', err);
    return null;
  }
}

export function readTasks(): TasksFile {
  const filePath = getTasksFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      return { version: 1, tasks: [], updatedAt: new Date().toISOString() };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Failed to read tasks:', err);
    return { version: 1, tasks: [], updatedAt: new Date().toISOString() };
  }
}

export function writeTasks(tasks: Task[]): void {
  ensureMissionControlDir();
  const filePath = getTasksFilePath();
  const tempPath = `${filePath}.tmp`;

  const data: TasksFile = {
    version: 1,
    tasks,
    updatedAt: new Date().toISOString(),
  };

  // Atomic write: write to temp file, then rename
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
  fs.renameSync(tempPath, filePath);
}

export function readAgentStatus(agentId: string): AgentStatus | null {
  const statusPath = getAgentStatusPath(agentId);
  try {
    if (!fs.existsSync(statusPath)) {
      return null;
    }
    const content = fs.readFileSync(statusPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to read status for agent ${agentId}:`, err);
    return null;
  }
}

export function readAgentIdentity(agentId: string): string | null {
  const agentPath = getAgentPath(agentId);
  const identityPath = path.join(agentPath, 'IDENTITY.md');
  const soulPath = path.join(agentPath, 'SOUL.md');

  try {
    if (fs.existsSync(identityPath)) {
      return fs.readFileSync(identityPath, 'utf-8');
    }
    if (fs.existsSync(soulPath)) {
      return fs.readFileSync(soulPath, 'utf-8');
    }
    return null;
  } catch {
    return null;
  }
}

export function readAgentMemory(agentId: string): string | null {
  const memoryPath = path.join(getAgentPath(agentId), 'MEMORY.md');
  try {
    if (!fs.existsSync(memoryPath)) {
      return null;
    }
    return fs.readFileSync(memoryPath, 'utf-8');
  } catch {
    return null;
  }
}

export function getRecentSessions(agentId: string, limit = 10): string[] {
  const sessionsPath = path.join(getAgentPath(agentId), 'sessions');
  try {
    if (!fs.existsSync(sessionsPath)) {
      return [];
    }
    const files = fs.readdirSync(sessionsPath)
      .filter((f: string) => f.endsWith('.jsonl'))
      .sort()
      .reverse()
      .slice(0, limit);
    return files.map((f: string) => path.join(sessionsPath, f));
  } catch {
    return [];
  }
}

export function readSessionTranscript(sessionPath: string, maxLines = 50): string[] {
  try {
    if (!fs.existsSync(sessionPath)) {
      return [];
    }
    const content = fs.readFileSync(sessionPath, 'utf-8');
    const lines = content.trim().split('\n');
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}
