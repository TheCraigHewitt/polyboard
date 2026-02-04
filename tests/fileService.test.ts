/* @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import {
  readTasks,
  writeTasks,
  readSessionTranscript,
  resolveSessionPath,
} from '../src/services/fileService';
import { createTempOpenClawDir, writeAgentSession } from './helpers/openclaw';

let tempDir = '';

beforeEach(async () => {
  tempDir = await createTempOpenClawDir();
  process.env.OPENCLAW_CONFIG_PATH = tempDir;
});

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  delete process.env.OPENCLAW_CONFIG_PATH;
});

describe('fileService', () => {
  it('returns empty tasks when tasks file is missing', async () => {
    const data = await readTasks();
    expect(data.tasks).toEqual([]);
    expect(data.updatedAt).toBe(new Date(0).toISOString());
  });

  it('writes and reads tasks atomically', async () => {
    const tasks = [{
      id: 't1',
      title: 'Task',
      status: 'inbox',
      pipeline: 'general',
      createdBy: 'human',
      tags: [],
      notes: [],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }];
    const written = await writeTasks(tasks);
    expect(written.tasks.length).toBe(1);

    const readBack = await readTasks();
    expect(readBack.tasks.length).toBe(1);
    expect(readBack.tasks[0].id).toBe('t1');
  });

  it('tails session transcripts and blocks traversal', async () => {
    await writeAgentSession(tempDir, 'agent1', 'session1.jsonl', [
      '{"a":1}',
      '{"b":2}',
      '{"c":3}',
    ]);

    const lines = await readSessionTranscript('agent1', 'session1.jsonl', 2);
    expect(lines).toEqual(['{"b":2}', '{"c":3}']);

    expect(resolveSessionPath('agent1', '../secrets')).toBeNull();
  });

  it('only resolves sessions inside agent directory', async () => {
    await writeAgentSession(tempDir, 'agent1', 'session2.jsonl', ['a']);
    const resolved = resolveSessionPath('agent1', 'session2.jsonl');
    expect(resolved).toBe(path.join(tempDir, 'agents', 'agent1', 'sessions', 'session2.jsonl'));
  });
});
