package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

const maxFileTimelineEvents = 200

var (
	errAccessInvalidFileID = errors.New("invalid file id")
	errAccessFileNotFound  = errors.New("file not found")
	errAccessForbidden     = errors.New("file is not owned by caller")
)

type accessEntry struct {
	Kind        string  `json:"kind"`
	Label       string  `json:"label"`
	Since       string  `json:"since"`
	State       string  `json:"state"`
	ExpiresAt   *string `json:"expires_at,omitempty"`
	AccessCount *int    `json:"access_count,omitempty"`
}

type fileTimelineEvent struct {
	ID        string `json:"id"`
	EventType string `json:"event_type"`
	Label     string `json:"label"`
	At        string `json:"at"`
	Tone      string `json:"tone"`
}

type fileTrustSummary struct {
	FileID            string              `json:"file_id"`
	Protection        string              `json:"protection"`
	OwnerLabel        string              `json:"owner_label"`
	VisibilitySummary string              `json:"visibility_summary"`
	AccessState       string              `json:"access_state"`
	Origin            string              `json:"origin"`
	LatestActivity    string              `json:"latest_activity"`
	Entries           []accessEntry       `json:"entries"`
	Timeline          []fileTimelineEvent `json:"timeline,omitempty"`
}

func (cfg *ApiConfig) getOwnedFileForAccessResult(ctx context.Context, fileIDValue string, user database.User) (uuid.UUID, database.File, error) {
	fileID, err := uuid.Parse(fileIDValue)
	if err != nil {
		return uuid.Nil, database.File{}, errAccessInvalidFileID
	}
	dbFile, err := cfg.dbQueries.GetFileByID(ctx, fileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return uuid.Nil, database.File{}, errAccessFileNotFound
		}
		return uuid.Nil, database.File{}, fmt.Errorf("load owned file: %w", err)
	}
	if !dbFile.OwnerID.Valid || dbFile.OwnerID.UUID != user.ID {
		return uuid.Nil, database.File{}, errAccessForbidden
	}
	return fileID, dbFile, nil
}

func respondAccessLookupError(w http.ResponseWriter, r *http.Request, err error, v1 bool) {
	status := http.StatusServiceUnavailable
	message := "File access information is temporarily unavailable"
	switch {
	case errors.Is(err, errAccessInvalidFileID):
		status, message = http.StatusBadRequest, "Invalid file ID"
	case errors.Is(err, errAccessFileNotFound):
		status, message = http.StatusNotFound, "File not found"
	case errors.Is(err, errAccessForbidden):
		status, message = http.StatusForbidden, "You do not own this file"
	}
	if v1 {
		respondWithV1Error(w, r, status, message)
		return
	}
	respondWithError(w, status, message, err)
}

func displayName(firstName, lastName, username string) string {
	name := strings.TrimSpace(strings.TrimSpace(firstName) + " " + strings.TrimSpace(lastName))
	if name == "" {
		return username
	}
	return name
}

func linkLabel(prefix, token string) string {
	visible := token
	if len(visible) > 8 {
		visible = visible[:8] + "..."
	}
	return fmt.Sprintf("%s (%s)", prefix, visible)
}

func accessLinkState(active bool, expiresAt sql.NullTime, now time.Time) string {
	if !active {
		return "revoked"
	}
	if expiresAt.Valid && !expiresAt.Time.After(now) {
		return "expired"
	}
	return "active"
}

func appendPersonAccessRows(ctx context.Context, db database.DBTX, entries []accessEntry, query string, args ...interface{}) ([]accessEntry, error) {
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var kind, firstName, lastName, username string
		var createdAt time.Time
		if err := rows.Scan(&kind, &firstName, &lastName, &username, &createdAt); err != nil {
			return nil, err
		}
		prefix := "Direct user: "
		if kind == "folder_share" {
			prefix = "Folder collaborator: "
		}
		entries = append(entries, accessEntry{Kind: kind, Label: prefix + displayName(firstName, lastName, username), Since: createdAt.UTC().Format(time.RFC3339), State: "active"})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return entries, nil
}

