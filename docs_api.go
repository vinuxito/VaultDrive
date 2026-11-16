package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

func opDoc(summary, description, secScheme string, extra ...map[string]interface{}) map[string]interface{} {
	op := map[string]interface{}{
		"summary":     summary,
		"description": description,
		"security": []map[string][]string{
			{secScheme: {}},
		},
		"responses": map[string]interface{}{
			"200": map[string]interface{}{
				"description": "Structured v1 response envelope",
				"content": map[string]interface{}{
					"application/json": map[string]interface{}{
						"schema": map[string]interface{}{"$ref": "#/components/schemas/V1Response"},
					},
				},
			},
			"401": map[string]interface{}{"description": "Unauthorized or invalid credential"},
			"403": map[string]interface{}{"description": "Forbidden (insufficient scope, folder jail, IP allowlist, or delete-only restriction)"},
		},
	}
	for _, m := range extra {
		for k, v := range m {
			op[k] = v
		}
	}
	return op
}

// buildOpenAPIV1Paths is the single canonical catalog for all /api/v1/ agent & governance routes.
// Tested by TestOpenAPISpecMatchesRegisteredV1Routes to keep Swagger/OpenAPI synced with main.go.
func buildOpenAPIV1Paths() map[string]interface{} {
	return map[string]interface{}{
		// Docs & OpenAPI Spec (Public)
		"/api/v1/docs": map[string]interface{}{
			"get": opDoc("Interactive OpenAPI & Trust Boundary Explorer", "Serves the self-contained CSP-compliant interactive API reference UI.", "", map[string]interface{}{"security": []interface{}{}}),
		},
		"/api/v1/openapi.json": map[string]interface{}{
			"get": opDoc("OpenAPI 3.0.3 Schema Document", "Returns the live machine-readable OpenAPI 3.0.3 JSON specification for all /api/v1/ endpoints.", "", map[string]interface{}{"security": []interface{}{}}),
		},
		// Auth & Keys
		"/api/v1/auth/introspect": map[string]interface{}{
			"get": opDoc("Introspect current credential", "Returns auth_type, active scopes, key_kind, allowed_folder_ids, allowed_ips, rate_limit_rpm, and owner RSA public key.", "AgentBearerKey"),
		},
		"/api/v1/users/me/public-key": map[string]interface{}{
			"get": opDoc("Get vault owner RSA-OAEP public key", "Fetches the owner SPKI PEM public key so an external agent can wrap fresh AES-256-GCM DEKs with credential_scheme=rsa.", "AgentBearerKey"),
		},
		"/api/v1/users/{id}/public-key": map[string]interface{}{
			"get": opDoc("Get recipient RSA-OAEP public key", "Fetches another user's public key for zero-knowledge file or folder sharing.", "AgentBearerKey"),
		},
		"/api/v1/agent-keys": map[string]interface{}{
			"get":  opDoc("List agent API keys", "Requires api_keys:read (or JWT).", "AgentBearerKey"),
			"post": opDoc("Create attenuated child key or Special Delete-Only key", "Human JWT can mint standard or Special Delete-Only (abrnak_del_) keys with optional allowed_folder_ids (recursive subtree jail), allowed_ips (CIDR/IP allowlist), and rate_limit_rpm (1-6000, default 60). Agent keys with api_keys:write can only mint attenuated child keys within their own scope/folder/IP/RPM subset and can never mint files:soft_delete.", "AgentBearerKey"),
		},
		"/api/v1/agent-keys/{id}": map[string]interface{}{
			"delete": opDoc("Revoke agent API key", "Immediately revokes an agent or delete-only API key.", "AgentBearerKey"),
		},

		// Folders
		"/api/v1/folders": map[string]interface{}{
			"get":  opDoc("List accessible folders", "Requires folders:read. Respects folder-jailing when configured.", "AgentBearerKey"),
			"post": opDoc("Create folder", "Requires folders:write. Supports optional parent_id / parentId and Idempotency-Key.", "AgentBearerKey"),
		},
		"/api/v1/folders/shared": map[string]interface{}{
			"get": opDoc("List folders shared with caller", "Returns folders shared with the owner or bot account including wrapped folder keys.", "AgentBearerKey"),
		},
		"/api/v1/folders/{id}": map[string]interface{}{
			"put":    opDoc("Rename or move folder", "Requires folders:write.", "AgentBearerKey"),
			"delete": opDoc("Soft-delete folder into Recoverable Trash", "Requires Special Delete-Only key (abrnak_del_... / files:soft_delete) or human JWT. Never allowed for standard agent keys. Ciphertext stays recoverable in app Trash.", "AgentDeleteOnlyKey"),
		},
		"/api/v1/folders/{id}/files": map[string]interface{}{
			"get": opDoc("List files inside folder", "Supports owner and shared-folder collaborator access.", "AgentBearerKey"),
		},
		"/api/v1/folders/{folderId}/share-link": map[string]interface{}{
			"post": opDoc("Create public folder share link", "Requires shares:create.", "AgentBearerKey"),
		},
		"/api/v1/folders/{folderId}/share-links": map[string]interface{}{
			"get": opDoc("List folder public share links", "Requires shares:list.", "AgentBearerKey"),
		},
		"/api/v1/folder-share-links/{linkId}": map[string]interface{}{
			"delete": opDoc("Revoke folder share link", "Requires shares:revoke.", "AgentBearerKey"),
		},

		// Encrypted Files Data Plane
		"/api/v1/files": map[string]interface{}{
			"get": opDoc("List owned active files", "Requires files:list. Supports q/search, folder_id, limit, and offset pagination. Excludes soft-deleted Trash items.", "AgentBearerKey"),
		},
		"/api/v1/files/shared": map[string]interface{}{
			"get": opDoc("List files shared with caller", "Requires files:list. Includes direct file shares and shared-folder files with wrapped keys.", "AgentBearerKey"),
		},
		"/api/v1/files/upload": map[string]interface{}{
			"post": opDoc("Upload pre-encrypted ciphertext", "Requires files:upload_ciphertext. Accepts multipart form (file, wrapped_key, iv, algorithm, credential_scheme=rsa|folder|pin|password, optional folder_id & metadata JSON) and supports Idempotency-Key.", "AgentBearerKey"),
		},
		"/api/v1/files/{id}": map[string]interface{}{
			"get":    opDoc("Get file metadata", "Requires files:read_metadata.", "AgentBearerKey"),
			"delete": opDoc("Soft-delete file into Recoverable Trash", "Requires Special Delete-Only key (abrnak_del_... / files:soft_delete) or human JWT. Standard agent keys receive 403 delete_key_required. Ciphertext remains on disk for human restore/purge inside app.", "AgentDeleteOnlyKey"),
		},
		"/api/v1/files/{id}/download": map[string]interface{}{
			"get": opDoc("Download ciphertext & key headers", "Requires files:download_ciphertext. Streams raw encrypted bytes alongside X-File-Metadata, X-Credential-Scheme, X-Wrapped-Key, and X-Folder-Wrapped-Key (when via folder share).", "AgentBearerKey"),
		},
		"/api/v1/files/{id}/folder": map[string]interface{}{
			"put": opDoc("Move file between folders", "Requires folders:write (and folder jail membership on source & destination). Supports optional new_wrapped_key / metadata when re-wrapping for a folder key.", "AgentBearerKey"),
		},
		"/api/v1/files/{id}/move": map[string]interface{}{
			"post": opDoc("Move file between folders (POST alias)", "Alias of PUT /api/v1/files/{id}/folder.", "AgentBearerKey"),
		},
		"/api/v1/files/sync": map[string]interface{}{
			"post": opDoc("Batch rename or soft-delete sync", "Human JWT preserves offline queue sync. Agent bearer keys: rename requires files:write/folders:write; delete requires Special Delete-Only key (abrnak_del_) and performs recoverable soft-delete.", "AgentBearerKey"),
		},

		// Trust, Sharing, Public Links & File Requests
		"/api/v1/files/{id}/access-summary": map[string]interface{}{
			"get": opDoc("Get access visibility summary", "Requires trust:read.", "AgentBearerKey"),
		},
		"/api/v1/files/{id}/trust": map[string]interface{}{
			"get": opDoc("Get file trust posture", "Requires trust:read.", "AgentBearerKey"),
		},
		"/api/v1/files/{id}/timeline": map[string]interface{}{
			"get": opDoc("Get file security timeline", "Requires trust:read.", "AgentBearerKey"),
		},
		"/api/v1/files/{id}/shares": map[string]interface{}{
			"get": opDoc("List active user shares on file", "Requires shares:list.", "AgentBearerKey"),
		},
		"/api/v1/files/{id}/revoke/{user_id}": map[string]interface{}{
			"delete": opDoc("Revoke collaborator file access", "Requires shares:revoke.", "AgentBearerKey"),
		},
		"/api/v1/files/{id}/revoke-external": map[string]interface{}{
			"delete": opDoc("Revoke all external access to file", "Requires shares:revoke.", "AgentBearerKey"),
		},
		"/api/v1/files/{fileId}/share-links": map[string]interface{}{
			"get": opDoc("List public share links for file", "Requires shares:list.", "AgentBearerKey"),
		},
		"/api/v1/files/{fileId}/share-link": map[string]interface{}{
			"post": opDoc("Create public share link for file", "Requires shares:create.", "AgentBearerKey"),
		},
		"/api/v1/share-links/{linkId}": map[string]interface{}{
			"delete": opDoc("Revoke public share link", "Requires shares:revoke.", "AgentBearerKey"),
		},
		"/api/v1/shares": map[string]interface{}{
			"get": opDoc("List all outbound shares", "Returns V1Response when authenticated with AgentBearerKey (shares:list), preserving array format for human web UI JWT callers.", "AgentBearerKey"),
		},
		"/api/v1/file-requests": map[string]interface{}{
			"get":  opDoc("List file collection requests", "Requires requests:list.", "AgentBearerKey"),
			"post": opDoc("Create file collection request", "Requires requests:create.", "AgentBearerKey"),
		},
		"/api/v1/file-requests/{id}": map[string]interface{}{
			"delete": opDoc("Revoke file collection request", "Requires requests:revoke.", "AgentBearerKey"),
		},
		"/api/v1/drop/create": map[string]interface{}{
			"post": opDoc("Create client Secure Drop upload link", "Requires requests:create. Generates a public zero-knowledge drop link targeting an owned folder. Returns nullable expires_at/max_files and a web-root-relative upload_url (<BasePath>drop/<token>#key=<secret>). Agent API keys must omit pin (403 human_jwt_required).", "AgentBearerKey"),
		},
		"/api/v1/drop/tokens": map[string]interface{}{
			"get": opDoc("List Secure Drop upload links", "Requires requests:list.", "AgentBearerKey"),
		},
		"/api/v1/collection-templates": map[string]interface{}{
			"get":  opDoc("List collection request templates", "Requires requests:list (or human JWT).", "AgentBearerKey"),
			"post": opDoc("Create collection request template", "Human JWT endpoint.", "HumanJWT"),
		},
		"/api/v1/collection-templates/{id}": map[string]interface{}{
			"put":    opDoc("Update collection request template", "Human JWT endpoint.", "HumanJWT"),
			"delete": opDoc("Delete collection request template", "Human JWT endpoint.", "HumanJWT"),
		},

		// Audit, Activity, Governance & Realtime
		"/api/v1/activity": map[string]interface{}{
			"get": opDoc("List account activity log", "Requires activity:read.", "AgentBearerKey"),
		},
		"/api/v1/audit": map[string]interface{}{
			"get": opDoc("Query audit log entries", "Requires activity:read. Filter by action, resource_type, and limit.", "AgentBearerKey"),
		},
		"/api/v1/audit/export": map[string]interface{}{
			"get": opDoc("Export audit log CSV", "Requires activity:read. Streams text/csv attachment.", "AgentBearerKey"),
		},
		"/api/v1/governance/settings": map[string]interface{}{
			"get": opDoc("Get governance settings (Human JWT only)", "Strictly human JWT-only. Agent API keys are always denied.", "HumanJWT"),
			"put": opDoc("Update governance settings (Human JWT only)", "Strictly human JWT-only. Agent API keys are always denied.", "HumanJWT"),
		},
		"/api/v1/rooms/{id}/connect": map[string]interface{}{
			"get": opDoc("Connect realtime encrypted signaling WebSocket", "Authenticated WebSocket room channel.", "HumanJWT"),
		},
		"/api/v1/rooms/{id}/broadcast": map[string]interface{}{
			"post": opDoc("Broadcast encrypted room event", "Publishes signed room event payload.", "HumanJWT"),
		},
	}
}

