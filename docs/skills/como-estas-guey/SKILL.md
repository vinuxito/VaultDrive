---
name: como-estas-guey
description: >
  Operational-health skill tuned for ABRN-Drive (VaultDrive) and general software systems.
  Use when an agent, operator, monitor, or service needs to answer "¿cómo estás, güey?" with
  evidence: alive/degraded/blocked/down/unknown, Go backend readiness, schema 50 migration boundary,
  encrypted blob storage, SSE stream, Secure Drop & Shamir recovery state, client-side WebCrypto/IndexedDB
  (rescue-ledger, SessionVault) health, and the safest next action. Never equates "endpoint responded"
  with "system healthy".
---

# 💀 COMO ESTÁS, GÜEY? — ABRN-Drive Edition
## Operational Health / Truthful Self-Reporting Skill

> **Prime law:** A system must be able to say what condition it is in without pretending.

This skill turns "¿estás vivo?" into an operational contract for `/lamp/www/ABRN-Drive` (Go backend + React/TypeScript WebCrypto vault) as well as any connected service.

## 1. Goal

Produce a **small, truthful, machine-readable health surface** that answers:

1. **Are you reachable?**
2. **Are you actually usable?**
3. **What dependencies are unhealthy or uncertain?**
4. **Is your data fresh enough to trust?**
5. **Are you overloaded, blocked, or accumulating work?**
6. **Does a human need to intervene?**
7. **What should happen next?**

A health response is not decoration. It is an input to monitoring, routing, retries, deployment gates, agent decisions, and human action.

## 2. Core distinction: liveness ≠ readiness ≠ health

### Liveness
"Is the process capable of answering at all?"

Use for supervisors/load balancers that only need to know whether the process is alive.

### Readiness
"Can this instance safely receive normal work now?"

A process may be alive but not ready because:
- database unavailable
- migrations incomplete
- required credential missing
- critical downstream service unavailable
- startup/warmup incomplete
- queue/worker subsystem unavailable

### Operational health
"Is the system functioning within acceptable operating conditions?"

This may include dependency status, queue depth, stale synchronization, failed jobs, disk pressure, lock contention, CPU/memory pressure, pending human review, business-specific blockers, and degraded-but-usable states.

**Never return `ok` merely because PHP/Python/Node executed.**

## 3. Required status vocabulary

Use one top-level status:

- `ok` — normal operation; no known issue requiring attention.
- `degraded` — usable, but one or more non-fatal conditions are outside normal bounds.
- `blocked` — alive, but a critical condition prevents the intended workflow.
- `down` — essential service/process unavailable.
- `unknown` — evidence is insufficient or stale. **Unknown is not OK and is not zero.**

Optional component statuses should use the same vocabulary where practical.

## 4. Minimum response contract

Return JSON by default.

```json
{
  "status": "ok",
  "service": "example-app",
  "version": "2026.09.30",
  "checked_at": "2026-09-30T14:00:00-06:00",
  "duration_ms": 24,
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 8
    }
  },
  "attention": [],
  "next_action": null
}
```

### Stronger contract

```json
{
  "status": "degraded",
  "service": "nanored",
  "instance": "web-01",
  "environment": "production",
  "version": "git-sha-or-release",
  "checked_at": "ISO-8601",
  "duration_ms": 31,
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 7,
      "evidence": "successful read-only probe"
    },
    "storage": {
      "status": "ok",
      "writable": true
    },
    "queue": {
      "status": "degraded",
      "pending": 418,
      "oldest_age_seconds": 730
    },
    "sync": {
      "status": "unknown",
      "last_success_at": "2026-09-30T12:05:00-06:00",
      "freshness_seconds": 6900,
      "reason": "No successful sync inside freshness threshold"
    }
  },
  "workload": {
    "running_jobs": 3,
    "pending_jobs": 418
  },
  "human_attention": [
    {
      "severity": "warning",
      "code": "SYNC_STALE",
      "message": "External synchronization is stale.",
      "action": "Inspect sync worker before trusting current totals."
    }
  ],
  "next_action": "Keep read-only access available; pause workflows that require fresh sync data."
}
```

## 5. Truth rules

### Rule A — Evidence before status
Every important `ok`, `degraded`, or `blocked` result should have an observable basis.

### Rule B — Unknown stays unknown
If a check was not run, timed out, is too expensive, or lacks access, report `unknown` with a reason. Do not convert missing data into `0`, empty arrays presented as factual emptiness, `ok`, or "no issues".

### Rule C — Health checks do not mutate business state
Default probes must be read-only, idempotent, bounded, and fast.

Never create invoices, send messages, cancel transactions, alter customer records, consume irreversible queue items, trigger billing, rotate secrets, or "repair" automatically unless a separate governed recovery action is explicitly authorized.

