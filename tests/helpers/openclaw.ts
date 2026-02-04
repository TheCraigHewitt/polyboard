import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function createTempOpenClawDir(): Promise<string> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'polyboard-test-'));
  await fs.mkdir(path.join(base, 'agents'), { recursive: true });
  return base;
}

export async function writeOpenClawConfig(base: string, config: object) {
  const configPath = path.join(base, 'openclaw.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

export async function writeAgentStatus(base: string, agentId: string, status: object) {
  const agentDir = path.join(base, 'agents', agentId);
  await fs.mkdir(agentDir, { recursive: true });
  await fs.writeFile(path.join(agentDir, 'STATUS.json'), JSON.stringify(status, null, 2));
}

export async function writeAgentMemory(base: string, agentId: string, memory: string) {
  const agentDir = path.join(base, 'agents', agentId);
  await fs.mkdir(agentDir, { recursive: true });
  await fs.writeFile(path.join(agentDir, 'MEMORY.md'), memory);
}

export async function writeAgentIdentity(base: string, agentId: string, identity: string) {
  const agentDir = path.join(base, 'agents', agentId);
  await fs.mkdir(agentDir, { recursive: true });
  await fs.writeFile(path.join(agentDir, 'IDENTITY.md'), identity);
}

export async function writeAgentSession(
  base: string,
  agentId: string,
  sessionId: string,
  lines: string[]
) {
  const sessionDir = path.join(base, 'agents', agentId, 'sessions');
  await fs.mkdir(sessionDir, { recursive: true });
  await fs.writeFile(path.join(sessionDir, sessionId), lines.join('\n'));
}
