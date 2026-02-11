import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import http from 'http';
import https from 'https';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
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

interface ServerResult {
  httpServer: http.Server;
  app: express.Express;
  tls: boolean;
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

// Constant-time string comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Session signing with HMAC-SHA256
const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

function getSessionSecret(): string {
  return process.env.POLYBOARD_SESSION_SECRET
    || crypto.createHash('sha256').update(process.env.POLYBOARD_API_TOKEN || 'polyboard').digest('hex');
}

function signSession(payload: string): string {
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(payload);
  return `${payload}.${hmac.digest('base64url')}`;
}

function verifySession(cookie: string): boolean {
  const lastDot = cookie.lastIndexOf('.');
  if (lastDot === -1) return false;
  const payload = cookie.slice(0, lastDot);
  const sig = cookie.slice(lastDot + 1);
  const hmac = crypto.createHmac('sha256', getSessionSecret());
  hmac.update(payload);
  const expected = hmac.digest('base64url');
  // Guard against length mismatch (timingSafeEqual throws on different lengths)
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  // Check session expiry
  const match = payload.match(/^session:(\d+)$/);
  if (!match) return false;
  const issued = parseInt(match[1], 10);
  return Date.now() - issued < SESSION_MAX_AGE;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return cookies;
}

// In-memory rate limiter for login endpoint
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Sweep expired entries every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(ip);
  }
}, 5 * 60_000).unref();

