# Step 8 — Own Domain: `abrndrive.filemonprime.net`

## Goal

Move the primary access point from `https://dev-app.filemonprime.net/abrn/` to `https://abrndrive.filemonprime.net`. Clean URL, own identity, no shared-path clutter.

The old URL stays working indefinitely — this is an additive change.

---

## What Changes, What Doesn't

| Layer | Change | Risk |
|-------|--------|------|
| Apache | Add `abrndrive.conf` + `abrndrive-ssl.conf` (new files only) | None — purely additive |
| Apache reload | `kill -HUP` graceful reload | Zero downtime — in-flight requests finish normally |
| Frontend | Build with `VITE_API_URL=/api` env var | One env var, zero code changes |
| `vaultdrive_client/src/components/upload/types.ts:46` | Fix hardcoded `/abrn/drop/` fallback | 1-line fix |
| Go backend | **Nothing** | Apache already strips `/abrn/` today — Go only ever sees `/api/...` |
| `dev-app.filemonprime.net/abrn/` | **Not touched** | Old URL continues to work |
| Other apps (Quantix, Port Scanner, File Manager) | **Not touched** | Separate vhosts, separate ports |
| SSL | New Let's Encrypt cert via certbot | Non-disruptive — certbot only adds files |

---

## Why No Go Changes Are Needed

The current Apache proxy rule in `portscanner.conf` and `dev-app-ssl.conf`:

```apache
ProxyPass /abrn/ http://localhost:8082/
ProxyPassReverse /abrn/ http://localhost:8082/
```

This already strips `/abrn/` before forwarding to Go. The backend has always received clean paths (`/api/login`, not `/abrn/api/login`). The new vhost does the same thing without any prefix — Go sees identical requests from both domains.

---

## Why No Frontend Code Changes Are Needed

`vaultdrive_client/src/utils/api.ts` line 1:

```typescript
export const API_URL = import.meta.env.VITE_API_URL || "/abrn/api";
```

`VITE_API_URL` is already the hook for deployment-time configuration. Building with `VITE_API_URL=/api` makes all API calls relative (`/api/login`, `/api/files`, etc.) — they work on any domain without changes to any page or component.

---

## The One Code Fix

`vaultdrive_client/src/components/upload/types.ts`, line 46:

```typescript
// Before
upload_url: raw.upload_url || `/abrn/drop/${raw.token || raw.id}`,

// After
upload_url: raw.upload_url || `/drop/${raw.token || raw.id}`,
```

The backend always returns `upload_url` in the response, so this fallback is rarely hit. Still worth fixing so it doesn't break on the new domain.

---

## Apache Config Files (New)

### `/lamp/apache2/conf/extra/abrndrive.conf`

```apache
<VirtualHost *:80>
    ServerName abrndrive.filemonprime.net
    Redirect permanent / https://abrndrive.filemonprime.net/
</VirtualHost>
```

### `/lamp/apache2/conf/extra/abrndrive-ssl.conf`

```apache
<VirtualHost *:443>
    ServerName abrndrive.filemonprime.net

    SSLEngine on
    SSLCertificateFile    /etc/letsencrypt/live/abrndrive.filemonprime.net/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/abrndrive.filemonprime.net/privkey.pem

    ProxyPreserveHost On
    ProxyTimeout 600

    ProxyPass / http://localhost:8082/
    ProxyPassReverse / http://localhost:8082/

    <Location />
        Header set Access-Control-Allow-Origin "*"
        Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
        Header set Access-Control-Allow-Headers "Content-Type, Authorization"
    </Location>

    ErrorLog  /lamp/apache2/logs/abrndrive_error.log
    CustomLog /lamp/apache2/logs/abrndrive_access.log combined
</VirtualHost>
```

Both files must be `Include`'d in `/lamp/apache2/conf/httpd.conf` (same pattern as existing `naval.conf`, `speed.conf`).

---

## Execution Order

All steps below are safe to run without service interruption.

### Step 1 — DNS
Add A record (or CNAME to `dev-app.filemonprime.net`):
```
abrndrive.filemonprime.net → <server IP>
```
DNS propagation takes 1–5 minutes on typical setups.