func buildOpenAPISpec(basePathPrefix string) map[string]interface{} {
	return map[string]interface{}{
		"openapi": "3.0.3",
		"info": map[string]interface{}{
			"title":       "ABRN Drive Zero-Knowledge Agent & Vault API",
			"version":     "2.0.0",
			"description": "Zero-Knowledge Agent & Programmatic API. Ciphertext encryption/decryption happens client-side via WebCrypto/RSA-OAEP. Standard agent keys (abrnak_...) cannot delete files or folders; deletion requires a dedicated Special Delete-Only key (abrnak_del_...) and always moves items to 100% app-controlled Recoverable Trash.",
		},
		"servers": []map[string]interface{}{
			{"url": basePathPrefix},
		},
		"paths": buildOpenAPIV1Paths(),
		"components": map[string]interface{}{
			"securitySchemes": map[string]interface{}{
				"AgentBearerKey": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "abrnak_... (or Human JWT)",
					"description":  "Least-privilege automation key with explicit scopes, optional folder subtree jail, optional CIDR IP allowlist, and per-key RPM limit. Never permits deletion or child delete-key delegation.",
				},
				"AgentDeleteOnlyKey": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "abrnak_del_...",
					"description":  "Isolated single-purpose deletion key (exclusive scope files:soft_delete). Sends files/folders only into app-controlled Recoverable Trash; cannot read, list, upload, share, or permanently purge.",
				},
				"HumanJWT": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT",
					"description":  "Interactive human owner session required for governance policy, Trash restore/permanent purge, and minting top-level/delete-only keys.",
				},
			},
			"parameters": map[string]interface{}{
				"IdempotencyKey": map[string]interface{}{
					"name":        "Idempotency-Key",
					"in":          "header",
					"required":    false,
					"description": "Optional unique key (up to 128 chars) for safe retries on POST/PUT v1 endpoints. Returns X-Idempotency-Replayed: true on identical replay or 409 idempotency_conflict on mutated payload.",
					"schema":      map[string]interface{}{"type": "string", "maxLength": 128},
				},
			},
			"schemas": map[string]interface{}{
				"V1Error": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"code": map[string]interface{}{
							"type":        "string",
							"example":     "insufficient_scope",
							"description": "Typed machine error code (e.g. insufficient_scope, delete_key_required, human_jwt_required, folder_scope_denied, ip_not_allowed, rate_limited, idempotency_conflict).",
						},
						"message": map[string]interface{}{"type": "string"},
					},
					"required": []string{"code", "message"},
				},
				"V1Response": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"success": map[string]interface{}{"type": "boolean"},
						"data":    map[string]interface{}{},
						"error":   map[string]interface{}{"$ref": "#/components/schemas/V1Error"},
						"meta": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"request_id": map[string]interface{}{"type": "string", "format": "uuid"},
								"pagination": map[string]interface{}{"type": "object"},
							},
						},
					},
				},
				"AgentAPIKeyCreate": map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"name":               map[string]interface{}{"type": "string"},
						"key_kind":           map[string]interface{}{"type": "string", "enum": []string{"standard", "delete_only"}, "default": "standard"},
						"scopes":             map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
						"expires_in_days":    map[string]interface{}{"type": "integer"},
						"allowed_folder_ids": map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string", "format": "uuid"}, "description": "Optional recursive folder subtree jail."},
						"allowed_ips":        map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}, "description": "Optional IP or CIDR allowlist (e.g. 10.20.0.0/16)."},
						"rate_limit_rpm":     map[string]interface{}{"type": "integer", "minimum": 1, "maximum": 6000, "default": 60},
					},
					"required": []string{"name"},
				},
			},
		},
	}
}

func handleOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	pcfg := LoadProductConfig()
	basePrefix := pcfg.BasePathTrimmed()
	if basePrefix == "" {
		basePrefix = "/"
	}
	_ = json.NewEncoder(w).Encode(buildOpenAPISpec(basePrefix))
}

func handleSwaggerUI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	pcfg := LoadProductConfig()
	basePrefix := strings.TrimSuffix(pcfg.BasePathTrimmed(), "/")
	specURL := basePrefix + "/docs/openapi.json"
	if strings.Contains(r.URL.Path, "/api/v1/docs") {
		specURL = basePrefix + "/api/v1/openapi.json"
	}

	html := `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ABRN Drive OpenAPI & Agent Zero-Knowledge Guide</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #0b1120;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
    }
    header {
      background: #111c33;
      border-bottom: 1px solid #233252;
      padding: 1.5rem 2rem;
    }
    .header-content {
      max-width: 1180px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: space-between;
      align-items: center;
    }
    .header-title h1 {
      margin: 0;
      font-size: 1.45rem;
      font-weight: 700;
      color: #38bdf8;
    }
    .header-title p {
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
      color: #94a3b8;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .pill-zk {
      background: #0369a1;
      color: #f0f9ff;
      padding: 0.45rem 0.9rem;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .spec-link {
      color: #7dd3fc;
      border: 1px solid #1e3a5f;
      background: #0f172a;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .spec-link:hover { background: #1e293b; }
    .container {
      max-width: 1180px;
      margin: 1.75rem auto 3.5rem auto;
      padding: 0 2rem;
    }
    .boundary-card {
      background: #111c33;
      border: 1px solid #233252;
      border-radius: 12px;
      padding: 1.35rem 1.5rem;
      margin-bottom: 1.75rem;
    }
    .boundary-card h2 {
      margin: 0 0 0.75rem 0;
      color: #38bdf8;
      font-size: 1.1rem;
      border-bottom: 1px solid #233252;
      padding-bottom: 0.5rem;
    }
    .boundary-card p, .boundary-card ul {
      color: #cbd5e1;
      font-size: 0.92rem;
      margin: 0.5rem 0;
    }
    .boundary-card code {
      background: #0b1120;
      border: 1px solid #233252;
      border-radius: 4px;
      padding: 0.1rem 0.35rem;
      font-size: 0.85em;
      color: #bae6fd;
    }
    .controls {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .search-input {
      flex: 1 1 260px;
      background: #0f172a;
      border: 1px solid #2c3e66;
      color: #f8fafc;
      border-radius: 8px;
      padding: 0.6rem 0.9rem;
      font-size: 0.9rem;
    }
    .filter-btn {
      background: #111c33;
      color: #cbd5e1;
      border: 1px solid #2c3e66;
      border-radius: 8px;
      padding: 0.5rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
    }
    .filter-btn.active {
      background: #0284c7;
      border-color: #38bdf8;
      color: #ffffff;
    }
    .endpoint-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .op-card {
      background: #111c33;
      border: 1px solid #233252;
      border-radius: 10px;
      overflow: hidden;
    }
    .op-header {
      width: 100%;
      background: transparent;
      border: 0;
      color: inherit;
      padding: 0.85rem 1.1rem;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      text-align: left;
    }
    .op-header:hover { background: #162440; }
    .method-badge {
      display: inline-block;
      min-width: 68px;
      text-align: center;
      font-weight: 700;
      font-size: 0.76rem;
      letter-spacing: 0.04em;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      text-transform: uppercase;
    }
    .m-GET { background: #0c4a6e; color: #7dd3fc; }
    .m-POST { background: #064e3b; color: #6ee7b7; }
    .m-PUT { background: #78350f; color: #fcd34d; }
    .m-DELETE { background: #7f1d1d; color: #fca5a5; }
    .op-path {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.9rem;
      font-weight: 600;
      color: #f8fafc;
    }
    .op-summary {
      font-size: 0.86rem;
      color: #94a3b8;
      margin-left: auto;
    }
    .op-body {
      display: none;
      border-top: 1px solid #233252;
      padding: 0.9rem 1.1rem;
      background: #0d162a;
      font-size: 0.85rem;
    }
    .op-card.open .op-body { display: block; }
    .op-pre {
      background: #060b16;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 0.75rem;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
      color: #cbd5e1;
      margin: 0.5rem 0 0 0;
    }
    .schema-grid {
      margin-top: 1.5rem;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1rem;
    }
    .status-note {
      font-size: 0.85rem;
      color: #94a3b8;
      margin-bottom: 0.75rem;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <div class="header-title">
        <h1>ABRN Drive OpenAPI Specification (/api/v1/)</h1>
        <p>Zero-Knowledge Agent API, Recoverable Trash Boundary & Interactive Reference</p>
      </div>
      <div class="header-actions">
        <a class="spec-link" href="` + specURL + `" target="_blank" rel="noopener">Raw OpenAPI 3.0 JSON</a>
        <span class="pill-zk">Zero-Knowledge Verified</span>
      </div>
    </div>
  </header>

  <div class="container">
    <div class="boundary-card">
      <h2>Architectural Trust & Control Boundaries</h2>
      <p>ABRN Drive enforces strict <strong>Zero-Knowledge (ZK)</strong> cryptography and explicit key separation:</p>
      <ul>
        <li><strong>Client-Side Encryption:</strong> Agents fetch the owner RSA public key via <code>GET /api/v1/users/me/public-key</code>, encrypt payloads locally with AES-256-GCM, and upload ciphertext + RSA-OAEP wrapped DEK (<code>credential_scheme=rsa</code>).</li>
        <li><strong>No Delete on Standard Keys:</strong> Standard automation keys (<code>abrnak_...</code>) can never delete files or folders (<code>403 delete_key_required</code>).</li>
        <li><strong>Special Delete-Only Key & Recoverable Trash:</strong> Only a dedicated Special Delete-Only key (<code>abrnak_del_...</code>, exclusive scope <code>files:soft_delete</code>) can delete via API, and every delete moves items to app-controlled Trash (100% recoverable by the owner).</li>
        <li><strong>Guardrails & Governance:</strong> Per-key <code>allowed_folder_ids</code>, <code>allowed_ips</code>, <code>rate_limit_rpm</code>, and <code>Idempotency-Key</code> replay protection. Governance settings remain human-JWT-only.</li>
      </ul>
    </div>

    <div class="controls">
      <input id="op-search" class="search-input" type="search" placeholder="Filter endpoints by path, method, or description..." aria-label="Filter OpenAPI endpoints" />
      <button class="filter-btn active" data-method="ALL" type="button">ALL</button>
      <button class="filter-btn" data-method="GET" type="button">GET</button>
      <button class="filter-btn" data-method="POST" type="button">POST</button>
      <button class="filter-btn" data-method="PUT" type="button">PUT</button>
      <button class="filter-btn" data-method="DELETE" type="button">DELETE</button>
    </div>

    <div id="openapi-status" class="status-note">Loading OpenAPI 3.0.3 schema from ` + specURL + `...</div>
    <div id="endpoint-list" class="endpoint-list"></div>
    <div id="schema-section"></div>
  </div>

  <script>
    (() => {
      const specUrl = '` + specURL + `';
      const statusEl = document.getElementById('openapi-status');
      const listEl = document.getElementById('endpoint-list');
      const schemaSectionEl = document.getElementById('schema-section');
      const searchEl = document.getElementById('op-search');
      const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
      let allOps = [];
      let activeMethod = 'ALL';

      function renderOps() {
        const q = (searchEl.value || '').trim().toLowerCase();
        const filtered = allOps.filter((item) => {
          if (activeMethod !== 'ALL' && item.method !== activeMethod) return false;
          if (!q) return true;
          return (
            item.path.toLowerCase().includes(q) ||
            item.summary.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q)
          );
        });

        listEl.innerHTML = '';
        statusEl.textContent = filtered.length + ' of ' + allOps.length + ' documented operations shown (OpenAPI 3.0.3 · CSP self-contained)';

        for (const item of filtered) {
          const card = document.createElement('div');
          card.className = 'op-card';

          const header = document.createElement('button');
          header.type = 'button';
          header.className = 'op-header';

          const badge = document.createElement('span');
          badge.className = 'method-badge m-' + item.method;
          badge.textContent = item.method;

          const pathSpan = document.createElement('span');
          pathSpan.className = 'op-path';
          pathSpan.textContent = item.path;

          const sumSpan = document.createElement('span');
          sumSpan.className = 'op-summary';
          sumSpan.textContent = item.summary;

          header.appendChild(badge);
          header.appendChild(pathSpan);
          header.appendChild(sumSpan);

          const body = document.createElement('div');
          body.className = 'op-body';

          if (item.description) {
            const p = document.createElement('p');
            p.textContent = item.description;
            body.appendChild(p);
          }

          const pre = document.createElement('pre');
          pre.className = 'op-pre';
          pre.textContent = JSON.stringify(item.spec, null, 2);
          body.appendChild(pre);

          header.addEventListener('click', () => card.classList.toggle('open'));
          card.appendChild(header);
          card.appendChild(body);
          listEl.appendChild(card);
        }
      }

      fetch(specUrl)
        .then((res) => {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then((spec) => {
          const paths = spec.paths || {};
          allOps = [];
          for (const [path, methodsObj] of Object.entries(paths)) {
            for (const [method, op] of Object.entries(methodsObj || {})) {
              allOps.push({
                method: method.toUpperCase(),
                path,
                summary: (op && op.summary) || '',
                description: (op && op.description) || '',
                spec: op,
              });
            }
          }
          renderOps();

          const schemas = (spec.components && spec.components.schemas) || {};
          const keys = Object.keys(schemas);
          if (keys.length > 0) {
            const h = document.createElement('h2');
            h.textContent = 'Component Schemas (' + keys.length + ')';
            h.style.color = '#38bdf8';
            h.style.marginTop = '2rem';
            schemaSectionEl.appendChild(h);

            const grid = document.createElement('div');
            grid.className = 'schema-grid';
            for (const name of keys) {
              const card = document.createElement('div');
              card.className = 'boundary-card';
              const title = document.createElement('h2');
              title.textContent = name;
              const pre = document.createElement('pre');
              pre.className = 'op-pre';
              pre.textContent = JSON.stringify(schemas[name], null, 2);
              card.appendChild(title);
              card.appendChild(pre);
              grid.appendChild(card);
            }
            schemaSectionEl.appendChild(grid);
          }
        })
        .catch((err) => {
          statusEl.textContent = 'Failed to load OpenAPI spec from ' + specUrl + ': ' + err.message;
        });

      searchEl.addEventListener('input', renderOps);
      for (const btn of filterBtns) {
        btn.addEventListener('click', () => {
          activeMethod = btn.dataset.method || 'ALL';
          filterBtns.forEach((b) => b.classList.toggle('active', b === btn));
          renderOps();
        });
      }
    })();
  </script>
</body>
</html>`
	_, _ = w.Write([]byte(html))
}
