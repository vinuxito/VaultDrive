# QuantiX Drive Agent API Integration Specification

This document is the integration contract for QuantiX Drive agent API keys as implemented in the current codebase. It is intended for both human developers and AI agents that need to authenticate, choose scopes, and call the live API safely.

Verified against the current implementation in `main.go`, `middleware_actor.go`, `handle_agent_api_keys.go`, `agent_api_keys.go`, `json_v1.go`, and the current v1 handlers.

Base URL used in examples: `https://your-quantix-instance.example.com`

## Overview

Agent API keys let a QuantiX Drive user delegate narrowly scoped API access to an external agent, automation worker, or integration without handing over a reusable user password or browser session.

Use an agent API key when you need:

- server-to-server access to QuantiX Drive APIs
- revocable, per-integration credentials
- least-privilege access with explicit scopes
- auditability for every delegated action

Trust boundary:

- QuantiX Drive remains ciphertext-first
- agent keys can move ciphertext and operate the control plane
- agent keys do not grant silent plaintext decryption authority
- downloading ciphertext still does not give the agent the owner's private key

## Authentication

### Header format

Send the key in the standard bearer header:

```http
Authorization: Bearer qxak_<random>
```

### How keys are detected

Agent-key detection is prefix-based.

- the runtime checks whether the bearer token starts with `AGENT_KEY_PREFIX + "_"`
- in the default QuantiX Drive configuration, issued keys therefore look like `qxak_<random>`
- legacy prefixes may also remain valid if the deployment configures `AGENT_KEY_LEGACY_PREFIXES`

Practical rule: if your deployment uses the default prefix stem, all new agent keys start with `qxak_`.

### Key lifecycle

An agent key moves through the following states:

1. `created`
2. `active`
3. `expired` or `revoked`

Notes:

- a key is created active
- if `expires_at` is set and the key is later used after expiry, the server marks it expired and rejects the request
- a revoked key is no longer valid

### One-time visibility

The plaintext key is shown once, in the creation response only.

- the server stores only a hash for verification
- the plaintext value cannot be recovered later
- you must copy and persist the plaintext key securely when it is created

### JWT and agent keys

The same `Authorization: Bearer ...` header accepts either:

- a user JWT
- an agent API key

The introspection endpoint tells you which auth type the server resolved for the current request.

## Response Envelope

### Normalized v1 envelope

