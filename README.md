# Polyboard

Real-time dashboard for managing OpenClaw multi-agent systems. Features a Kanban task board, agent status monitoring, and agent interaction.

## Quick Start

```bash
npx polyboard
```

Open http://localhost:3001 in your browser.

## Features

- **Kanban Task Board** - Drag-and-drop tasks between Inbox, Active, Review, and Done columns
- **Agent Status Monitoring** - Real-time status indicators for all configured agents
- **Agent Interaction** - Send messages to agents, view activity feeds and memory
- **Dark/Light Theme** - Toggle between themes
- **Pipeline Filtering** - Filter tasks by pipeline (advisory, content, email, general)
- **Persistent Storage** - Tasks persist to `~/.openclaw/mission-control/tasks.json`

## Requirements

- OpenClaw installed with `~/.openclaw/openclaw.json` configuration
- Node.js 18+

## Configuration

Polyboard auto-discovers your OpenClaw installation at `~/.openclaw`. Override with:

```bash
OPENCLAW_CONFIG_PATH=/path/to/openclaw npx polyboard
```

## Security Notes

- Polyboard is designed to run on `127.0.0.1` by default. If you bind to a non-loopback `HOST`, you are exposing local OpenClaw data on your network.
- You can protect the API by setting `POLYBOARD_API_TOKEN`. When set, all `/api/*` requests must include `Authorization: Bearer <token>`.
- The UI will read a token from `localStorage` key `polyboardApiToken` if present (open browser console to set it).
- Allowed gateway tools can be restricted with `POLYBOARD_ALLOWED_TOOLS` (comma-separated, defaults to `send_message`).
- CORS can be extended via `POLYBOARD_CORS_ORIGINS` (comma-separated list of allowed origins).

## Development

```bash
# Install dependencies
npm install

# Run development server (API + client hot reload)
npm run dev

# Run client only (for frontend development)
npm run dev:client

# Build for production
npm run build
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Polyboard Dashboard                    │
│  (React + Vite + Tailwind + Zustand)            │
└─────────────────┬───────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────────┐
│  File  │  │ HTTP API │  │  WebSocket   │
│ System │  │ :3001    │  │  (Gateway)   │
└────────┘  └──────────┘  └──────────────┘
                  │
           ~/.openclaw/
```

## Data Files

| File | Purpose |
|------|---------|
| `~/.openclaw/openclaw.json` | OpenClaw configuration (read) |
| `~/.openclaw/mission-control/tasks.json` | Task data (created by Polyboard) |
| `~/.openclaw/agents/{id}/STATUS.json` | Agent status (created by agents) |
| `~/.openclaw/agents/{id}/MEMORY.md` | Agent memory (read) |
| `~/.openclaw/agents/{id}/sessions/` | Session transcripts (read) |

## Agent Integration

For agents to interact with tasks, they should:

1. Read `~/.openclaw/mission-control/tasks.json` during heartbeat
2. Check for assigned tasks in 'inbox' or 'active' status
3. Update their `STATUS.json` with current state
4. Update task notes with progress

### STATUS.json Format

```json
{
  "agentId": "agent-name",
  "status": "working",
  "statusReason": "Processing email queue",
  "lastHeartbeat": "2024-01-15T10:30:00Z",
  "currentTask": "task-uuid"
}
```

Status values: `working`, `idle`, `error`, `offline`

## License

MIT
