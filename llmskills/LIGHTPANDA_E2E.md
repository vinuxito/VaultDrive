# Lightpanda E2E Skill — MRW Project

> **TL;DR:** Write a `.mjs` file, run it with `node`. 9/9 verified on 2026-03-30.
> The global skill lives at `~/.claude/skills/lightpanda-e2e/SKILL.md`.

## When to Use This

Any time you need to verify that a PHP page:
- Loads without fatal errors
- Renders key DOM elements
- Has the expected title or content
- Redirects correctly (auth, sessions)

No Playwright, no Chrome binary, no npm install. Just Node.js 22 and the local Lightpanda service.

## Health Check (always first)

```bash
curl -s http://127.0.0.1:9222/json/version
# Expected: {"webSocketDebuggerUrl":"ws://127.0.0.1:9222/"}
```

If blank → `systemctl --user restart lightpanda.service`

## Existing Test

A reference test already exists in this repo:

```bash
node /lamp/www/mrw/tests/cdp-lightpanda-e2e.mjs
```

Output (verified 2026-03-30):
```
Results: 9 passed, 0 failed
STATUS: PASS — Lightpanda CDP is operational
```

## Write a New Test

1. Copy `tests/cdp-lightpanda-e2e.mjs`
2. Replace the URL and add your assertions
3. Run with `node your-test.mjs`
4. Show the output as evidence before marking complete

Full template and CDP command reference: `~/.claude/skills/lightpanda-e2e/SKILL.md`

## Key Facts

| Item | Value |
|------|-------|
| CDP endpoint | `ws://127.0.0.1:9222/` |
| Health URL | `http://127.0.0.1:9222/json/version` |
| Node.js required | v22+ (built-in WebSocket) |
| Browser product | `Chrome/124.0.6367.29` (Lightpanda) |
| Confirmed working | `Browser.getVersion`, `Target.*`, `Page.navigate`, `Runtime.evaluate` |
| NOT supported | `/json/list`, `Network.*` interception, `Page.printToPDF` |
| Max connections | 16 simultaneous |

## MRW-Specific URLs to Test

```
https://dev-app.filemonprime.net/mrw/backoffice/helper/ota_match_dashboard.php
https://dev-app.filemonprime.net/mrw/backoffice/helper/link_pms_propiedades_async.php
https://dev-app.filemonprime.net/mrw/backoffice/helper/link_mrw_gastos_propiedad_async.php
https://dev-app.filemonprime.net/mrw/backoffice/helper/pms_alias_manager.php
https://dev-app.filemonprime.net/mrw/backoffice/helper/reporte_ingresos_propiedad.php
```

All of these require an authenticated session. The test will navigate there and either:
- Get the page (if session cookie is cached by Lightpanda from a prior visit)
- Get redirected to login (assert `window.location.href.includes('login')` instead of content)

## Quick Assertion Examples

```javascript
// No PHP fatal errors
assert('No PHP errors', !(await eval('document.body.innerText.includes("Fatal error")')));

// Table has data rows
const { result } = await browser.send('Runtime.evaluate', {
  expression: 'document.querySelectorAll("table tbody tr").length',
  sessionId
});
assert(`Table rows: ${result.value}`, result.value > 0);

// Specific element present
const { result: el } = await browser.send('Runtime.evaluate', {
  expression: 'document.querySelector(".conf-badge") !== null',
  sessionId
});
assert('Confidence badges rendered', el.value === true);
```

## Related Files

- `tests/cdp-lightpanda-e2e.mjs` — working reference test
- `llmskills/LIGHTPANDA_FOR_AGENTS.md` — service setup and caveats
- `~/.claude/skills/lightpanda-e2e/SKILL.md` — full global skill with template