Many v1 endpoints return the normalized envelope below:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "8b02f7e5-6ef6-4b35-8f6d-7b7d0cf9d1d6",
    "pagination": {
      "count": 20,
      "limit": 20,
      "offset": 0
    }
  }
}
```

Normalized success model:

```json
{ "success": true, "data": "T", "meta": {} }
```

Normalized error model:

```json
{ "success": false, "error": "message", "request_id": "..." }
```

### Actual wire shape in the current implementation

The current code emits errors like this:

```json
{
  "success": false,
  "error": {
    "message": "Invalid token"
  },
  "meta": {
    "request_id": "8b02f7e5-6ef6-4b35-8f6d-7b7d0cf9d1d6"
  }
}
```

### Important compatibility note

Not every route mounted under `/api/v1/...` currently uses the normalized envelope.

The following agent-key-capable handlers currently return direct JSON payloads instead of `{ success, data, meta }`:

- `GET /api/v1/activity`
- `GET /api/v1/files/{fileId}/share-links`
- `POST /api/v1/files/{fileId}/share-link`
- `DELETE /api/v1/share-links/{linkId}`
- `GET /api/v1/file-requests`
- `POST /api/v1/file-requests`
- `DELETE /api/v1/file-requests/{id}`

Integration guidance:

- expect the normalized v1 envelope where documented below
- for the direct-JSON routes above, parse the raw body shape shown in each endpoint section
- always record `X-Request-Id` when present

### Status codes

Common status codes across this surface:

- `200 OK`
- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `429 Too Many Requests`
- `500 Internal Server Error`

## Scopes

The live implementation supports exactly 16 agent scopes.

| Scope | Description |
|---|---|
| `files:list` | List files in the vault. |
| `files:read_metadata` | Read file metadata such as name, size, timestamps, and encrypted metadata fields. |
| `files:upload_ciphertext` | Upload encrypted file data to the vault. |
| `files:download_ciphertext` | Download encrypted file data from the vault. |
| `folders:read` | List folders. |
| `folders:write` | Create and manage folders. |
| `shares:create` | Create public share links for files. |
| `shares:list` | List public share links for a file. |
| `shares:revoke` | Revoke public share links and revoke all external access for a file. |
| `requests:create` | Create file requests. |
| `requests:list` | List file requests. |
| `requests:revoke` | Revoke file requests. |
| `activity:read` | Read activity log entries and, in the current router, the audit log endpoint. |
| `trust:read` | Read file trust and security views such as trust summary, access summary, and file timeline. |
| `api_keys:read` | List agent keys. |
| `api_keys:write` | Create and revoke agent keys. |

## Key Record Shape

Agent key records returned by the server use this shape:

```json
{
  "id": "uuid",
  "name": "Observer Agent",
  "key_prefix": "qxak_xxxxx...",
  "scopes": ["files:list", "activity:read"],
  "status": "active",
  "created_at": "2026-04-14T12:00:00Z",
  "last_used_at": "2026-04-14T12:05:00Z",
  "expires_at": "2026-05-14T12:00:00Z",
  "revoked_at": null,
  "created_by_ip": "203.0.113.10",
  "last_used_ip": "203.0.113.10",
  "last_used_user_agent": "curl/8.7.1",
  "notes": "optional freeform notes",
  "usage_count": 4,
  "plaintext_key": "qxak_<random>"
}
```

`plaintext_key` appears only in the create response.

## Endpoint Compatibility Notes

Some older design notes and some conceptual route names differ from the live router. Use this mapping when integrating.

| Concept | Live implementation | Agent-key capable | Notes |
|---|---|---:|---|
| `GET /api/v1/shares` | `GET /api/v1/shares` | No | Implemented, but currently JWT-only via `middlewareAuth`. |
| `POST /api/v1/shares` | `POST /api/v1/files/{fileId}/share-link` | Yes | No generic create-share endpoint exists. |
| `DELETE /api/v1/shares/{id}` | `DELETE /api/v1/share-links/{linkId}` | Yes | Revokes a public share link by link ID. |
| `GET /api/v1/requests` | `GET /api/v1/file-requests` | Yes | No `/api/v1/requests` alias exists. |
| `POST /api/v1/requests` | `POST /api/v1/file-requests` | Yes | No `/api/v1/requests` alias exists. |
| `DELETE /api/v1/requests/{id}` | `DELETE /api/v1/file-requests/{id}` | Yes | No `/api/v1/requests` alias exists. |
| `GET /api/v1/audit` with `trust:read` | `GET /api/v1/audit` with `activity:read` | Yes | Current router gates audit with `activity:read`. |

## Endpoints

### 1. Create an agent key

**Method**: `POST`  
**URL**: `/api/v1/agent-keys`  
**Required scope(s)**: `api_keys:write`

#### Request body

```json
{
  "name": "Observer Agent",
  "scopes": ["files:list", "activity:read"],
  "expires_at": "2026-05-14T12:00:00Z",
  "notes": "Optional freeform note"
}
```

Validation:

- `name` is required
- `name` must be 64 characters or fewer
- `scopes` must contain at least 1 supported scope
- `expires_at`, when present, must be RFC3339
- if the caller is itself an agent key, the requested scopes must be equal to or narrower than the caller's scopes

#### Response body

Normalized v1 envelope. `data` is a full key record and includes `plaintext_key`.

```json
{
  "success": true,
  "data": {
    "id": "9f4c6a2e-8b2a-4d9f-a5a2-f1a6f2d22d3b",
    "name": "Observer Agent",
    "key_prefix": "qxak_kN4QY4nE8W3...",
    "scopes": ["activity:read", "files:list"],
    "status": "active",
    "created_at": "2026-04-14T12:00:00Z",
    "usage_count": 0,
    "plaintext_key": "qxak_kN4QY4nE8W3l..."
  },
  "meta": {
    "request_id": "..."
  }
}
```

#### Status codes

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 2. List agent keys

**Method**: `GET`  
**URL**: `/api/v1/agent-keys`  
**Required scope(s)**: `api_keys:read`

#### Request body

None.

#### Response body

Normalized v1 envelope. `data` is an array of key records without `plaintext_key`.

```json
{
  "success": true,
  "data": [
    {
      "id": "9f4c6a2e-8b2a-4d9f-a5a2-f1a6f2d22d3b",
      "name": "Observer Agent",
      "key_prefix": "qxak_kN4QY4nE8W3...",
      "scopes": ["activity:read", "files:list"],
      "status": "active",
      "created_at": "2026-04-14T12:00:00Z",
      "usage_count": 3
    }
  ],
  "meta": {
    "request_id": "...",
    "pagination": {
      "count": 1
    }
  }
}
```

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 3. Revoke an agent key

**Method**: `DELETE`  
**URL**: `/api/v1/agent-keys/{id}`  
**Required scope(s)**: `api_keys:write`

#### Request body

None.

#### Response body

Normalized v1 envelope. `data` is the revoked key record.

```json
{
  "success": true,
  "data": {
    "id": "9f4c6a2e-8b2a-4d9f-a5a2-f1a6f2d22d3b",
    "name": "Observer Agent",
    "key_prefix": "qxak_kN4QY4nE8W3...",
    "scopes": ["activity:read", "files:list"],
    "status": "revoked",
    "created_at": "2026-04-14T12:00:00Z",
    "revoked_at": "2026-04-14T12:10:00Z",
    "usage_count": 3
  },
  "meta": {
    "request_id": "..."
  }
}
```

#### Status codes

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`

