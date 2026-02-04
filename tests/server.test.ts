/* @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import { createServer } from '../src/server';
import { createTempOpenClawDir, writeOpenClawConfig, writeAgentStatus, writeAgentSession } from './helpers/openclaw';
import { inject } from './helpers/inject';

let tempDir = '';
let originalFetch: typeof fetch | undefined;

function createApp() {
  return createServer({ host: '127.0.0.1' });
}

async function requestJson(app: ReturnType<typeof createApp>, method: string, url: string, body?: unknown, headers?: Record<string, string>) {
  const payload = body ? JSON.stringify(body) : undefined;
  const normalizedHeaders: Record<string, string> = {};
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }
  }
  if (payload) {
    normalizedHeaders['content-type'] = 'application/json';
    normalizedHeaders['content-length'] = String(Buffer.byteLength(payload));
  }
  const res = await inject(app, {
    method,
    url,
    headers: normalizedHeaders,
    body: payload,
  });
  const json = res.text ? JSON.parse(res.text) : null;
  return { ...res, json };
}

beforeEach(async () => {
  tempDir = await createTempOpenClawDir();
  process.env.OPENCLAW_CONFIG_PATH = tempDir;
  await writeOpenClawConfig(tempDir, {
    agents: { list: [{ id: 'agent1', name: 'Agent 1' }] },
    gateway: { port: 18789, auth: { token: 'secret-token' } },
  });
  originalFetch = globalThis.fetch;
});

afterEach(async () => {
  if (tempDir) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
  delete process.env.OPENCLAW_CONFIG_PATH;
  delete process.env.POLYBOARD_API_TOKEN;
  delete process.env.POLYBOARD_ALLOWED_TOOLS;
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  }
});

describe('server API', () => {
  it('redacts gateway auth in config response', async () => {
    const app = createApp();
    const res = await requestJson(app, 'GET', '/api/config');
    expect(res.status).toBe(200);
    expect(res.json.config.gateway).toBeUndefined();
    expect(res.json.config.agents.list.length).toBe(1);
  });

  it('validates agent ids', async () => {
    const app = createApp();
    const res = await requestJson(app, 'GET', '/api/agents/agent$bad/status');
    expect(res.status).toBe(400);
  });

  it('enforces baseUpdatedAt for task updates', async () => {
    const app = createApp();
    const getRes = await requestJson(app, 'GET', '/api/tasks');
    expect(getRes.status).toBe(200);

    const putRes = await requestJson(app, 'PUT', '/api/tasks', { tasks: [] });
    expect(putRes.status).toBe(428);
  });

  it('detects task conflicts', async () => {
    const app = createApp();
    const getRes = await requestJson(app, 'GET', '/api/tasks');
    const baseUpdatedAt = getRes.json.updatedAt;

    const firstPut = await requestJson(app, 'PUT', '/api/tasks', {
      tasks: [{
        id: 't1',
        title: 'Task',
        status: 'inbox',
        pipeline: 'general',
        createdBy: 'human',
        tags: [],
        notes: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }],
      baseUpdatedAt,
    });
    expect(firstPut.status).toBe(200);

    const secondPut = await requestJson(app, 'PUT', '/api/tasks', {
      tasks: [],
      baseUpdatedAt,
    });
    expect(secondPut.status).toBe(409);
    expect(secondPut.json.current.tasks.length).toBe(1);
  });

  it('serves session transcript by agent/session id', async () => {
    await writeAgentSession(tempDir, 'agent1', 'session1.jsonl', ['{"a":1}']);
    const app = createApp();
    const res = await requestJson(
      app,
      'GET',
      '/api/sessions/transcript?agentId=agent1&sessionId=session1.jsonl&maxLines=10'
    );
    expect(res.status).toBe(200);
    expect(res.json.lines).toEqual(['{"a":1}']);
  });

  it('requires auth when POLYBOARD_API_TOKEN is set', async () => {
    process.env.POLYBOARD_API_TOKEN = 'test-token';
    const app = createApp();
    const res = await requestJson(app, 'GET', '/api/tasks');
    expect(res.status).toBe(401);

    const authed = await requestJson(app, 'GET', '/api/tasks', undefined, {
      Authorization: 'Bearer test-token',
    });
    expect(authed.status).toBe(200);
  });

  it('validates gateway invoke payloads and allows listed tools', async () => {
    process.env.POLYBOARD_ALLOWED_TOOLS = 'send_message';
    const app = createApp();

    const badTool = await requestJson(app, 'POST', '/api/gateway/invoke', {
      tool: 'delete_all',
      agentId: 'agent1',
      params: { message: 'x' },
    });
    expect(badTool.status).toBe(400);

    const badAgent = await requestJson(app, 'POST', '/api/gateway/invoke', {
      tool: 'send_message',
      agentId: '../',
      params: { message: 'x' },
    });
    expect(badAgent.status).toBe(400);

    const badMessage = await requestJson(app, 'POST', '/api/gateway/invoke', {
      tool: 'send_message',
      agentId: 'agent1',
      params: { message: 123 },
    });
    expect(badMessage.status).toBe(400);

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    const okRes = await requestJson(app, 'POST', '/api/gateway/invoke', {
      tool: 'send_message',
      agentId: 'agent1',
      params: { message: 'hello' },
    });
    expect(okRes.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for missing agent status', async () => {
    const app = createApp();
    const res = await requestJson(app, 'GET', '/api/agents/agent1/status');
    expect(res.status).toBe(404);

    await writeAgentStatus(tempDir, 'agent1', {
      agentId: 'agent1',
      status: 'working',
      lastHeartbeat: '2024-01-01T00:00:00Z',
    });
    const res2 = await requestJson(app, 'GET', '/api/agents/agent1/status');
    expect(res2.status).toBe(200);
  });
});
