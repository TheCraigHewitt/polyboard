/* @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs/promises';
import { createServer } from '../src/server';
import { createTempOpenClawDir, writeOpenClawConfig, writeAgentStatus, writeAgentSession } from './helpers/openclaw';

let tempDir = '';
let originalFetch: typeof fetch | undefined;

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
    const app = createServer({ host: '127.0.0.1' });
    const res = await request(app).get('/api/config');
    expect(res.status).toBe(200);
    expect(res.body.config.gateway).toBeUndefined();
    expect(res.body.config.agents.list.length).toBe(1);
  });

  it('validates agent ids', async () => {
    const app = createServer({ host: '127.0.0.1' });
    const res = await request(app).get('/api/agents/../status');
    expect(res.status).toBe(400);
  });

  it('enforces baseUpdatedAt for task updates', async () => {
    const app = createServer({ host: '127.0.0.1' });
    const getRes = await request(app).get('/api/tasks');
    expect(getRes.status).toBe(200);

    const putRes = await request(app).put('/api/tasks').send({ tasks: [] });
    expect(putRes.status).toBe(428);
  });

  it('detects task conflicts', async () => {
    const app = createServer({ host: '127.0.0.1' });
    const getRes = await request(app).get('/api/tasks');
    const baseUpdatedAt = getRes.body.updatedAt;

    const firstPut = await request(app)
      .put('/api/tasks')
      .send({
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

    const secondPut = await request(app)
      .put('/api/tasks')
      .send({
        tasks: [],
        baseUpdatedAt,
      });
    expect(secondPut.status).toBe(409);
    expect(secondPut.body.current.tasks.length).toBe(1);
  });

  it('serves session transcript by agent/session id', async () => {
    await writeAgentSession(tempDir, 'agent1', 'session1.jsonl', ['{"a":1}']);
    const app = createServer({ host: '127.0.0.1' });
    const res = await request(app)
      .get('/api/sessions/transcript')
      .query({ agentId: 'agent1', sessionId: 'session1.jsonl', maxLines: 10 });
    expect(res.status).toBe(200);
    expect(res.body.lines).toEqual(['{"a":1}']);
  });

  it('requires auth when POLYBOARD_API_TOKEN is set', async () => {
    process.env.POLYBOARD_API_TOKEN = 'test-token';
    const app = createServer({ host: '127.0.0.1' });
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);

    const authed = await request(app)
      .get('/api/tasks')
      .set('Authorization', 'Bearer test-token');
    expect(authed.status).toBe(200);
  });

  it('validates gateway invoke payloads and allows listed tools', async () => {
    process.env.POLYBOARD_ALLOWED_TOOLS = 'send_message';
    const app = createServer({ host: '127.0.0.1' });

    const badTool = await request(app)
      .post('/api/gateway/invoke')
      .send({ tool: 'delete_all', agentId: 'agent1', params: { message: 'x' } });
    expect(badTool.status).toBe(400);

    const badAgent = await request(app)
      .post('/api/gateway/invoke')
      .send({ tool: 'send_message', agentId: '../', params: { message: 'x' } });
    expect(badAgent.status).toBe(400);

    const badMessage = await request(app)
      .post('/api/gateway/invoke')
      .send({ tool: 'send_message', agentId: 'agent1', params: { message: 123 } });
    expect(badMessage.status).toBe(400);

    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;

    const okRes = await request(app)
      .post('/api/gateway/invoke')
      .send({ tool: 'send_message', agentId: 'agent1', params: { message: 'hello' } });
    expect(okRes.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for missing agent status', async () => {
    const app = createServer({ host: '127.0.0.1' });
    const res = await request(app).get('/api/agents/agent1/status');
    expect(res.status).toBe(404);

    await writeAgentStatus(tempDir, 'agent1', {
      agentId: 'agent1',
      status: 'working',
      lastHeartbeat: '2024-01-01T00:00:00Z',
    });
    const res2 = await request(app).get('/api/agents/agent1/status');
    expect(res2.status).toBe(200);
  });
});