### 4. Introspect current authentication

**Method**: `GET`  
**URL**: `/api/v1/auth/introspect`  
**Required scope(s)**: none beyond valid authentication

#### Request body

None.

#### Response body

Normalized v1 envelope.

For a JWT caller:

```json
{
  "success": true,
  "data": {
    "auth_type": "jwt",
    "user_id": "3c8e5d9a-54f1-4f86-a652-08df2f6a3de9"
  },
  "meta": {
    "request_id": "..."
  }
}
```

For an agent-key caller:

```json
{
  "success": true,
  "data": {
    "auth_type": "agent_api_key",
    "user_id": "3c8e5d9a-54f1-4f86-a652-08df2f6a3de9",
    "scopes": ["activity:read", "files:list"],
    "key_id": "9f4c6a2e-8b2a-4d9f-a5a2-f1a6f2d22d3b"
  },
  "meta": {
    "request_id": "..."
  }
}
```

#### Status codes

- `200 OK`
- `401 Unauthorized`

### 5. List files

**Method**: `GET`  
**URL**: `/api/v1/files`  
**Required scope(s)**: `files:list`

#### Request body

None.

Optional query params:

- `q`: case-insensitive filename search

#### Response body

Normalized v1 envelope. `data` is an array of file summaries.

```json
{
  "success": true,
  "data": [
    {
      "id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
      "filename": "report.qxd",
      "file_size": 48211,
      "created_at": "2026-04-14T12:30:00Z",
      "starred": false,
      "is_owner": true,
      "metadata": "{\"iv\":\"...\",\"salt\":\"...\",\"algorithm\":\"AES-256-GCM\"}",
      "origin": "vault_upload"
    }
  ],
  "meta": {
    "request_id": "...",
    "pagination": {
      "count": 1
    }
  }
}
```

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 6. Read file metadata

**Method**: `GET`  
**URL**: `/api/v1/files/{id}`  
**Required scope(s)**: `files:read_metadata`

#### Request body

None.

#### Response body

Normalized v1 envelope.

```json
{
  "success": true,
  "data": {
    "id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
    "filename": "report.qxd",
    "file_size": 48211,
    "created_at": "2026-04-14T12:30:00Z",
    "updated_at": "2026-04-14T12:30:00Z",
    "starred": false,
    "metadata": "{\"iv\":\"...\",\"salt\":\"...\",\"algorithm\":\"AES-256-GCM\"}"
  },
  "meta": {
    "request_id": "..."
  }
}
```