func appendLinkAccessRows(ctx context.Context, db database.DBTX, entries []accessEntry, query string, kind, prefix string, now time.Time, args ...interface{}) ([]accessEntry, error) {
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var token string
		var createdAt time.Time
		var expiresAt, lastAccessedAt sql.NullTime
		var accessCount int
		var active bool
		if err := rows.Scan(&token, &createdAt, &expiresAt, &accessCount, &lastAccessedAt, &active); err != nil {
			return nil, err
		}
		state := accessLinkState(active, expiresAt, now)
		label := linkLabel(prefix, token)
		if lastAccessedAt.Valid && state == "active" {
			label += " · last opened " + lastAccessedAt.Time.UTC().Format(time.RFC3339)
		}
		entry := accessEntry{Kind: kind, Label: label, Since: createdAt.UTC().Format(time.RFC3339), State: state, AccessCount: &accessCount}
		if expiresAt.Valid {
			formatted := expiresAt.Time.UTC().Format(time.RFC3339)
			entry.ExpiresAt = &formatted
		}
		entries = append(entries, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return entries, nil
}

func buildFileAccessEntries(ctx context.Context, db database.DBTX, fileID uuid.UUID, file database.File, user database.User) ([]accessEntry, error) {
	entries := []accessEntry{{Kind: "owner", Label: "Owner only", Since: file.CreatedAt.UTC().Format(time.RFC3339), State: "active"}}
	var err error
	entries, err = appendPersonAccessRows(ctx, db, entries, `
		SELECT 'direct',COALESCE(u.first_name,''),COALESCE(u.last_name,''),u.username,fak.created_at
		FROM file_access_keys fak JOIN users u ON u.id=fak.user_id
		WHERE fak.file_id=$1 AND fak.user_id<>$2 ORDER BY fak.created_at,fak.id`, fileID, user.ID)
	if err != nil {
		return nil, fmt.Errorf("direct access source: %w", err)
	}

	rows, err := db.QueryContext(ctx, `
		SELECT g.name,gfs.created_at,COUNT(gm.user_id)
		FROM group_file_shares gfs JOIN groups g ON g.id=gfs.group_id
		LEFT JOIN group_members gm ON gm.group_id=g.id
		WHERE gfs.file_id=$1 GROUP BY g.id,g.name,gfs.created_at,gfs.id
		ORDER BY gfs.created_at,gfs.id`, fileID)
	if err != nil {
		return nil, fmt.Errorf("group access source: %w", err)
	}
	for rows.Next() {
		var name string
		var createdAt time.Time
		var memberCount int
		if err := rows.Scan(&name, &createdAt, &memberCount); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan group access: %w", err)
		}
		entries = append(entries, accessEntry{Kind: "group", Label: fmt.Sprintf("Group: %s (%d members)", name, memberCount), Since: createdAt.UTC().Format(time.RFC3339), State: "active"})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, fmt.Errorf("read group access: %w", err)
	}
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("close group access: %w", err)
	}

	entries, err = appendPersonAccessRows(ctx, db, entries, `
		SELECT 'folder_share',COALESCE(u.first_name,''),COALESCE(u.last_name,''),u.username,fs.created_at
		FROM files f JOIN folder_shares fs ON fs.folder_id=f.folder_id JOIN users u ON u.id=fs.user_id
		WHERE f.id=$1 ORDER BY fs.created_at,fs.id`, fileID)
	if err != nil {
		return nil, fmt.Errorf("folder collaborator source: %w", err)
	}

	now := time.Now().UTC()
	entries, err = appendLinkAccessRows(ctx, db, entries, `
		SELECT token,created_at,expires_at,access_count,last_accessed_at,is_active
		FROM public_share_links WHERE file_id=$1 ORDER BY created_at,id`, "share_link", "Public link", now, fileID)
	if err != nil {
		return nil, fmt.Errorf("file link source: %w", err)
	}

	entries, err = appendLinkAccessRows(ctx, db, entries, `
		WITH RECURSIVE ancestors AS (
			SELECT f.folder_id AS id FROM files f WHERE f.id=$1 AND f.folder_id IS NOT NULL
			UNION ALL
			SELECT folder.parent_id FROM folders folder JOIN ancestors a ON folder.id=a.id WHERE folder.parent_id IS NOT NULL
		)
		SELECT fsl.token,fsl.created_at,fsl.expires_at,fsl.access_count,fsl.last_accessed_at,fsl.is_active
		FROM ancestors a JOIN folder_share_links fsl ON fsl.folder_id=a.id
		JOIN folder_share_file_keys fsfk ON fsfk.folder_share_link_id=fsl.id AND fsfk.file_id=$1
		ORDER BY fsl.created_at,fsl.id`, "folder_link", "Folder link", now, fileID)
	if err != nil {
		return nil, fmt.Errorf("folder link source: %w", err)
	}

	if file.DropSourceID.Valid {
		entries = append(entries, accessEntry{Kind: "secure_drop", Label: "Secure Drop intake", Since: file.CreatedAt.UTC().Format(time.RFC3339), State: "active"})
	}
	return entries, nil
}