### Rule D — Aggregate according to impact
One unhealthy optional dependency does not necessarily mean `down`. A primary database outage may mean `blocked` or `down`; an analytics outage may mean `degraded`. Top-level status must reflect business impact.

### Rule E — Never expose secrets
Do not return passwords, API keys, bearer tokens, full connection strings, private keys, session IDs, raw customer data, or public stack traces.

## 6. Severity model

Use:
- `info` — noteworthy, no intervention required.
- `warning` — intervention should occur soon or trust is reduced.
- `critical` — intended operation is unsafe or impossible.

A health endpoint should tell the operator **what matters**, not dump every metric available.

## 7. Probe budget

Health checks themselves must not become the outage.

Default target:
- cheap probes: every request
- moderate probes: cache 15–60 seconds
- expensive probes: asynchronous/background; endpoint reads last result

Recommended endpoint budget:
- aim for <250 ms
- hard timeout per dependency
- global timeout
- no unbounded loops
- no full-table scans
- no giant filesystem walks
- no external AI calls for basic health

If a dependency probe exceeds its budget, return `unknown` or `degraded` with timeout evidence.

## 8. Resource health

For systems that can consume significant CPU, RAM, disk, workers, or DB connections, include pressure where it affects service.

Possible fields:

```json
{
  "resources": {
    "cpu": {"status":"degraded","load_1m":4.8},
    "memory": {"status":"ok","used_percent":63},
    "disk": {"status":"warning","used_percent":88},
    "workers": {"status":"degraded","active":12,"limit":12}
  }
}
```

Do not invent universal thresholds. Use deployment-specific limits and document them.

On shared hosting or constrained environments, watch PHP process count, CPU throttling, DB connections, cron overlap, runaway polling, duplicate workers, unbounded concurrency, and expensive probes themselves.

## 9. Freshness is health

A system can be online while presenting stale truth.

Expose `last_success_at`, `freshness_seconds`, `freshness_threshold_seconds`, and status for time-sensitive data. If stale data changes business decisions, top-level health should become `degraded` or `blocked`.

## 10. Human-attention channel

Distinguish **system unhealthy** from **human decision required**.

```json
{
  "human_attention": [
    {
      "severity": "warning",
      "code": "AMBIGUOUS_ACCOUNTING_ALLOCATION",
      "message": "Source evidence does not identify which invoice line should receive the adjustment.",
      "action": "Human authorization or additional evidence required."
    }
  ]
}
```

A pending human decision is not automatically a technical failure.

## 11. Agent behavior

- If `ok`: proceed normally.
- If `degraded`: proceed only with unaffected operations; surface the limitation when relevant.
- If `blocked`: do not force the workflow; explain blocker and safest next action.
- If `down`: stop dependent work; avoid aggressive retries; use bounded backoff/escalation.
- If `unknown`: do not claim success; gather evidence, wait, or escalate.

Agents must not reinterpret a bad health result into optimism.

## 12. Recovery behavior

Health and recovery are separate capabilities.

A health endpoint may recommend a next action, but querying health must not perform that action by itself.

If automatic remediation exists, govern it with:
- explicit allowed actions
- bounded scope
- cooldown
- retry ceiling
- audit log
- before/after evidence
- rollback when possible
- human escalation after repeated failure

## 13. Security / exposure modes

### Public liveness endpoint
Minimal: `{"status":"ok"}`

No infrastructure details.

### Authenticated operational endpoint
May include dependency states, workload, freshness, warnings, version, instance, and human attention.

### Internal deep diagnostics
May include richer evidence, but still never raw secrets.

## 14. HTTP semantics

Recommended defaults:
- `200` — `ok` or intentionally serviceable `degraded`
- `503` — `blocked` / `down` when normal traffic should not be routed here
- `500` — health mechanism itself failed unexpectedly

For orchestrators/load balancers, define separate `/live`, `/ready`, and `/health` endpoints when useful.

Do not let a non-critical warning accidentally eject every healthy instance from rotation.

## 15. Generic implementation sequence

When asked to add this skill to a system:

1. Inspect the actual runtime and architecture.
2. Identify the critical path.
3. Identify optional dependencies.
4. Identify freshness requirements.
5. Identify resource constraints.
6. Identify human gates.
7. Define thresholds from real operating limits; mark unknown thresholds explicitly.
8. Implement read-only bounded probes.
9. Aggregate status according to business impact.
10. Add authentication/redaction appropriate to exposure.
11. Test failure modes deliberately.
12. Verify from the same environment that will consume the endpoint.
13. Document what each result means and what action follows.

## 16. Acceptance tests

### Functional
- valid JSON
- timestamp present
- service identity present
- duration bounded
- critical dependency failures affect top-level state
- optional dependency failures degrade instead of falsely killing service
- unknown states stay unknown
- stale data is distinguishable from fresh data