export function createServer(options: ServerOptions = {}) {
  const app = express();
  const host = options.host || '127.0.0.1';
  const token = process.env.POLYBOARD_API_TOKEN || '';
  const requireAuth = Boolean(token);
  const allowedOrigins = new Set(parseCorsOrigins());

  const useTls = Boolean(process.env.POLYBOARD_TLS_CERT && process.env.POLYBOARD_TLS_KEY);
  const loopback = isLoopbackHost(host);

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
    hsts: useTls ? { maxAge: 31536000, includeSubDomains: true } : false,
  }));

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (loopback) {
        // On loopback, allow localhost origins
        const allowed =
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
          allowedOrigins.has(origin);
        callback(null, allowed);
      } else {
        // Non-loopback: only explicit origins
        callback(null, allowedOrigins.has(origin));
      }
    },
    credentials: true,
  }));
  app.use(express.json());

  // CSRF protection for cookie auth: verify Origin on mutating requests
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    // Only enforce for cookie-authenticated requests (bearer token is immune to CSRF)
    const cookies = parseCookies(req.headers.cookie);
    if (!cookies['polyboard_session']) {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (!origin) {
      res.status(403).json({ error: 'Missing Origin header' });
      return;
    }
    if (loopback) {
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || allowedOrigins.has(origin)) {
        next();
        return;
      }
    } else {
      if (allowedOrigins.has(origin)) {
        next();
        return;
      }
    }
    res.status(403).json({ error: 'Origin not allowed' });
  });

  // Helper: check if request has valid session cookie
  function hasValidSession(req: Request): boolean {
    const cookies = parseCookies(req.headers.cookie);
    const session = cookies['polyboard_session'];
    if (!session) return false;
    try {
      return verifySession(session);
    } catch {
      return false;
    }
  }

  // Auth check endpoint (before auth middleware)
  app.get('/api/auth/check', (req: Request, res: Response) => {
    if (!requireAuth) {
      res.json({ required: false });
      return;
    }
    const authHeader = req.headers.authorization || '';
    const expectedBearer = `Bearer ${token}`;
    if ((authHeader.length === expectedBearer.length && safeCompare(authHeader, expectedBearer)) || hasValidSession(req)) {
      res.json({ required: true, authenticated: true });
      return;
    }
    res.status(401).json({ required: true, authenticated: false });
  });

  // Login endpoint (before auth middleware)
  app.post('/api/auth/login', (req: Request, res: Response) => {
    if (!requireAuth) {
      res.json({ success: true });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (isRateLimited(ip)) {
      res.status(429).json({ error: 'Too many login attempts. Try again later.' });
      return;
    }

    const submitted = req.body?.token;
    if (typeof submitted !== 'string' || !safeCompare(submitted, token)) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Set httpOnly session cookie
    const maxAgeSec = Math.floor(SESSION_MAX_AGE / 1000);
    const sessionValue = signSession(`session:${Date.now()}`);
    const cookieFlags = [
      `polyboard_session=${sessionValue}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${maxAgeSec}`,
    ];
    if (useTls) cookieFlags.push('Secure');
    res.setHeader('Set-Cookie', cookieFlags.join('; '));
    res.json({ success: true });
  });

  // Auth middleware: accepts bearer token OR valid session cookie
  app.use('/api', (req, res, next) => {
    if (!requireAuth) {
      next();
      return;
    }
    const authHeader = req.headers.authorization || '';
    const expectedBearer = `Bearer ${token}`;
    if (authHeader.length === expectedBearer.length && safeCompare(authHeader, expectedBearer)) {
      next();
      return;
    }
    if (hasValidSession(req)) {
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

  // Gateway WebSocket URL (relative path, client constructs absolute URL)
  app.get('/api/gateway/ws-url', async (_req: Request, res: Response) => {
    res.json({ url: '/api/gateway/ws' });
  });

  // Send message to agent via gateway (uses sessions_send tool)
  app.post('/api/gateway/invoke', async (req: Request, res: Response) => {
    const config = await readOpenClawConfig();
    const port = config?.gateway?.port || 18789;
    const authToken =
      config?.gateway?.authToken ||
      config?.gateway?.auth?.token ||
      config?.gateway?.auth?.password;
    const allowedTools = new Set(
      (process.env.POLYBOARD_ALLOWED_TOOLS || 'sessions_send')
        .split(',')
        .map((tool) => tool.trim())
        .filter(Boolean)
    );
    const tool = req.body?.tool;
    if (!tool || typeof tool !== 'string' || !allowedTools.has(tool)) {
      res.status(400).json({ error: 'Tool not allowed' });
      return;
    }
    const sessionKey = req.body?.sessionKey;
    if (!sessionKey || typeof sessionKey !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(sessionKey)) {
      res.status(400).json({ error: 'Invalid sessionKey' });
      return;
    }
    if (tool === 'sessions_send') {
      const message = req.body?.args?.message;
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Invalid message payload' });
        return;
      }
    }

    try {
      const gatewayPayload = {
        tool: req.body.tool,
        args: req.body.args,
        sessionKey: req.body.sessionKey,
      };
      const response = await fetch(`http://127.0.0.1:${port}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(gatewayPayload),
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

export function startServer(port: number | string = 3001): ServerResult {
  const host = process.env.HOST || '127.0.0.1';
  const token = process.env.POLYBOARD_API_TOKEN || '';
  const requireAuth = Boolean(token);

  // TLS configuration
  const tlsCert = process.env.POLYBOARD_TLS_CERT;
  const tlsKey = process.env.POLYBOARD_TLS_KEY;
  const tlsCa = process.env.POLYBOARD_TLS_CA;
  const useTls = Boolean(tlsCert && tlsKey);

  // Non-loopback requires both token AND TLS
  if (!isLoopbackHost(host)) {
    if (!requireAuth || !useTls) {
      console.error(
        'ERROR: Non-loopback HOST requires both POLYBOARD_API_TOKEN and TLS (POLYBOARD_TLS_CERT + POLYBOARD_TLS_KEY).'
      );
      process.exit(1);
    }
  }

  const app = createServer({ host });

  let httpServer: http.Server | https.Server;
  if (useTls) {
    const tlsOptions: https.ServerOptions = {
      cert: fs.readFileSync(tlsCert!),
      key: fs.readFileSync(tlsKey!),
    };
    if (tlsCa) {
      tlsOptions.ca = fs.readFileSync(tlsCa);
      tlsOptions.requestCert = true;
      tlsOptions.rejectUnauthorized = true;
    }
    httpServer = https.createServer(tlsOptions, app);
  } else {
    httpServer = http.createServer(app);
  }

  // WebSocket proxy to OpenClaw gateway
  const WS_MAX_PAYLOAD = 1024 * 1024; // 1MB
  const WS_MAX_CONNECTIONS = 50;
  const wss = new WebSocketServer({ noServer: true, maxPayload: WS_MAX_PAYLOAD });

  httpServer.on('upgrade', (req, socket, head) => {
    if (wss.clients.size >= WS_MAX_CONNECTIONS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    const url = new URL(req.url || '', `http://${req.headers.host}`);
    if (url.pathname !== '/api/gateway/ws') {
      socket.destroy();
      return;
    }

    // Auth: check token query param or session cookie
    if (requireAuth) {
      const wsToken = url.searchParams.get('token') || '';
      const cookies = parseCookies(req.headers.cookie);
      const session = cookies['polyboard_session'];
      const hasValidToken = wsToken.length === token.length && safeCompare(wsToken, token);
      let hasValidCookie = false;
      try {
        hasValidCookie = session ? verifySession(session) : false;
      } catch {
        // Malformed cookie
      }
      if (!hasValidToken && !hasValidCookie) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (clientWs) => {
      wss.emit('connection', clientWs, req);
    });
  });

  wss.on('connection', async (clientWs) => {
    let gatewayPort = 18789;
    try {
      const config = await readOpenClawConfig();
      gatewayPort = config?.gateway?.port || 18789;
    } catch {
      // use default port
    }

    let gatewayWs: WebSocket;
    try {
      gatewayWs = new WebSocket(`ws://127.0.0.1:${gatewayPort}`);
    } catch {
      clientWs.close(1011, 'Failed to connect to gateway');
      return;
    }

    gatewayWs.on('open', () => {
      // Bidirectional pipe
      clientWs.on('message', (data) => {
        if (gatewayWs.readyState === WebSocket.OPEN) {
          gatewayWs.send(data);
        }
      });

      gatewayWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data);
        }
      });
    });

    gatewayWs.on('error', () => {
      clientWs.close(1011, 'Gateway connection error');
    });

    gatewayWs.on('close', () => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1000, 'Gateway disconnected');
      }
    });

    clientWs.on('close', () => {
      if (gatewayWs.readyState === WebSocket.OPEN) {
        gatewayWs.close();
      }
    });

    clientWs.on('error', () => {
      if (gatewayWs.readyState === WebSocket.OPEN) {
        gatewayWs.close();
      }
    });
  });

  const resolvedPort = typeof port === 'string' ? Number.parseInt(port, 10) : port;
  const scheme = useTls ? 'https' : 'http';
  httpServer.listen(resolvedPort, host, () => {
    console.log(`Polyboard API server running at ${scheme}://${host}:${port}`);
  });

  return { httpServer, app, tls: useTls };
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = process.env.PORT || 3001;
  startServer(port);
}