### Step 2 — SSL Certificate
```bash
sudo certbot certonly --apache -d abrndrive.filemonprime.net
```
If Apache isn't on port 80 or certbot's Apache plugin has issues, use standalone:
```bash
sudo certbot certonly --standalone -d abrndrive.filemonprime.net
```
Certbot adds cert files under `/etc/letsencrypt/live/abrndrive.filemonprime.net/`. No existing certs or apps are touched.

### Step 3 — Fix Hardcoded Path (1 line)
In `vaultdrive_client/src/components/upload/types.ts`:
```typescript
// Change:
upload_url: raw.upload_url || `/abrn/drop/${raw.token || raw.id}`,
// To:
upload_url: raw.upload_url || `/drop/${raw.token || raw.id}`,
```

### Step 4 — Build Frontend with New API URL
```bash
cd /lamp/www/ABRN-Drive/vaultdrive_client
VITE_API_URL=/api npm run build
```
This rebuilds `dist/` with relative API paths. The existing `dev-app.filemonprime.net/abrn/` URL will also work because Apache still proxies to the same `dist/` folder.

### Step 5 — Create Apache Config Files
```bash
# Create the two config files shown above
# Then include them in httpd.conf:
echo "Include /lamp/apache2/conf/extra/abrndrive.conf" >> /lamp/apache2/conf/httpd.conf
echo "Include /lamp/apache2/conf/extra/abrndrive-ssl.conf" >> /lamp/apache2/conf/httpd.conf
```

### Step 6 — Validate Config
```bash
/lamp/apache2/bin/apachectl configtest
# Must output: "Syntax OK" — do NOT proceed if it doesn't
```

### Step 7 — Graceful Reload (Zero Downtime)
```bash
kill -HUP $(cat /lamp/apache2/logs/httpd.pid)
```
`-HUP` is a graceful reload: Apache finishes all active requests on the old config, then workers pick up the new config. No connections are dropped.

### Step 8 — Smoke Tests
```bash
# New domain API health
curl -i https://abrndrive.filemonprime.net/api/health

# Old domain still works
curl -i https://dev-app.filemonprime.net/abrn/api/health

# Login works on new domain
curl -X POST https://abrndrive.filemonprime.net/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

### Step 9 — Update AGENT_MASTER.md
Change the canonical URL reference from `https://dev-app.filemonprime.net/abrn/` to `https://abrndrive.filemonprime.net` in AGENT_MASTER.md.

---

## Rollback Plan

If anything goes wrong:

```bash
# Remove the new Includes from httpd.conf
# Graceful reload
kill -HUP $(cat /lamp/apache2/logs/httpd.pid)
```

The old URL never stops working throughout — there's nothing to roll back on that side.

---

## After Migration

Once confirmed stable, the old `/abrn/` proxy in `portscanner.conf` and `dev-app-ssl.conf` can be removed in a future cleanup. Do not remove it until the new domain is confirmed working for a reasonable period.

### Frontend build going forward

Add `VITE_API_URL=/api` to the project's build environment permanently. The simplest approach is a `.env.production` file:

```bash
# vaultdrive_client/.env.production
VITE_API_URL=/api
```

Then `npm run build` always produces a relative-path build without having to remember the env var.

---

## Existing Apps — Not Affected

| App | URL | Config | Impact |
|-----|-----|--------|--------|
| Quantix | `dev-app.filemonprime.net/quantix/` | `portscanner.conf` | None |
| Port Scanner | `dev-app.filemonprime.net/portscanner/frontend/` | `portscanner.conf` | None |
| File Manager | `dev-app.filemonprime.net/file_manager/` | `dev-app.conf` | None |
| abrnmx | `dev-app.filemonprime.net/abrnmx/` | `portscanner.conf` | None |
| Naval | `naval.filemonprime.net` | `naval.conf` | None |
| Speed | `speed.filemonprime.net` | `speed.conf` | None |

All use separate VirtualHost entries or separate Location blocks. The new `abrndrive.conf` and `abrndrive-ssl.conf` are completely separate files with a separate `ServerName`. Apache routes by `ServerName` — they cannot interfere.