#### Status codes

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`

### 7. Upload ciphertext

**Method**: `POST`  
**URL**: `/api/v1/files/upload`  
**Required scope(s)**: `files:upload_ciphertext`

#### Request body

`multipart/form-data`

Required parts:

- `file`: encrypted file payload
- `wrapped_key`: wrapped file key for the owner

Optional parts:

- `iv`
- `salt`
- `algorithm`
- `credential_scheme` (`password` by default if omitted)

#### Response body

Normalized v1 envelope.

```json
{
  "success": true,
  "data": {
    "id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
    "filename": "report.qxd",
    "file_size": 48211,
    "created_at": "2026-04-14T12:30:00Z"
  },
  "meta": {
    "request_id": "..."
  }
}
```

#### Status codes

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 8. Download ciphertext

**Method**: `GET`  
**URL**: `/api/v1/files/{id}/download`  
**Required scope(s)**: `files:download_ciphertext`

#### Request body

None.

#### Response body

Raw ciphertext bytes.

Important headers:

- `Content-Type: application/octet-stream`
- `Content-Disposition: attachment; filename="..."`
- `X-File-Metadata: {json}` when metadata exists
- `X-Wrapped-Key: ...` when the wrapped key is available to the caller
- `X-Request-Id: ...`

#### Status codes

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

### 9. List folders

**Method**: `GET`  
**URL**: `/api/v1/folders`  
**Required scope(s)**: `folders:read`

#### Request body

None.

#### Response body

Normalized v1 envelope. `data` is an array of folders.

```json
{
  "success": true,
  "data": [
    {
      "id": "9b3a9fc5-87c4-4d79-b9cb-b5d93bd4d6fd",
      "name": "Invoices",
      "parentId": "",
      "createdAt": "2026-04-01T12:00:00Z",
      "updatedAt": "2026-04-01T12:00:00Z"
    }
  ],
  "meta": {
    "request_id": "...",
    "pagination": {
      "count": 1
    }
  }
}
```

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 10. File trust summary

**Method**: `GET`  
**URL**: `/api/v1/files/{id}/trust`  
**Required scope(s)**: `trust:read`

#### Request body

None.

#### Response body

JSON trust summary for an owned file, including:

- `file_id`
- `protection`
- `owner_label`
- `visibility_summary`
- `access_state`
- `origin`
- `latest_activity`
- `entries`
- optionally `timeline`

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`

### 11. File access summary

**Method**: `GET`  
**URL**: `/api/v1/files/{id}/access-summary`  
**Required scope(s)**: `trust:read`

#### Request body

None.

#### Response body

JSON access-entry list describing the file's current visibility and grants.

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`

### 12. File security timeline

**Method**: `GET`  
**URL**: `/api/v1/files/{id}/timeline`  
**Required scope(s)**: `trust:read`

#### Request body

None.

#### Response body

JSON timeline of file security events such as upload, secure-drop intake, direct share, group share, link creation, access, revoke, and expiry.

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`

### 13. List public share links for a file

**Method**: `GET`  
**URL**: `/api/v1/files/{fileId}/share-links`  
**Required scope(s)**: `shares:list`

#### Request body

None.

#### Response body

Direct JSON array, not the normalized v1 envelope.

```json
[
  {
    "id": "b5d74d77-16a2-49a6-90d3-f9d0bdf31db3",
    "token": "5ff0...",
    "file_id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
    "expires_at": "2026-04-21T12:30:00Z",
    "is_active": true,
    "created_at": "2026-04-14T12:31:00Z"
  }
]
```

#### Status codes

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 14. Create a public share link for a file

**Method**: `POST`  
**URL**: `/api/v1/files/{fileId}/share-link`  
**Required scope(s)**: `shares:create`

#### Request body

```json
{
  "expires_at": "2026-04-21T12:31:00Z"
}
```

If `expires_at` is omitted, the server defaults to 7 days.

#### Response body

Direct JSON object, not the normalized v1 envelope.

```json
{
  "id": "b5d74d77-16a2-49a6-90d3-f9d0bdf31db3",
  "token": "5ff0...",
  "file_id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
  "expires_at": "2026-04-21T12:31:00Z",
  "is_active": true,
  "created_at": "2026-04-14T12:31:00Z"
}
```

#### Status codes

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `500 Internal Server Error`

### 15. Revoke a public share link

**Method**: `DELETE`  
**URL**: `/api/v1/share-links/{linkId}`  
**Required scope(s)**: `shares:revoke`

#### Request body

None.

#### Response body

