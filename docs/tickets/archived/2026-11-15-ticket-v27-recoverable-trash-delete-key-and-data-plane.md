# TICKET-2026-11-15-RECOVERABLE-TRASH-DELETE-KEY-AND-DATA-PLANE — Special Delete-Only Agent Key, 100% App-Controlled Trash & Full Vault Data-Plane Parity (`v27-recoverable-trash-delete-key-and-data-plane`)

- **Ticket ID:** `TICKET-2026-11-15-RECOVERABLE-TRASH-DELETE-KEY-AND-DATA-PLANE`
- **Build ID:** `v27-recoverable-trash-delete-key-and-data-plane`
- **Status:** `COMPLETED (VERIFIED)`
- **Date Opened:** `2026-11-15`
- **Target Scope:** `/lamp/www/ABRN-Drive` (PostgreSQL migration `051`, Go backend, Settings + Papelera React UI)

---

## 1. Explicit Security & Product Mandates

> *“Governance API (`GET/PUT /api/v1/governance/settings`): Keep JWT-only.”*
>
> *“Confirm `files:delete` opt-in scope? NO DELETE. ACTUALLY WE NEED A SPECIAL API KEY FOR AGENTS TO DELETE. JUST FOR THAT. AND WHATEVER DELETES, IT'S RECOVERABLE. THE APP KEEPS CONTROL ALWAYS.”*

This ticket enforces a strict three-wall control boundary:

1. **Governance Remains Human JWT-Only:** `GET/PUT /api/v1/governance/settings` rejects any `abrnak_*` / `abrnak_del_*` key (`403`) and runs solely via `middlewareAuth`.
2. **NO DELETE on Standard Agent Keys:**
   - Standard `abrnak_` keys **NEVER** delete files or folders, regardless of scopes requested or delegated.
   - `DELETE /api/v1/files/{id}`, `DELETE /api/v1/folders/{id}`, and `type: "delete"` inside `POST /api/v1/files/sync` strictly reject standard agent keys (`403 delete_key_required`).
3. **Special Delete-Only Agent Key (`abrnak_del_...`) + 100% Recoverable Trash (App Keeps Control Always):**
   - Only a human JWT session can mint or revoke a **Special Delete-Only Key** (`key_kind = 'delete_only'`, token prefix `abrnak_del_...`, exclusive single scope `["files:soft_delete"]`).
   - `files:soft_delete` CANNOT be combined with any other scope and CANNOT mint child keys (`POST /api/agent/keys` via agent bearer is denied for `delete_only` keys, and standard keys cannot mint `files:soft_delete` child keys).
   - Delete-only keys can call ONLY:
     - `GET /api/v1/agent/auth/introspect` (so the agent can verify its delete-only identity/folder constraints)
     - `DELETE /api/v1/files/{id}` -> marks `deleted_at = NOW()`, `deleted_by_actor_type = 'agent_delete_key'`, `deleted_by_key_id = key.ID`, `deleted_reason = ...` (**keeps ciphertext file on disk AND `file_access_keys` in DB 100% intact**)
     - `DELETE /api/v1/folders/{id}` -> soft-deletes folder and descendant folders/files (`deleted_at = NOW()`, ciphertext untouched)
     - `POST /api/v1/files/sync` **only** when every action in the batch is `type: "delete"` (and triggers soft-delete, never purge)
   - All active reads (`GetFiles*`, `GetFileByID`, `/download`, `/shared`, `/folders`, `/folders/{id}/files`, public share links, drop lists) exclude `deleted_at IS NOT NULL`.
   - **Only the human app owner via JWT** can view Trash (`GET /api/trash`), **Restore** files/folders (`POST /api/trash/files/{id}/restore`, `POST /api/trash/folders/{id}/restore`), or **Permanently Purge** (`DELETE /api/trash/files/{id}`, `DELETE /api/trash/folders/{id}` which calls `os.Remove` and hard `DELETE`).

---

## 2. Vault Data-Plane Parity (`REQ-04` .. `REQ-06`)

1. **Migration `051_agent_keys_and_recoverable_trash.sql`:**
   - On `files` and `folders`: `deleted_at TIMESTAMPTZ`, `deleted_by_actor_type TEXT`, `deleted_by_key_id UUID REFERENCES agent_api_keys(id) ON DELETE SET NULL`, `deleted_reason TEXT`, plus partial indexes for active (`deleted_at IS NULL`) and trash (`deleted_at IS NOT NULL`).
   - On `agent_api_keys`: `key_kind TEXT NOT NULL DEFAULT 'standard'` (`CHECK (key_kind IN ('standard', 'delete_only'))`).
2. **Full `/api/v1/` Vault Data-Plane Routes:**
   - Include `folder_id` in `/api/v1/files` responses & support `?folder_id=<uuid|root>&search=...&limit=...&offset=...`.
   - `GET /api/v1/folders/{id}/files` (owner or shared folder collaborator).
   - `GET /api/v1/folders/shared` (folders shared with caller).
   - `PUT /api/v1/files/{id}/folder` & `POST /api/v1/files/{id}/move` (respects key rotation / `new_wrapped_key` parity).
   - `POST /api/v1/folders/{folderId}/share-link`, `GET /api/v1/folders/{folderId}/share-links`, `DELETE /api/v1/folder-share-links/{linkId}` (or `/api/v1/folders/share-links/{linkId}`).
   - `GET /api/v1/shares` (outgoing + incoming shares), `GET /api/v1/files/{id}/shares`, `DELETE /api/v1/files/{id}/revoke/{user_id}`.
   - `POST /api/v1/files/sync` (agent `rename` needs `files:write` / `folders:write`; agent `delete` requires `delete_only` key and always soft-deletes; human JWT preserves `TestOfflineActionReplayIsIdempotentAndPayloadBound` parity).
   - `POST /api/v1/drop/create`, `GET /api/v1/drop/tokens`, `GET /api/v1/collection-templates`.
3. **Human-First UI (Papelera + Settings Special Delete Key):**
   - `vaultdrive_client/src/pages/files.tsx`: Add accessible **Papelera** filter/tab (degrades cleanly when older backend returns `404`) where humans inspect who sent items to Trash (including which Special Delete Key + reason), click **Restaurar**, or explicitly confirm **Eliminar para siempre** (human-only permanent purge).
   - `vaultdrive_client/src/components/settings/AgentApiKeysSection.tsx`: Separate clear **"Llave normal para automatización (nunca borra)"** vs **"Llave especial solo para enviar a Papelera (100% recuperable)"** creation flow in plain Spanish ("La Viejita" clarity).

---

## 3. Acceptance Criteria

- Standard `abrnak_` key fails with `403` on every delete attempt (`DELETE /v1/files/{id}`, `DELETE /v1/folders/{id}`, `POST /v1/files/sync` `delete`).
- Special `abrnak_del_` key fails with `403` on every read/list/download/upload/share/key-mint endpoint, succeeds on `DELETE /v1/files/{id}` & `/v1/folders/{id}`, keeps encrypted blob intact on disk, hides item from active views, and allows human JWT `Restore` back to active drive with zero byte loss OR human JWT permanent purge removing ciphertext.
- Governance endpoints remain strictly JWT-only.
- Existing `coherence_hardening_test.go` passes with zero regressions.