### Safety
- GET/read-only request does not mutate business state
- no secrets or PII leak
- probes have timeouts
- no expensive unbounded query
- endpoint cannot create retry storms

### Failure truthfulness
Deliberately test:
- database down
- network timeout
- stale data
- filesystem not writable when writes are required
- worker saturation
- missing dependency
- partial outage

The endpoint must not say `ok` during a known critical failure.

### Operational
- monitor/agent can parse it
- logs correlate failures with trace/request ID when available
- warnings identify a next action
- human-attention items are separate from machine faults

## 17. Tola Gate 🩴

Before shipping, answer:

**¿Qué pasó?**  
Can the endpoint clearly say the current condition?

**¿Qué sigue?**  
Can an operator or agent tell what action follows?

**¿Cómo sé que sí quedó?**  
Is there evidence showing recovery rather than a green label painted over the problem?

If any answer is "no", health reporting is incomplete.

## 18. Output style for agents

When reporting health to a human, compress machine detail into:

**State:** `OK / DEGRADED / BLOCKED / DOWN / UNKNOWN`  
**Why:** strongest evidence  
**Impact:** what works / what does not  
**Attention:** what requires a human  
**Next:** safest concrete action

Example:

> **DEGRADED** — Web and DB are healthy, but the external sync is 114 minutes stale. Current records can be viewed, but totals dependent on that sync should not be treated as current. No mutation was performed. Next: inspect the sync worker.

No drama. No fake certainty. No giant metrics dump unless requested.

## 19. Anti-patterns

Never ship this as operational health:

```php
echo '{"status":"ok"}';
```

unless it truly is **only** a liveness probe and is clearly named/documented as such.

Avoid:
- "200 means healthy"
- checking only DB connection
- health checks that write data
- checks requiring third-party AI
- public stack traces
- returning zero for unknown counts
- one giant synchronous probe of every dependency
- calling degraded systems healthy because the UI still loads
- calling systems down because an optional analytics service failed
- auto-fixing merely because someone asked "how are you?"

## 20. Optional extension: fleet view

Once several apps expose compatible contracts, a supervisor can build:

```json
{
  "fleet": {
    "evinux": "ok",
    "quantix": "degraded",
    "nanored": "ok",
    "pipc": "ok",
    "urc": "unknown"
  },
  "attention_count": 2
}
```

This enables one operational dashboard, agent routing, deployment gates, incident detection, dependency-aware automation, and human escalation only when deserved.

Keep each service sovereign: a fleet dashboard summarizes; it does not overwrite local truth.

## 21. ABRN-Drive (VaultDrive) Specific Health Contract

When answering *"¿Cómo estás, güey?"* for `/lamp/www/ABRN-Drive`:

| Layer / Probe | Source / Surface | What `ok` requires | What `degraded` / `blocked` means |
|---|---|---|---|
| **Go Backend Liveness & Readiness** | `http://127.0.0.1:8082/api/health` / `abrndrive.service` | HTTP 200 JSON, DB ping `<15ms`, schema version `== 50` | `blocked` if schema `< 50` (fail-closed boundary) or DB unreachable |
| **Encrypted Blob Storage** | `uploads/` / configured blob root | Directory exists, writable, disk `<85%` full, ciphertext count matches DB | `blocked` if unwritable; `degraded` if disk `>85%` |
| **Frontend Production Bundle** | `vaultdrive_client/dist/index.html` | Present, non-empty, SHA-256 matches latest verified build | `degraded` if serving stale unbuilt bundle |
| **Client-Side WebCrypto & SessionVault** | `window.crypto.subtle`, `SessionVaultProvider.tsx`, `vault-search-index.ts` | Secure context (`https://` or `localhost`), AES-256-GCM key unwrap functional, `VaultSearchIndex` responsive (`<1.5ms`) | `blocked` on insecure HTTP origin where `crypto.subtle` is disabled |
| **Offline Rescue Ledger** | IndexedDB `rescue-ledger` | Readable/writable, `0` stuck un-retried mutations | `degraded` if pending offline queue has un-synced items waiting for reconnection |
| **Secure Drop & Shamir Recovery** | `/drop/:token`, `/api/recovery/*` | Delivery-key wrapping and custodian threshold state readable | `human_attention` when a custodian approval or expiring drop requires owner action |

### Never Expose in ABRN-Drive Health Responses
- Master encryption keys, PBKDF2/Argon2 salts, URL `#fragment` share keys, JWT/session cookies, `.env` / `/etc/abrndrive/runtime.env` secrets, or unencrypted file contents/snippets.

# Closing law

> **"Como estás, güey?" is not a ping. It is a request for operational truth.**

The correct answer may be:
- "Bien."
- "Vivo pero madreado."
- "Estoy bloqueado."
- "No sé todavía."
- "Necesito que un humano decida."

All five are better than lying.