Direct JSON object, not the normalized v1 envelope.

```json
{
  "status": "success",
  "message": "Share link revoked"
}
```

#### Status codes

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 16. Revoke all external access for a file

**Method**: `DELETE`  
**URL**: `/api/v1/files/{id}/revoke-external`  
**Required scope(s)**: `shares:revoke`

#### Request body

None.

#### Response body

JSON confirmation that external access was revoked for the file.

#### Status codes

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`

### 17. List file requests

**Method**: `GET`  
**URL**: `/api/v1/file-requests`  
**Required scope(s)**: `requests:list`

#### Request body

None.

#### Response body

Direct JSON array, not the normalized v1 envelope.

```json
[
  {
    "id": "bbf18689-3f77-4d1d-aec9-1c1022d7af24",
    "token": "84c8...",
    "description": "Upload signed contract",
    "expires_at": "2026-04-21T12:00:00Z",
    "is_active": true,
    "max_file_size": 10485760,
    "uploaded_count": 0,
    "request_url": "/quantix/request/84c8...",
    "created_at": "2026-04-14T12:00:00Z"
  }
]
```

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 18. Create a file request

**Method**: `POST`  
**URL**: `/api/v1/file-requests`  
**Required scope(s)**: `requests:create`

#### Request body

```json
{
  "description": "Upload signed contract",
  "expires_at": "2026-04-21T12:00:00Z",
  "max_file_size": 10485760
}
```

If `expires_at` is omitted, the server defaults to 7 days.

#### Response body

Direct JSON object, not the normalized v1 envelope.

```json
{
  "id": "bbf18689-3f77-4d1d-aec9-1c1022d7af24",
  "token": "84c8...",
  "description": "Upload signed contract",
  "expires_at": "2026-04-21T12:00:00Z",
  "is_active": true,
  "max_file_size": 10485760,
  "uploaded_count": 0,
  "request_url": "/quantix/request/84c8...",
  "created_at": "2026-04-14T12:00:00Z"
}
```

#### Status codes

- `201 Created`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 19. Revoke a file request

**Method**: `DELETE`  
**URL**: `/api/v1/file-requests/{id}`  
**Required scope(s)**: `requests:revoke`

#### Request body

None.

#### Response body

Direct JSON object, not the normalized v1 envelope.

```json
{
  "success": true
}
```

#### Status codes

- `200 OK`
- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 20. Read activity

**Method**: `GET`  
**URL**: `/api/v1/activity`  
**Required scope(s)**: `activity:read`

#### Request body

None.

#### Response body

Direct JSON array, not the normalized v1 envelope.

```json
[
  {
    "id": "d8079361-ef46-4696-bf6f-3b448f82f996",
    "event_type": "file_upload",
    "message": "File uploaded: report.qxd",
    "created_at": "2026-04-14T12:30:00Z"
  }
]
```

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

### 21. Read audit log

**Method**: `GET`  
**URL**: `/api/v1/audit`  
**Required scope(s)**: `activity:read` in the live router

#### Request body

None.

Optional query params:

- `action`
- `resource_type`
- `resource_id`
- `from` (RFC3339)
- `to` (RFC3339)
- `limit` (default `50`, max `500`)
- `offset` (default `0`)

#### Response body

Normalized v1 envelope.

```json
{
  "success": true,
  "data": [
    {
      "id": "560f0ef3-b80c-4cc6-b274-10d1cf550fd5",
      "action": "agent_api_key.used",
      "resource_type": "agent_api_key",
      "resource_id": "9f4c6a2e-8b2a-4d9f-a5a2-f1a6f2d22d3b",
      "ip_address": "203.0.113.10",
      "metadata": {
        "path": "/api/v1/files",
        "method": "GET"
      },
      "created_at": "2026-04-14T12:05:00Z"
    }
  ],
  "meta": {
    "request_id": "...",
    "pagination": {
      "count": 1,
      "limit": 50,
      "offset": 0
    }
  }
}
```

#### Status codes

- `200 OK`
- `401 Unauthorized`
- `403 Forbidden`
- `500 Internal Server Error`

## Rate Limiting

Agent-key requests are rate-limited in two layers:

- per key: `60 requests/minute`
- global per IP: `100 requests/minute`

When a limit is hit, the server returns:

- status `429 Too Many Requests`
- header `Retry-After: 60`

Example:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
  "success": false,
  "error": {
    "message": "Rate limit exceeded for this agent key"
  },
  "meta": {
    "request_id": "..."
  }
}
```

