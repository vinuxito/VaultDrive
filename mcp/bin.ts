#!/usr/bin/env -S node --experimental-strip-types
import { AbrnMcpServer, loadConfigFromEnv, serveStdioMcp } from "./server.ts";

function main(): void {
  try {
    const config = loadConfigFromEnv(process.env);
    const server = new AbrnMcpServer(config);
    serveStdioMcp(server, process.stdin, process.stdout);
    process.stdin.resume();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

main();
