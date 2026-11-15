# @abrn-drive/mcp — Official Zero-Knowledge MCP Server

Dependency-free stdio Model Context Protocol (`MCP`) server for **ABRN Drive**, built on top of [`@abrn-drive/sdk`](../sdk/) and native Node 22 WebCrypto.

## Security Model

1. **No passwords or PINs:** Fails fast if `ABRN_PASSWORD` or `ABRN_PIN` is present in the environment.
2. **Client-side zero-knowledge encryption:** `abrn_upload_encrypted_file` encrypts locally (`AES-256-GCM` + `RSA-OAEP` SHA-256) before upload; `abrn_download_and_decrypt_file` decrypts locally using `ABRN_RSA_PRIVATE_KEY_PEM` and verifies plaintext SHA-256.
3. **Isolated Recoverable Deletion:** `abrn_soft_delete_file` and `abrn_soft_delete_folder` strictly require a dedicated `ABRN_DELETE_API_KEY` (`abrnak_del_...`) and never fall back to `ABRN_API_KEY` (`abrnak_...`). Every deleted item moves into **Recoverable Trash**; permanent purge and restore remain human-JWT-only.
4. **Hardware-enforced Guardrails:** Respects server-enforced `allowed_folder_ids`, `allowed_ips`, `rate_limit_rpm`, and `Idempotency-Key`.

## Configuration (Claude Desktop / Cursor / Codex)

```json
{
  "mcpServers": {
    "abrn-drive": {
      "command": "node",
      "args": ["--experimental-strip-types", "/lamp/www/ABRN-Drive/mcp/bin.ts"],
      "env": {
        "ABRN_BASE_URL": "https://abrn.mx/abrn/api",
        "ABRN_API_KEY": "abrnak_your_standard_key",
        "ABRN_DELETE_API_KEY": "abrnak_del_optional_delete_only_key",
        "ABRN_RSA_PRIVATE_KEY_PEM": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
      }
    }
  }
}
```

## Available Tools (17)

- **Discovery & Audit:** `abrn_whoami`, `abrn_list_files`, `abrn_list_shared_files`, `abrn_list_folders`, `abrn_list_shared_folders`, `abrn_list_folder_files`, `abrn_get_file_trust`, `abrn_list_audit`
- **Zero-Knowledge Crypto:** `abrn_upload_encrypted_file`, `abrn_download_and_decrypt_file`
- **Folders, Sharing & Drops:** `abrn_create_folder`, `abrn_move_file`, `abrn_create_share_link`, `abrn_list_shares`, `abrn_create_drop_token`
- **Recoverable Trash Soft-Delete (requires `ABRN_DELETE_API_KEY`):** `abrn_soft_delete_file`, `abrn_soft_delete_folder`

## Verification

```bash
npm --prefix mcp test
```
