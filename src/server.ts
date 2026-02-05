import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getOpenClawPath,
  readOpenClawConfig,
  readTasks,
  writeTasks,
  readAgentStatus,
  readAgentIdentity,
  readAgentMemory,
  getRecentSessions,
  readSessionTranscript,
} from './services/fileService.js';
import { normalizeTasksPayload } from './services/taskValidation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In production, server runs from dist/src/server.js, client is in dist/client
// In development, server runs from src/server.ts, no client static files
function getClientPath(): string {
  const isDist = __filename.includes('/dist/') || __filename.includes('\\dist\\');
  if (isDist) {
    return path.join(__dirname, '..', 'client');
  }
  return path.join(__dirname, 'client');
}

interface ServerOptions {
  host?: string;
}

function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function parseCorsOrigins(): string[] {
  const raw = process.env.POLYBOARD_CORS_ORIGINS;
  if (!raw) return [];
  return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
}

function sanitizeConfig(config: Awaited<ReturnType<typeof readOpenClawConfig>>) {
  if (!config) return null;
  return {
    agents: config.agents,
  };
}

export function createServer(options: ServerOptions = {}) {
  const app = express();
  const host = options.host || '127.0.0.1';
  const token = process.env.POLYBOARD_API_TOKEN || '';
  const requireAuth = Boolean(token);
  const allowedOrigins = new Set(parseCorsOrigins());

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed =
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) ||
        allowedOrigins.has(origin);
      callback(null, allowed);
    },
  }));
  app.use(express.json());

  app.use('/api', (req, res, next) => {
    if (!requireAuth) {
      next();
      return;
    }
    const authHeader = req.headers.authorization || '';
    if (authHeader === `Bearer ${token}`) {
      next();
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
  });

  // Serve static files in production
  const clientPath = getClientPath();
  app.use(express.static(clientPath));

  // API Routes

  // Get OpenClaw config and path
  app.get('/api/config', async (_req: Request, res: Response) => {
    const openclawPath = getOpenClawPath();
    const config = await readOpenClawConfig();

    if (!config) {
      res.status(404).json({
        error: 'OpenClaw configuration not found',
        path: openclawPath,
        hint: 'Ensure OpenClaw is installed and ~/.openclaw/openclaw.json exists',
      });
      return;
    }

    res.json({ config: sanitizeConfig(config), path: openclawPath });
  });

  // Tasks CRUD
  app.get('/api/tasks', async (_req: Request, res: Response) => {
    const data = await readTasks();
    res.json(data);
  });

  app.put('/api/tasks', async (req: Request, res: Response) => {
    const { tasks, baseUpdatedAt } = req.body || {};
    const normalizedTasks = normalizeTasksPayload(tasks);
    if (!normalizedTasks) {
      res.status(400).json({ error: 'Invalid tasks payload' });
      return;
    }
    if (typeof baseUpdatedAt !== 'string' || !baseUpdatedAt) {
      res.status(428).json({ error: 'baseUpdatedAt required' });
      return;
    }

    const current = await readTasks();
    if (current.updatedAt !== baseUpdatedAt) {
      res.status(409).json({
        error: 'Tasks have changed',
        current,
      });
      return;
    }

    const written = await writeTasks(normalizedTasks);
    res.json({ success: true, updatedAt: written.updatedAt });
  });

  // Agent status
  app.get('/api/agents/:agentId/status', async (req: Request, res: Response) => {
    const agentId = req.params.agentId as string;
    if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
      res.status(400).json({ error: 'Invalid agentId' });
      return;
    }
    const status = await readAgentStatus(agentId);

    if (!status) {
      res.status(404).json({ error: 'Status not found' });
      return;
    }

    res.json(status);
  });

  // Agent identity/profile
  app.get('/api/agents/:agentId/identity', async (req: Request, res: Response) => {
    const agentId = req.params.agentId as string;
    if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
      res.status(400).json({ error: 'Invalid agentId' });
      return;
    }
    const identity = await readAgentIdentity(agentId);

    if (!identity) {
      res.status(404).json({ error: 'Identity not found' });
      return;
    }

    res.json({ content: identity });
  });

  // Agent memory
  app.get('/api/agents/:agentId/memory', async (req: Request, res: Response) => {
    const agentId = req.params.agentId as string;
    if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
      res.status(400).json({ error: 'Invalid agentId' });
      return;
    }
    const memory = await readAgentMemory(agentId);

    if (!memory) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }

    res.json({ content: memory });
  });

  // Agent sessions
  app.get('/api/agents/:agentId/sessions', async (req: Request, res: Response) => {
    const agentId = req.params.agentId as string;
    if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
      res.status(400).json({ error: 'Invalid agentId' });
      return;
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const sessions = await getRecentSessions(agentId, limit);
    res.json({ sessions });
  });

  // Session transcript
  app.get('/api/sessions/transcript', async (req: Request, res: Response) => {
    const agentId = req.query.agentId as string;
    const sessionId = req.query.sessionId as string;
    const maxLines = parseInt(req.query.maxLines as string) || 50;

    if (!agentId || !sessionId) {
      res.status(400).json({ error: 'agentId and sessionId required' });
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) {
      res.status(400).json({ error: 'Invalid agentId' });
      return;
    }

    const lines = await readSessionTranscript(agentId, sessionId, maxLines);
    res.json({ lines });
  });

  // Gateway WebSocket URL
  app.get('/api/gateway/ws-url', async (_req: Request, res: Response) => {
    const config = await readOpenClawConfig();
    const port = config?.gateway?.port || 18789;
    res.json({ url: `ws://127.0.0.1:${port}` });
  });

  // Send message to agent via gateway
  app.post('/api/gateway/invoke', async (req: Request, res: Response) => {
    const config = await readOpenClawConfig();
    const port = config?.gateway?.port || 18789;
    const authToken =
      config?.gateway?.authToken ||
      config?.gateway?.auth?.token ||
      config?.gateway?.auth?.password;
    const allowedTools = new Set(
      (process.env.POLYBOARD_ALLOWED_TOOLS || 'send_message')
        .split(',')
        .map((tool) => tool.trim())
        .filter(Boolean)
    );
    const tool = req.body?.tool;
    if (!tool || typeof tool !== 'string' || !allowedTools.has(tool)) {
      res.status(400).json({ error: 'Tool not allowed' });
      return;
    }
    const agentId = req.body?.agentId;
    if (!agentId || typeof agentId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(agentId)) {
      res.status(400).json({ error: 'Invalid agentId' });
      return;
    }
    if (tool === 'send_message') {
      const message = req.body?.params?.message;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Invalid message payload' });
        return;
      }
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(req.body),
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (err) {
      res.status(502).json({
        error: 'Failed to connect to gateway',
        details: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // SPA fallback - Express 5 uses {*path} syntax for wildcards
  app.get('/{*path}', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });

  return app;
}

export function startServer(port: number | string = 3001) {
  const host = process.env.HOST || '127.0.0.1';
  if (!isLoopbackHost(host) && !process.env.POLYBOARD_API_TOKEN) {
    console.warn('Warning: HOST is non-loopback without POLYBOARD_API_TOKEN set.');
  }
  const app = createServer({ host });

  const resolvedPort = typeof port === 'string' ? Number.parseInt(port, 10) : port;
  app.listen(resolvedPort, host, () => {
    console.log(`Polyboard API server running at http://${host}:${port}`);
  });

  return app;
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 3001;
  startServer(port);
}
