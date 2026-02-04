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

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve static files in production
  const clientPath = getClientPath();
  app.use(express.static(clientPath));

  // API Routes

  // Get OpenClaw config and path
  app.get('/api/config', (_req: Request, res: Response) => {
    const openclawPath = getOpenClawPath();
    const config = readOpenClawConfig();

    if (!config) {
      res.status(404).json({
        error: 'OpenClaw configuration not found',
        path: openclawPath,
        hint: 'Ensure OpenClaw is installed and ~/.openclaw/openclaw.json exists',
      });
      return;
    }

    res.json({ config, path: openclawPath });
  });

  // Tasks CRUD
  app.get('/api/tasks', (_req: Request, res: Response) => {
    const data = readTasks();
    res.json(data);
  });

  app.put('/api/tasks', (req: Request, res: Response) => {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      res.status(400).json({ error: 'Tasks must be an array' });
      return;
    }
    writeTasks(tasks);
    res.json({ success: true });
  });

  // Agent status
  app.get('/api/agents/:agentId/status', (req: Request, res: Response) => {
    const agentId = req.params.agentId as string;
    const status = readAgentStatus(agentId);

    if (!status) {
      res.status(404).json({ error: 'Status not found' });
      return;
    }

    res.json(status);
  });

  // Agent identity/profile
  app.get('/api/agents/:agentId/identity', (req: Request, res: Response) => {
    const agentId = req.params.agentId as string;
    const identity = readAgentIdentity(agentId);

    if (!identity) {
      res.status(404).json({ error: 'Identity not found' });
      return;
    }

    res.json({ content: identity });
  });

  // Agent memory
  app.get('/api/agents/:agentId/memory', (req: Request, res: Response) => {
    const agentId = req.params.agentId as string;
    const memory = readAgentMemory(agentId);

    if (!memory) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }

    res.json({ content: memory });
  });

  // Agent sessions
  app.get('/api/agents/:agentId/sessions', (req: Request, res: Response) => {
    const agentId = req.params.agentId as string;
    const limit = parseInt(req.query.limit as string) || 10;
    const sessions = getRecentSessions(agentId, limit);
    res.json({ sessions });
  });

  // Session transcript
  app.get('/api/sessions/transcript', (req: Request, res: Response) => {
    const sessionPath = req.query.path as string;
    const maxLines = parseInt(req.query.maxLines as string) || 50;

    if (!sessionPath) {
      res.status(400).json({ error: 'Session path required' });
      return;
    }

    const lines = readSessionTranscript(sessionPath, maxLines);
    res.json({ lines });
  });

  // Gateway WebSocket URL
  app.get('/api/gateway/ws-url', (_req: Request, res: Response) => {
    const config = readOpenClawConfig();
    const port = config?.gateway?.port || 18789;
    res.json({ url: `ws://127.0.0.1:${port}` });
  });

  // Send message to agent via gateway
  app.post('/api/gateway/invoke', async (req: Request, res: Response) => {
    const config = readOpenClawConfig();
    const port = config?.gateway?.port || 18789;
    const authToken = config?.gateway?.authToken;

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
  const app = createServer();

  app.listen(port, () => {
    console.log(`Polyboard API server running at http://localhost:${port}`);
  });

  return app;
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 3001;
  startServer(port);
}
