import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import type { TasksFile, AgentStatus, OpenClawConfig, Task } from '../types';
import { normalizeTasksFile } from './taskValidation.js';

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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fsp.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureMissionControlDir(): Promise<void> {
  const dir = getMissionControlPath();
  if (!(await pathExists(dir))) {
    await fsp.mkdir(dir, { recursive: true });
  }
}

export async function readOpenClawConfig(): Promise<OpenClawConfig | null> {
  const configPath = path.join(getOpenClawPath(), 'openclaw.json');
  try {
    if (!(await pathExists(configPath))) {
      return null;
    }
    const content = await fsp.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Failed to read OpenClaw config:', err);
    return null;
  }
}

export async function readTasks(): Promise<TasksFile> {
  const filePath = getTasksFilePath();
  const emptyUpdatedAt = new Date(0).toISOString();
  try {
    if (!(await pathExists(filePath))) {
      return { version: 1, tasks: [], updatedAt: emptyUpdatedAt };
    }
    const content = await fsp.readFile(filePath, 'utf-8');
    return normalizeTasksFile(JSON.parse(content));
  } catch (err) {
    console.error('Failed to read tasks:', err);
    return { version: 1, tasks: [], updatedAt: emptyUpdatedAt };
  }
}

export async function writeTasks(tasks: Task[]): Promise<TasksFile> {
  await ensureMissionControlDir();
  const filePath = getTasksFilePath();
  const tempPath = `${filePath}.tmp`;

  const data: TasksFile = {
    version: 1,
    tasks,
    updatedAt: new Date().toISOString(),
  };

  // Atomic write: write to temp file, then rename
  await fsp.writeFile(tempPath, JSON.stringify(data, null, 2));
  await fsp.rename(tempPath, filePath);
  return data;
}

export async function readAgentStatus(agentId: string): Promise<AgentStatus | null> {
  const statusPath = getAgentStatusPath(agentId);
  try {
    if (!(await pathExists(statusPath))) {
      return null;
    }
    const content = await fsp.readFile(statusPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to read status for agent ${agentId}:`, err);
    return null;
  }
}

export async function readAgentIdentity(agentId: string): Promise<string | null> {
  const agentPath = getAgentPath(agentId);
  const identityPath = path.join(agentPath, 'IDENTITY.md');
  const soulPath = path.join(agentPath, 'SOUL.md');

  try {
    if (await pathExists(identityPath)) {
      return await fsp.readFile(identityPath, 'utf-8');
    }
    if (await pathExists(soulPath)) {
      return await fsp.readFile(soulPath, 'utf-8');
    }
    return null;
  } catch {
    return null;
  }
}

export async function readAgentMemory(agentId: string): Promise<string | null> {
  const memoryPath = path.join(getAgentPath(agentId), 'MEMORY.md');
  try {
    if (!(await pathExists(memoryPath))) {
      return null;
    }
    return await fsp.readFile(memoryPath, 'utf-8');
  } catch {
    return null;
  }
}

export async function getRecentSessions(agentId: string, limit = 10): Promise<string[]> {
  const sessionsPath = path.join(getAgentPath(agentId), 'sessions');
  try {
    if (!(await pathExists(sessionsPath))) {
      return [];
    }
    const files = await fsp.readdir(sessionsPath);
    return files
      .filter((f: string) => f.endsWith('.jsonl'))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}

function isSafeSessionId(sessionId: string): boolean {
  if (!sessionId) return false;
  if (sessionId.includes('..')) return false;
  if (sessionId.includes('/') || sessionId.includes('\\')) return false;
  return true;
}

export function resolveSessionPath(agentId: string, sessionId: string): string | null {
  if (!isSafeSessionId(sessionId)) {
    return null;
  }
  const sessionsPath = path.join(getAgentPath(agentId), 'sessions');
  const resolved = path.resolve(sessionsPath, sessionId);
  if (!resolved.startsWith(path.resolve(sessionsPath) + path.sep)) {
    return null;
  }
  return resolved;
}

export async function readSessionTranscript(
  agentId: string,
  sessionId: string,
  maxLines = 50
): Promise<string[]> {
  const sessionPath = resolveSessionPath(agentId, sessionId);
  if (!sessionPath) {
    return [];
  }
  try {
    if (!(await pathExists(sessionPath))) {
      return [];
    }

    const stream = fs.createReadStream(sessionPath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const buffer: string[] = [];

    for await (const line of rl) {
      if (buffer.length >= maxLines) {
        buffer.shift();
      }
      buffer.push(line);
    }

    return buffer;
  } catch {
    return [];
  }
}