func summarizeVisibility(entries []accessEntry) (string, string) {
	hasPublic, hasDirect, hasGroup := false, false, false
	for _, entry := range entries {
		if entry.State != "active" {
			continue
		}
		switch entry.Kind {
		case "share_link", "folder_link":
			hasPublic = true
		case "direct", "folder_share":
			hasDirect = true
		case "group":
			hasGroup = true
		}
	}
	if hasPublic {
		return "Public link is active", "public"
	}
	if hasDirect && hasGroup {
		return "Shared directly and through groups", "shared"
	}
	if hasGroup {
		return "Shared with a group", "shared"
	}
	if hasDirect {
		return "Shared with specific people", "shared"
	}
	return "Only you", "private"
}

type timelineAuditRow struct {
	ID            uuid.UUID
	Action        string
	CreatedAt     time.Time
	Metadata      []byte
	RecipientName string
}

func timelineEventFromAudit(row timelineAuditRow) (fileTimelineEvent, bool) {
	event := fileTimelineEvent{ID: row.ID.String(), At: row.CreatedAt.UTC().Format(time.RFC3339), Tone: "info"}
	switch row.Action {
	case "file.shared":
		event.EventType, event.Label = "shared", "Shared directly with a recipient"
		if row.RecipientName != "" {
			event.Label = "Shared directly with " + row.RecipientName
		}
	case "public_share_link.created":
		event.EventType, event.Label = "link_created", "Public link created"
	case "public_share_link.revoked":
		event.EventType, event.Label, event.Tone = "revoked", "Public link revoked", "warn"
	case "file.external_access_revoked":
		var metadata struct {
			DirectCount int `json:"direct_count"`
			LinkCount   int `json:"link_count"`
		}
		_ = json.Unmarshal(row.Metadata, &metadata)
		event.EventType = "external_access_revoked"
		event.Label = fmt.Sprintf("Closed %d direct share(s) and %d file link(s)", metadata.DirectCount, metadata.LinkCount)
		event.Tone = "warn"
	case "file.downloaded":
		event.EventType, event.Label = "accessed", "Public link authorized a ciphertext fetch"
	case "group.file_shared":
		event.EventType, event.Label = "group_shared", "Shared with a group"
	case "group.file_removed":
		event.EventType, event.Label, event.Tone = "group_removed", "Removed from a group", "warn"
	default:
		return fileTimelineEvent{}, false
	}
	return event, true
}

