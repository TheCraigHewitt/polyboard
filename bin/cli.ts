#!/usr/bin/env node
import { startServer } from '../src/server.js';

export function run() {
  const port = process.env.PORT || 3001;
  const host = process.env.HOST || '127.0.0.1';

  console.log(`
  ╔══════════════════════════════════════╗
  ║           POLYBOARD                  ║
  ║       OpenClaw Dashboard             ║
  ╚══════════════════════════════════════╝
  `);

  const { tls } = startServer(port);
  const scheme = tls ? 'https' : 'http';
  console.log(`  Dashboard: ${scheme}://${host}:${port}`);
  console.log(`  API: ${scheme}://${host}:${port}/api\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