## Usage Examples

### Example 1: Read-Only Observer Agent

This agent can inspect the vault but not mutate anything.

Granted scopes:

- `files:list`
- `files:read_metadata`
- `activity:read`
- `trust:read`

#### Step 1: Create the key with a user JWT

```bash
BASE="https://your-quantix-instance.example.com"
USER_JWT="<user-jwt-with-api_keys:write>"

curl -sS -X POST "$BASE/api/v1/agent-keys" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Read-Only Observer Agent",
    "scopes": [
      "files:list",
      "files:read_metadata",
      "activity:read",
      "trust:read"
    ],
    "expires_at": "2026-05-14T12:00:00Z",
    "notes": "Observes files and security history only"
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "id": "9f4c6a2e-8b2a-4d9f-a5a2-f1a6f2d22d3b",
    "name": "Read-Only Observer Agent",
    "key_prefix": "qxak_kN4QY4nE8W3...",
    "scopes": [
      "activity:read",
      "files:list",
      "files:read_metadata",
      "trust:read"
    ],
    "status": "active",
    "created_at": "2026-04-14T12:00:00Z",
    "usage_count": 0,
    "plaintext_key": "qxak_kN4QY4nE8W3l..."
  },
  "meta": {
    "request_id": "..."
  }
}
```

Save the one-time plaintext key:

```bash
AGENT_KEY="qxak_kN4QY4nE8W3l..."
```

#### Step 2: List files

```bash
curl -sS "$BASE/api/v1/files" \
  -H "Authorization: Bearer $AGENT_KEY"
```

Expected response:

```json
{
  "success": true,
  "data": [
    {
      "id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
      "filename": "report.qxd",
      "file_size": 48211,
      "created_at": "2026-04-14T12:30:00Z",
      "starred": false,
      "is_owner": true,
      "origin": "vault_upload"
    }
  ],
  "meta": {
    "request_id": "...",
    "pagination": {
      "count": 1
    }
  }
}
```

#### Step 3: Read metadata for one file

```bash
FILE_ID="2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0"

curl -sS "$BASE/api/v1/files/$FILE_ID" \
  -H "Authorization: Bearer $AGENT_KEY"
```

Expected response:

```json
{
  "success": true,
  "data": {
    "id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
    "filename": "report.qxd",
    "file_size": 48211,
    "created_at": "2026-04-14T12:30:00Z",
    "updated_at": "2026-04-14T12:30:00Z",
    "starred": false,
    "metadata": "{\"iv\":\"...\",\"salt\":\"...\",\"algorithm\":\"AES-256-GCM\"}"
  },
  "meta": {
    "request_id": "..."
  }
}
```

#### Step 4: Read the activity log

```bash
curl -sS "$BASE/api/v1/activity" \
  -H "Authorization: Bearer $AGENT_KEY"
```

Expected response:

```json
[
  {
    "id": "d8079361-ef46-4696-bf6f-3b448f82f996",
    "event_type": "file_upload",
    "message": "File uploaded: report.qxd",
    "created_at": "2026-04-14T12:30:00Z"
  }
]
```

#### Step 5: Read file trust data

```bash
curl -sS "$BASE/api/v1/files/$FILE_ID/trust" \
  -H "Authorization: Bearer $AGENT_KEY"
```

Expected response:

```json
{
  "file_id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
  "protection": "Browser-encrypted ciphertext stored server-side",
  "owner_label": "You",
  "visibility_summary": "Only you",
  "access_state": "private",
  "origin": "vault_upload",
  "latest_activity": "Ciphertext stored in your vault",
  "entries": [
    {
      "kind": "owner",
      "label": "Owner only",
      "since": "2026-04-14T12:30:00Z",
      "state": "active"
    }
  ]
}
```

### Example 2: Full Ciphertext Operator Agent

This agent performs ciphertext operations and control-plane tasks, but still has no plaintext decryption authority.

Granted scopes:

- `files:list`
- `files:read_metadata`
- `files:upload_ciphertext`
- `files:download_ciphertext`
- `folders:read`
- `folders:write`
- `shares:create`
- `shares:list`
- `shares:revoke`
- `requests:create`
- `requests:list`
- `requests:revoke`
- `activity:read`
- `trust:read`

#### Step 1: Create the key with a user JWT

```bash
BASE="https://your-quantix-instance.example.com"
USER_JWT="<user-jwt-with-api_keys:write>"

curl -sS -X POST "$BASE/api/v1/agent-keys" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Full Ciphertext Operator Agent",
    "scopes": [
      "files:list",
      "files:read_metadata",
      "files:upload_ciphertext",
      "files:download_ciphertext",
      "folders:read",
      "folders:write",
      "shares:create",
      "shares:list",
      "shares:revoke",
      "requests:create",
      "requests:list",
      "requests:revoke",
      "activity:read",
      "trust:read"
    ],
    "notes": "Full ciphertext operator without api-key-management scopes"
  }'
```

Save the returned plaintext key:

```bash
AGENT_KEY="qxak_..."
```

#### Step 2: Upload an encrypted file

```bash
WRAPPED_KEY="<owner-wrapped-file-key>"
IV_B64="<base64-iv>"
SALT_B64="<base64-salt>"

curl -sS -X POST "$BASE/api/v1/files/upload" \
  -H "Authorization: Bearer $AGENT_KEY" \
  -F "file=@encrypted.bin;type=application/octet-stream" \
  -F "wrapped_key=$WRAPPED_KEY" \
  -F "iv=$IV_B64" \
  -F "salt=$SALT_B64" \
  -F "algorithm=AES-256-GCM" \
  -F "credential_scheme=password"
```

Expected response:

```json
{
  "success": true,
  "data": {
    "id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
    "filename": "encrypted.bin",
    "file_size": 48211,
    "created_at": "2026-04-14T12:30:00Z"
  },
  "meta": {
    "request_id": "..."
  }
}
```

Capture the file ID:

```bash
FILE_ID="2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0"
```

#### Step 3: Create a public share link for the uploaded ciphertext

```bash
curl -sS -X POST "$BASE/api/v1/files/$FILE_ID/share-link" \
  -H "Authorization: Bearer $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"expires_at":"2026-04-21T12:31:00Z"}'
```

Expected response:

```json
{
  "id": "b5d74d77-16a2-49a6-90d3-f9d0bdf31db3",
  "token": "5ff0...",
  "file_id": "2f8294af-c1ad-4d98-96f9-f7d6ed38a5e0",
  "expires_at": "2026-04-21T12:31:00Z",
  "is_active": true,
  "created_at": "2026-04-14T12:31:00Z"
}
```

Capture the share-link ID:

```bash
LINK_ID="b5d74d77-16a2-49a6-90d3-f9d0bdf31db3"
```

#### Step 4: List file requests

```bash
curl -sS "$BASE/api/v1/file-requests" \
  -H "Authorization: Bearer $AGENT_KEY"
```

Expected response:

```json
[
  {
    "id": "bbf18689-3f77-4d1d-aec9-1c1022d7af24",
    "token": "84c8...",
    "description": "Upload signed contract",
    "expires_at": "2026-04-21T12:00:00Z",
    "is_active": true,
    "max_file_size": 10485760,
    "uploaded_count": 0,
    "request_url": "/quantix/request/84c8...",
    "created_at": "2026-04-14T12:00:00Z"
  }
]
```

#### Step 5: Revoke the share link

```bash
curl -sS -X DELETE "$BASE/api/v1/share-links/$LINK_ID" \
  -H "Authorization: Bearer $AGENT_KEY"
```

Expected response:

```json
{
  "status": "success",
  "message": "Share link revoked"
}
```

## Security Notes

- Agent keys are ciphertext-only. They do not create a silent plaintext decryption path.
- Agent keys can create child keys only with equal or narrower scopes than the caller already has.
- All key lifecycle events and all authenticated agent-key actions are written to the audit trail.
- Keys auto-expire when `expires_at` is set and the key is used after expiry.
- Scope failures are explicit: the server returns `403 Forbidden` with `API key scope denied`.
- A revoked or expired key returns `401 Unauthorized` and cannot continue operating.
