# v9 — Step 5: OpenAPI Documentation + Developer Docs
> **Operation Go Live** | Step 5 of 7
> **Index**: [v9-go-live-index.md](./v9-go-live-index.md)
> **Estimated Time**: ~2 hours
> **Priority**: 🟡 Medium — Required for external integrations and ops handoff

---

## Problem Statement

There is no self-hosted API documentation. The previous plan deferred this by saying "REST clients can't use it without the crypto SDK." That is still true for write endpoints. But it is **completely wrong** for:

- `GET /healthz` — no auth, no crypto
- `GET /api/files` — shows the file list metadata structure
- `POST /api/files/upload` — shows expected multipart form fields
- `GET /api/files/:id/download` — explains that the response is ciphertext
- `POST /auth/login`, `POST /auth/signup`
- All admin endpoints

A developer or integration partner needs to know what each endpoint does, what it returns, and what headers it requires — even if they need the client SDK to actually use it. **Docs and usability are not the same thing.**

This step produces:
1. A handcrafted OpenAPI 3.1 YAML spec at `docs/api/openapi.yaml`
2. A self-hosted Swagger UI served at `/docs/api` from the Go server
3. A `docs/SDK.md` explaining the crypto wrapper pattern

---

## What We Build

### 1. `docs/api/openapi.yaml`

Write the spec covering every live endpoint. Key sections:

```yaml
openapi: "3.1.0"
info:
  title: VaultDrive API
  version: "9.0.0"
  description: |
    VaultDrive is a zero-knowledge encrypted file vault.
    All file content stored on the server is AES-GCM ciphertext.
    To read or write files, callers must use the client-side SDK
    which handles key derivation, encryption, and decryption in the browser.

    ## Authentication
    All authenticated endpoints require a Bearer token obtained from POST /auth/login.

    ## Zero-Knowledge Design
    The server never sees plaintext file content. File download endpoints return raw
    ciphertext. Callers must decrypt using the file's AES key, which is stored
    PIN-wrapped in the file's metadata field.

servers:
  - url: https://vaultdrive.abrn.ai
    description: Production

security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

paths:
  /auth/login:
    post:
      summary: Authenticate a user
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                username: { type: string }
                password: { type: string }
      responses:
        "200":
          description: Login successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  token: { type: string }

  /healthz:
    get:
      summary: Server health check
      security: []
      responses:
        "200":
          description: Server is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, example: ok }
                  uptime_seconds: { type: integer }
                  version: { type: string }
                  db_ping_ms: { type: integer }
                  goroutines: { type: integer }
                  memory_mb: { type: number }

  /api/files:
    get:
      summary: List the authenticated user's files
      responses:
        "200":
          description: Array of file metadata records
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/FileRecord"

  /api/files/upload:
    post:
      summary: Upload an encrypted file
      description: |
        File content must be encrypted client-side using AES-GCM (256-bit) before upload.
        The `metadata` field must contain the AES key wrapped with the user's PIN-derived key.
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: The AES-GCM encrypted file blob
                filename:
                  type: string
                metadata:
                  type: string
                  description: JSON containing the PIN-wrapped AES key and IV

  /api/files/{id}/download:
    get:
      summary: Download an encrypted file blob
      description: Returns raw AES-GCM ciphertext. Caller must decrypt using the file key.
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Raw encrypted file content
          content:
            application/octet-stream:
              schema:
                type: string
                format: binary

components:
  schemas:
    FileRecord:
      type: object
      properties:
        id: { type: string }
        filename: { type: string }
        size: { type: integer }
        created_at: { type: string, format: date-time }
        folder_id: { type: string, nullable: true }
        metadata: { type: string, description: "PIN-wrapped AES key JSON" }
        is_owner: { type: boolean }
        is_shared: { type: boolean }
```

---

### 2. Serve Swagger UI at `/docs/api` (Go)

Add a route in `main.go` that serves the Swagger UI HTML statically:

```go
// In main.go, before starting the server:
mux.HandleFunc("/docs/api", func(w http.ResponseWriter, r *http.Request) {
  w.Header().Set("Content-Type", "text/html")
  http.ServeFile(w, r, "./docs/api/index.html")
})
mux.Handle("/docs/api/", http.StripPrefix("/docs/api/", http.FileServer(http.Dir("./docs/api/"))))
```

Create `docs/api/index.html` using the **Swagger UI CDN** (no npm, no build step):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VaultDrive API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/docs/api/openapi.yaml",
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>
```

---

### 3. NEW: `docs/SDK.md`

A human-readable guide explaining:

- The zero-knowledge boundary (what the server knows vs. what the client knows)
- How to encrypt a file using the browser crypto SDK before uploading
- How to decrypt a file after downloading
- How to derive a user's PIN key from a PIN
- How to use the Shamir recovery SDK

This document is the "missing manual" that explains why the API looks the way it does.

---

## Verification Checklist

- [ ] `go build ./...` green with new `/docs/api` routes.
- [ ] Open `http://localhost:8080/docs/api` → Swagger UI loads with VaultDrive API spec.
- [ ] Each documented endpoint is testable from the Swagger UI "Try it out" button.
- [ ] `docs/api/openapi.yaml` covers: `/auth/login`, `/auth/signup`, `/healthz`, `/metrics`, `/api/files`, `/api/files/upload`, `/api/files/:id/download`, `/api/files/:id/delete`, `/api/shares`, `/api/drop`.
- [ ] `docs/SDK.md` exists and is readable without needing to understand Go or TypeScript.

---

## Commit Message

```
feat(v9/step-5): add OpenAPI 3.1 spec, self-hosted Swagger UI at /docs/api, and SDK guide
```

---

*← [v9-step-04-inline-preview.md](./v9-step-04-inline-preview.md) | Next → [v9-step-06-zk-signatures.md](./v9-step-06-zk-signatures.md)*