func buildFileTimeline(ctx context.Context, db database.DBTX, fileID uuid.UUID, file database.File) ([]fileTimelineEvent, error) {
	timeline := []fileTimelineEvent{{ID: file.ID.String() + ":uploaded", EventType: "uploaded", Label: "Ciphertext stored in your vault", At: file.CreatedAt.UTC().Format(time.RFC3339), Tone: "good"}}
	if file.DropSourceID.Valid {
		timeline = append(timeline, fileTimelineEvent{ID: file.ID.String() + ":drop", EventType: "secure_drop_received", Label: "Received through Secure Drop intake", At: file.CreatedAt.UTC().Format(time.RFC3339), Tone: "info"})
	}

	rows, err := db.QueryContext(ctx, `
		SELECT a.id,a.action,a.created_at,a.metadata,
		       COALESCE(NULLIF(BTRIM(CONCAT_WS(' ',NULLIF(u.first_name,''),NULLIF(u.last_name,''))),''),u.username,'')
		FROM audit_logs a LEFT JOIN users u ON u.id::text=a.metadata->>'recipient_id'
		WHERE a.user_id=$2 AND (
			(a.resource_type='file' AND a.resource_id=$1 AND (
				a.action IN ('file.shared','file.external_access_revoked','group.file_shared','group.file_removed')
				OR (a.action='file.downloaded' AND a.metadata->>'actor_type'='anonymous_link')
			))
			OR (a.resource_type='public_share_link' AND a.action IN ('public_share_link.created','public_share_link.revoked')
				AND EXISTS (SELECT 1 FROM public_share_links psl WHERE psl.id=a.resource_id AND psl.file_id=$1))
		)
		ORDER BY a.created_at DESC,a.id DESC LIMIT $3`, fileID, file.OwnerID.UUID, maxFileTimelineEvents)
	if err != nil {
		return nil, fmt.Errorf("audit history source: %w", err)
	}
	for rows.Next() {
		var row timelineAuditRow
		if err := rows.Scan(&row.ID, &row.Action, &row.CreatedAt, &row.Metadata, &row.RecipientName); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan audit history: %w", err)
		}
		if event, ok := timelineEventFromAudit(row); ok {
			timeline = append(timeline, event)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, fmt.Errorf("read audit history: %w", err)
	}
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("close audit history: %w", err)
	}

	expiredRows, err := db.QueryContext(ctx, `
		SELECT id,expires_at FROM public_share_links
		WHERE file_id=$1 AND is_active=TRUE AND expires_at IS NOT NULL AND expires_at<=NOW()
		ORDER BY expires_at DESC,id DESC LIMIT $2`, fileID, maxFileTimelineEvents)
	if err != nil {
		return nil, fmt.Errorf("link expiry source: %w", err)
	}
	for expiredRows.Next() {
		var linkID uuid.UUID
		var expiresAt time.Time
		if err := expiredRows.Scan(&linkID, &expiresAt); err != nil {
			expiredRows.Close()
			return nil, fmt.Errorf("scan link expiry: %w", err)
		}
		timeline = append(timeline, fileTimelineEvent{ID: linkID.String() + ":expired", EventType: "expired", Label: "Public link expired", At: expiresAt.UTC().Format(time.RFC3339), Tone: "warn"})
	}
	if err := expiredRows.Err(); err != nil {
		expiredRows.Close()
		return nil, fmt.Errorf("read link expiry: %w", err)
	}
	if err := expiredRows.Close(); err != nil {
		return nil, fmt.Errorf("close link expiry: %w", err)
	}

	slices.SortStableFunc(timeline, func(a, b fileTimelineEvent) int {
		if a.At == b.At {
			return strings.Compare(b.ID, a.ID)
		}
		if a.At > b.At {
			return -1
		}
		return 1
	})
	if len(timeline) > maxFileTimelineEvents {
		timeline = timeline[:maxFileTimelineEvents]
	}
	return timeline, nil
}

func (cfg *ApiConfig) handlerGetFileAccessSummary(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, err := cfg.getOwnedFileForAccessResult(r.Context(), r.PathValue("id"), user)
	if err != nil {
		respondAccessLookupError(w, r, err, false)
		return
	}
	entries, err := buildFileAccessEntries(r.Context(), cfg.db, fileID, dbFile, user)
	if err != nil {
		respondWithError(w, http.StatusServiceUnavailable, "File access information is temporarily unavailable", err)
		return
	}
	summary, _ := summarizeVisibility(entries)
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"summary": summary, "entries": entries})
}

