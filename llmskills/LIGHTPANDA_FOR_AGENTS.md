# Lightpanda for agents

Use this machine's local Lightpanda service when you need a browser endpoint for testing web apps over CDP.

## What is running

- Service: user-level `lightpanda.service`
- Host: `127.0.0.1`
- Port: `9222`
- WebSocket CDP endpoint: `ws://127.0.0.1:9222/`
- HTTP health check: `http://127.0.0.1:9222/json/version`

This service is local-only. It is not exposed publicly.

## Quick health check

Before using it, verify the endpoint responds:

```bash
curl -s http://127.0.0.1:9222/json/version
```

Expected response shape:

```json
{"webSocketDebuggerUrl":"ws://127.0.0.1:9222/"}
```

Use `/json/version` for liveness checks. Lightpanda does not provide `/json/list` or `/healthz`.

## How agents should connect

### Playwright

```ts
import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('ws://127.0.0.1:9222/');
```

### Puppeteer

```ts
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://127.0.0.1:9222/',
});
```

### Generic CDP client

Connect to:

```text
ws://127.0.0.1:9222/
```

## Recommended agent workflow

1. Start the target web app locally.
2. Wait until the app's own local URL responds.
3. Check Lightpanda with `/json/version`.
4. Connect over CDP.
5. Create or attach to a target.
6. Navigate to the local app URL.
7. Run assertions.
8. Close targets and disconnect cleanly when done.

## Important caveats

- The service uses an idle CDP timeout of `3600` seconds. Long-idle clients may be disconnected.
- Lightpanda supports a useful subset of CDP, not every Chromium command.
- Upstream currently defaults to a maximum of 16 simultaneous CDP connections.
- Treat one active automation client per Lightpanda instance as the safest pattern.
- `/json/version` returns the debugger URL and then closes the HTTP connection. That is expected.
- The service is configured with `--obey-robots`, so crawling behavior respects `robots.txt` where relevant.
- Telemetry is enabled by default in the current service configuration.

## If connection fails

Check these in order:

```bash
curl -s http://127.0.0.1:9222/json/version
systemctl --user status lightpanda.service
journalctl --user -u lightpanda.service -n 50 --no-pager
```

If the service is healthy, the most common issue is with the app under test, not the browser endpoint.

## Known good fact from verification

This Lightpanda service was verified end-to-end on this machine by:

- connecting over WebSocket CDP
- running `Browser.getVersion`
- creating a target
- navigating to `https://example.com/`
- reading `document.title` successfully

## Related local docs

- `/home/vinuxito/lightpanda-session-memory-2026-03-30.md`
- `/home/vinuxito/SERVER_OVERVIEW.md`
