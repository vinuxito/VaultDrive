package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type syncAction struct {
	ActionID   string    `json:"action_id"`
	Type       string    `json:"type"`
	FileID     string    `json:"file_id"`
	Filename   string    `json:"filename"`
	ParentHash string    `json:"parent_hash"`
	NewHash    string    `json:"new_hash"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type syncResult struct {
	ActionID   string `json:"action_id,omitempty"`
	FileID     string `json:"file_id"`
	Success    bool   `json:"success"`
	Conflict   bool   `json:"conflict"`
	Error      string `json:"error,omitempty"`
	Code       string `json:"code,omitempty"`
	Filename   string `json:"filename,omitempty"`
	ParentHash string `json:"parent_hash,omitempty"`
}

func (cfg *ApiConfig) handlerFilesSync(w http.ResponseWriter, r *http.Request, user database.User) {
	var payload struct {
		Actions []syncAction `json:"actions"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := decoder.Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", nil)
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		respondWithError(w, http.StatusBadRequest, "One request object is required", nil)
		return
	}
	if len(payload.Actions) == 0 || len(payload.Actions) > 100 {
		respondWithError(w, http.StatusBadRequest, "Provide between 1 and 100 pending actions", nil)
		return
	}
	results := make([]syncResult, 0, len(payload.Actions))
	for _, action := range payload.Actions {
		results = append(results, cfg.applySyncAction(r, user.ID, action))
	}
	respondWithJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (cfg *ApiConfig) applySyncAction(r *http.Request, ownerID uuid.UUID, action syncAction) syncResult {
	result := syncResult{ActionID: action.ActionID, FileID: action.FileID}
	fail := func(code, message string) syncResult { result.Code = code; result.Error = message; return result }
	fileID, err := uuid.Parse(action.FileID)
	if err != nil {
		return fail("invalid_action", "Invalid file ID format")
	}
	if action.ActionID != "" {
		if _, err := uuid.Parse(action.ActionID); err != nil {
			return fail("invalid_action", "Invalid pending action ID")
		}
	}
	if action.Type != "rename" && action.Type != "delete" {
		return fail("invalid_action", "Unknown action type")
	}
	if len(action.ParentHash) > 64 || len(action.NewHash) > 64 {
		return fail("invalid_action", "Version identifier is too long")
	}
	if action.Type == "rename" && (strings.TrimSpace(action.Filename) == "" || len(action.Filename) > 255 || strings.ContainsAny(action.Filename, "\x00\r\n")) {
		return fail("invalid_action", "Provide a filename of at most 255 bytes without control characters")
	}
	if action.Type == "rename" && action.ActionID != "" && (action.NewHash == "" || action.NewHash == action.ParentHash) {
		return fail("invalid_action", "A rename needs a new version identifier")
	}
	// Exclude timestamps: retrying the same intent must not depend on clock drift.
	fingerprintJSON, _ := json.Marshal([]string{action.Type, action.FileID, action.Filename, action.ParentHash, action.NewHash})
	fingerprintBytes := sha256.Sum256(fingerprintJSON)
	fingerprint := hex.EncodeToString(fingerprintBytes[:])
	if action.Type == "rename" && (action.NewHash == "" || action.NewHash == action.ParentHash) {
		// Older callers did not always provide a new hash. Preserve their API
		// while ensuring a rename still advances the version under the row lock.
		action.NewHash = fingerprint
	}
	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		return fail("unavailable", "Could not confirm this change. Check the server state before retrying.")
	}
	defer tx.Rollback()
	if action.ActionID != "" {
		// Lock the owner/action identity before consulting durable evidence. Exact
		// retries (including a lost delete response) return the recorded outcome.
		if _, err = tx.ExecContext(r.Context(), `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, ownerID.String()+":"+action.ActionID); err != nil {
			return fail("unavailable", "Could not check the pending action")
		}
		var previous string
		err = tx.QueryRowContext(r.Context(), `SELECT metadata->>'action_fingerprint' FROM audit_logs WHERE user_id=$1 AND metadata->>'action_id'=$2 AND action IN ('file.renamed','file.deleted') ORDER BY created_at DESC LIMIT 1`, ownerID, action.ActionID).Scan(&previous)
		if err == nil {
			if previous != fingerprint {
				return fail("action_mismatch", "This action ID belongs to a different change")
			}
			result.Success = true
			return result
		}
		if err != sql.ErrNoRows {
			return fail("unavailable", "Could not check the pending action")
		}
	}
	var filename string
	var hash sql.NullString
	err = tx.QueryRowContext(r.Context(), `SELECT filename,parent_hash FROM files WHERE id=$1 AND owner_id=$2 FOR UPDATE`, fileID, ownerID).Scan(&filename, &hash)
	if err == sql.ErrNoRows {
		return fail("not_found", "File not found or access denied; check the current inventory")
	}
	if err != nil {
		return fail("unavailable", "Could not read the current file version")
	}
	if hash.String != action.ParentHash {
		result.Conflict = true
		result.Filename = filename
		result.ParentHash = hash.String
		return fail("version_conflict", "The file changed on the server. Review the current version before retrying.")
	}
	auditAction := "file.deleted"
	if action.Type == "rename" {
		auditAction = "file.renamed"
		_, err = tx.ExecContext(r.Context(), `UPDATE files SET filename=$1,parent_hash=NULLIF($2,''),updated_at=NOW() WHERE id=$3 AND owner_id=$4`, action.Filename, action.NewHash, fileID, ownerID)
	} else {
		_, err = tx.ExecContext(r.Context(), `DELETE FROM files WHERE id=$1 AND owner_id=$2`, fileID, ownerID)
	}
	if err != nil {
		return fail("unavailable", "The change could not be applied; your pending action is retained")
	}
	// Keep the intent fingerprint, not filenames, in idempotency evidence.
	_, err = cfg.dbQueries.WithTx(tx).CreateAuditLog(r.Context(), database.CreateAuditLogParams{UserID: nullUUID(ownerID), Action: auditAction, ResourceType: "file", ResourceID: nullUUID(fileID), Metadata: marshalJSONB(map[string]string{"action_id": action.ActionID, "action_fingerprint": fingerprint, "source": "offline_sync"}), IpAddress: requestInet(r), CreatedAt: time.Now().UTC()})
	if err != nil {
		return fail("unavailable", "Could not record the change; nothing was committed")
	}
	if err = tx.Commit(); err != nil {
		return fail("outcome_unknown", "Confirmation was interrupted. Check this action before retrying.")
	}
	result.Success = true
	return result
}