func (cfg *ApiConfig) handlerGetFileTrustSummary(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, err := cfg.getOwnedFileForAccessResult(r.Context(), r.PathValue("id"), user)
	if err != nil {
		respondAccessLookupError(w, r, err, true)
		return
	}
	entries, err := buildFileAccessEntries(r.Context(), cfg.db, fileID, dbFile, user)
	if err != nil {
		respondWithV1Error(w, r, http.StatusServiceUnavailable, "File access information is temporarily unavailable")
		return
	}
	visibilitySummary, accessState := summarizeVisibility(entries)
	timeline, err := buildFileTimeline(r.Context(), cfg.db, fileID, dbFile)
	if err != nil {
		respondWithV1Error(w, r, http.StatusServiceUnavailable, "File history is temporarily unavailable")
		return
	}
	origin := "vault_upload"
	if dbFile.DropSourceID.Valid {
		origin = "secure_drop"
	}
	latest := "Stored securely"
	if len(timeline) > 0 {
		latest = timeline[0].Label
	}
	ownerLabel := displayName(user.FirstName, user.LastName, user.Username)
	respondWithV1(w, r, http.StatusOK, fileTrustSummary{FileID: fileID.String(), Protection: "Browser-encrypted ciphertext stored server-side", OwnerLabel: ownerLabel, VisibilitySummary: visibilitySummary, AccessState: accessState, Origin: origin, LatestActivity: latest, Entries: entries}, nil)
}

func (cfg *ApiConfig) handlerGetFileSecurityTimeline(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, err := cfg.getOwnedFileForAccessResult(r.Context(), r.PathValue("id"), user)
	if err != nil {
		respondAccessLookupError(w, r, err, true)
		return
	}
	timeline, err := buildFileTimeline(r.Context(), cfg.db, fileID, dbFile)
	if err != nil {
		respondWithV1Error(w, r, http.StatusServiceUnavailable, "File history is temporarily unavailable")
		return
	}
	respondWithV1(w, r, http.StatusOK, timeline, nil)
}

func (cfg *ApiConfig) handlerRevokeAllExternalAccess(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, err := cfg.getOwnedFileForAccessResult(r.Context(), r.PathValue("id"), user)
	if err != nil {
		respondAccessLookupError(w, r, err, false)
		return
	}
	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		respondWithError(w, http.StatusServiceUnavailable, "Could not start access revocation", err)
		return
	}
	defer tx.Rollback()
	directResult, err := tx.ExecContext(r.Context(), `DELETE FROM file_access_keys WHERE file_id=$1 AND user_id<>$2`, fileID, user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to revoke direct access", err)
		return
	}
	directCount, err := directResult.RowsAffected()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to confirm direct access revocation", err)
		return
	}
	linkResult, err := tx.ExecContext(r.Context(), `UPDATE public_share_links SET is_active=FALSE WHERE file_id=$1 AND owner_id=$2 AND is_active=TRUE`, fileID, user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to revoke public links", err)
		return
	}
	linkCount, err := linkResult.RowsAffected()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to confirm public link revocation", err)
		return
	}
	if directCount > 0 || linkCount > 0 {
		metadata := map[string]interface{}{"file_id": fileID.String(), "filename": dbFile.Filename, "direct_count": directCount, "link_count": linkCount, "scope": "direct_and_file_links"}
		queries := cfg.dbQueries.WithTx(tx)
		if err := queries.InsertActivity(r.Context(), database.InsertActivityParams{UserID: user.ID, EventType: "external_access_revoked", Payload: marshalJSONB(metadata)}); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to record access revocation", err)
			return
		}
		if _, err := queries.CreateAuditLog(r.Context(), database.CreateAuditLogParams{UserID: nullUUID(user.ID), Action: "file.external_access_revoked", ResourceType: "file", ResourceID: nullUUID(fileID), Metadata: marshalJSONB(metadata), IpAddress: requestInet(r), CreatedAt: time.Now().UTC()}); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to record access revocation", err)
			return
		}
	}
	if err := tx.Commit(); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to commit access revocation", err)
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{"success": true, "direct_count": directCount, "link_count": linkCount, "scope": "direct_and_file_links"})
}
