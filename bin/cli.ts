#!/usr/bin/env node
import { startServer } from '../src/server.js';

export function run() {
  const port = process.env.PORT || 3001;

  console.log(`
  ╔══════════════════════════════════════╗
  ║           POLYBOARD                  ║
  ║       OpenClaw Dashboard             ║
  ╚══════════════════════════════════════╝
  `);

  startServer(port);
  console.log(`  Dashboard: http://localhost:${port}`);
  console.log(`  API: http://localhost:${port}/api\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
