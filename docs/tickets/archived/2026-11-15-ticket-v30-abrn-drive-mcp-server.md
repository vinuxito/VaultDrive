# TICKET-2026-11-15-ABRN-DRIVE-MCP-SERVER — Official ABRN Drive Model Context Protocol (MCP) Server (`v30-abrn-drive-mcp-server`)

- **Ticket ID:** `TICKET-2026-11-15-ABRN-DRIVE-MCP-SERVER`
- **Build ID:** `v30-abrn-drive-mcp-server`
- **Status:** `COMPLETED (VERIFIED)`
- **Date Opened:** `2026-11-15`
- **Target Scope:** `/lamp/www/ABRN-Drive/mcp/` (+ SDK integration + MCP verification tests + docs)

---

## 1. Problem Statement & Product Vision

Make **ABRN Drive** a true first-class AI workspace across Claude Desktop, Cursor, Antigravity, Codex, and headless backend agents via an official **Model Context Protocol (MCP)** stdio server backed by our audited zero-knowledge SDK (`sdk/`):

- Zero-knowledge boundary preserved: bots/MCP servers NEVER accept master passwords or PINs; they authenticate with least-privilege `abrnak_` bearer keys (and optionally a separate `ABRN_DELETE_API_KEY` `abrnak_del_...` solely for recoverable trash moves) and only decrypt when explicitly given an authorized bot/delegated RSA-OAEP PKCS8 private key (`ABRN_RSA_PRIVATE_KEY_PEM`).

---

## 2. Requirements (`REQ-01` .. `REQ-04`)

1. **`REQ-01-MCP-STDIO-SERVER`:**
   - Implement clean, dependency-light JSON-RPC 2.0 MCP stdio server (`mcp/server.ts`, `mcp/bin.ts`, `mcp/package.json`) supporting:
     - `initialize` (protocolVersion negotiation, serverInfo `abrn-drive-mcp`, capabilities `{ tools: {} }`)
     - `notifications/initialized`
     - `tools/list` (rich JSON Schema definitions + human & agent descriptions)
     - `tools/call` (structured content + clear `isError` diagnostics without crashing stdio framing)
   - Support both newline-delimited JSON-RPC (MCP standard 2024-11-05+) and optional `Content-Length` framing cleanly.
2. **`REQ-02-ZERO-KNOWLEDGE-TOOL-CATALOG`:**
   - **Discovery & Audit:** `abrn_whoami`, `abrn_list_files`, `abrn_list_shared_files`, `abrn_list_folders`, `abrn_list_shared_folders`, `abrn_list_folder_files`, `abrn_get_file_trust`, `abrn_list_audit`
   - **Zero-Knowledge Crypto Upload / Download:**
     - `abrn_upload_encrypted_file` (fetches owner public key or target folder key, generates fresh AES-256-GCM DEK locally, wraps key with RSA-OAEP, computes plaintext SHA-256, uploads ciphertext)
     - `abrn_download_and_decrypt_file` (downloads ciphertext + `X-Wrapped-Key`, unwraps DEK using configured `ABRN_RSA_PRIVATE_KEY_PEM`, verifies integrity & returns UTF-8 or Base64 + SHA-256 receipt; clearly refuses with remediation guidance if no private key is configured)
   - **Folders, Sharing & Collection Drops:**
     - `abrn_create_folder`, `abrn_move_file`, `abrn_create_share_link`, `abrn_list_shares`, `abrn_create_drop_token`
   - **Separate Recoverable Soft-Delete Tool (Isolated Credential):**
     - `abrn_soft_delete_file`, `abrn_soft_delete_folder` — uses a dedicated `deleteClient` authenticated exclusively by `ABRN_DELETE_API_KEY` (`abrnak_del_...`). Refuses execution if only a standard `ABRN_API_KEY` is configured; sends item only to recoverable Trash with explicit `reason` and reminds the caller that only the vault owner can restore/purge inside the app.
3. **`REQ-03-CREDENTIAL-AND-SECURITY-HYGIENE`:**
   - Explicitly rejects `ABRN_PASSWORD` / `ABRN_PIN` environment variables if supplied by mistake (fail fast with security warning so zero-knowledge boundaries stay uncompromised).
   - Never logs keys, cipher secrets, or decrypted plaintext to stderr.
4. **`REQ-04-LIVE-MCP-INTEGRATION-TEST`:**
   - Automated test spawning the MCP server / running stdio protocol frames end-to-end against a live Go `httptest` ABRN Drive server backed by `abrn_coherence_test`:
     - `initialize` -> `tools/list` -> `abrn_whoami` -> `abrn_create_folder` -> `abrn_upload_encrypted_file` -> `abrn_download_and_decrypt_file` -> `abrn_soft_delete_file` (verifying standard key rejection AND delete-only key recoverable trash!).

---

## 3. Acceptance Criteria

- MCP server completes `initialize`, `tools/list`, and live zero-knowledge `tools/call` cycles without external runtime surprises.
- Deletion via MCP strictly requires `ABRN_DELETE_API_KEY` (`abrnak_del_`) and leaves ciphertext recoverable in app Trash.
- README / `docs/agent-api.md` include copy-paste Claude Desktop / Antigravity / Cursor MCP config snippets.
