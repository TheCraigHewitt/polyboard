# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (runs API server + Vite with hot reload)
npm run dev

# Development - client only (frontend work, API must run separately)
npm run dev:client

# Development - API only
npm run dev:api

# Build for production
npm run build

# Run production build
npm start
```

Development runs on two ports:
- Vite dev server: http://localhost:3000 (proxies /api to 3001)
- API server: http://localhost:3001

## Architecture

Polyboard is a dashboard for OpenClaw multi-agent systems with a React frontend and Express API backend.

### Build System

Two TypeScript configs exist:
- `tsconfig.json` - Client code (React, Vite bundled, no emit)
- `tsconfig.node.json` - Server code (Express, compiles to `dist/`)

The client builds to `dist/client/`, server to `dist/src/`. Production serves the client statically from the Express server.

### Client Architecture

**State Management**: Single Zustand store (`src/store/index.ts`) handles all app state. UI preferences persist to localStorage via Zustand's persist middleware.

**Key hooks** (`src/hooks/`):
- `useOpenClawConfig` - Fetches config from API, extracts agent list
- `useAgentStatus` - Polls agent STATUS.json files via API
- `useTasks` - CRUD operations synced to API
- `useWebSocket` - Gateway connection for real-time agent communication

**Component structure**:
- `Layout/` - App shell with header
- `Sidebar/` - Agent list with status indicators
- `Board/` - Kanban columns and task cards (uses @dnd-kit)
- `AgentPanel/` - Agent detail view with memory/activity

### Server Architecture

Express server (`src/server.ts`) with these API routes:
- `GET /api/config` - OpenClaw config and path
- `GET/PUT /api/tasks` - Task CRUD
- `GET /api/agents/:id/status|identity|memory|sessions` - Agent data
- `POST /api/gateway/invoke` - Proxy to OpenClaw gateway

File operations in `src/services/fileService.ts` read/write to `~/.openclaw/`. Override with `OPENCLAW_CONFIG_PATH` env var.

### Types

All shared types in `src/types/index.ts`: Task, Agent, AgentStatus, OpenClawConfig, etc.

## Path Alias

Use `@/` to import from `src/`:
```typescript
import { useStore } from '@/store';
import type { Task } from '@/types';
```
