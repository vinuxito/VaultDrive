package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
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
	FileID            string            `json:"file_id"`
	Protection        string            `json:"protection"`
	OwnerLabel        string            `json:"owner_label"`
	VisibilitySummary string            `json:"visibility_summary"`
	AccessState       string            `json:"access_state"`
	Origin            string            `json:"origin"`
	LatestActivity    string            `json:"latest_activity"`
	Entries           []accessEntry     `json:"entries"`
	Timeline          []fileTimelineEvent `json:"timeline,omitempty"`
}

func (cfg *ApiConfig) getOwnedFileForAccess(r *http.Request, user database.User) (uuid.UUID, database.File, bool) {
	fileIDStr := r.PathValue("id")
	if fileIDStr == "" {
		return uuid.Nil, database.File{}, false
	}
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return uuid.Nil, database.File{}, false
	}
	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		return uuid.Nil, database.File{}, false
	}
	if !dbFile.OwnerID.Valid || dbFile.OwnerID.UUID != user.ID {
		return uuid.Nil, database.File{}, false
	}
	return fileID, dbFile, true
}

func (cfg *ApiConfig) buildFileAccessEntries(r *http.Request, fileID uuid.UUID, file database.File, user database.User) []accessEntry {
	entries := []accessEntry{ {
		Kind:  "owner",
		Label: "Owner only",
		Since: file.CreatedAt.UTC().Format(time.RFC3339),
		State: "active",
	} }

	rows, err := cfg.db.QueryContext(r.Context(), `
		SELECT COALESCE(u.first_name || ' ' || u.last_name, u.username), fak.created_at
		FROM file_access_keys fak
		JOIN users u ON fak.user_id = u.id
		WHERE fak.file_id = $1
		  AND fak.user_id IS NOT NULL
		  AND fak.user_id != $2
		ORDER BY fak.created_at ASC`, fileID, user.ID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			var createdAt time.Time
			if rows.Scan(&name, &createdAt) == nil {
				entries = append(entries, accessEntry{
					Kind:  "direct",
					Label: "Direct user: " + name,
					Since: createdAt.UTC().Format(time.RFC3339),
					State: "active",
				})
			}
		}
	}

	rows2, err := cfg.db.QueryContext(r.Context(), `
		SELECT g.name, gfs.created_at, COUNT(gm.user_id)
		FROM group_file_shares gfs
		JOIN groups g ON g.id = gfs.group_id
		LEFT JOIN group_members gm ON gm.group_id = g.id
		WHERE gfs.file_id = $1
		GROUP BY g.id, g.name, gfs.created_at
		ORDER BY gfs.created_at ASC`, fileID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var groupName string
			var createdAt time.Time
			var memberCount int
			if rows2.Scan(&groupName, &createdAt, &memberCount) == nil {
				entries = append(entries, accessEntry{
					Kind:  "group",
					Label: fmt.Sprintf("Group: %s (%d members)", groupName, memberCount),
					Since: createdAt.UTC().Format(time.RFC3339),
					State: "active",
				})
			}
		}
	}

	rows3, err := cfg.db.QueryContext(r.Context(), `
		SELECT token, created_at, expires_at, access_count, last_accessed_at, is_active
		FROM public_share_links
		WHERE file_id = $1
		ORDER BY created_at ASC`, fileID)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var token string
			var createdAt time.Time
			var expiresAt sql.NullTime
			var accessCount int
			var lastAccessedAt sql.NullTime
			var isActive bool
			if rows3.Scan(&token, &createdAt, &expiresAt, &accessCount, &lastAccessedAt, &isActive) == nil {
				label := "Public link (share/" + token[:8] + "...)"
				state := "active"
				if !isActive {
					state = "revoked"
				}
				if expiresAt.Valid && expiresAt.Time.Before(time.Now()) {
					state = "expired"
				}
				entry := accessEntry{
					Kind:        "share_link",
					Label:       label,
					Since:       createdAt.UTC().Format(time.RFC3339),
					State:       state,
					AccessCount: &accessCount,
				}
				if expiresAt.Valid {
					s := expiresAt.Time.UTC().Format(time.RFC3339)
					entry.ExpiresAt = &s
				}
				if lastAccessedAt.Valid && state == "active" {
					entry.Label = label + " · last opened " + lastAccessedAt.Time.UTC().Format(time.RFC3339)
				}
				entries = append(entries, entry)
			}
		}
	}

	if file.DropSourceID.Valid {
		entries = append(entries, accessEntry{
			Kind:  "secure_drop",
			Label: "Secure Drop intake",
			Since: file.CreatedAt.UTC().Format(time.RFC3339),
			State: "active",
		})
	}

	return entries
}

func summarizeVisibility(entries []accessEntry) (string, string) {
	if len(entries) <= 1 {
		return "Only you", "private"
	}
	hasPublic := false
	hasDirect := false
	hasGroup := false
	for _, entry := range entries {
		switch entry.Kind {
		case "share_link":
			if entry.State == "active" {
				hasPublic = true
			}
		case "direct":
			if entry.State == "active" {
				hasDirect = true
			}
		case "group":
			if entry.State == "active" {
				hasGroup = true
			}
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
	return "Protected intake only", "controlled"
}

func (cfg *ApiConfig) buildFileTimeline(r *http.Request, fileID uuid.UUID, file database.File) []fileTimelineEvent {
	timeline := []fileTimelineEvent{{
		ID:        file.ID.String() + ":uploaded",
		EventType: "uploaded",
		Label:     "Ciphertext stored in your vault",
		At:        file.CreatedAt.UTC().Format(time.RFC3339),
		Tone:      "good",
	}}
	if file.DropSourceID.Valid {
		timeline = append(timeline, fileTimelineEvent{
			ID:        file.ID.String() + ":drop",
			EventType: "secure_drop_received",
			Label:     "Received through Secure Drop intake",
			At:        file.CreatedAt.UTC().Format(time.RFC3339),
			Tone:      "info",
		})
	}

	rows, err := cfg.db.QueryContext(r.Context(), `
		SELECT COALESCE(u.first_name || ' ' || u.last_name, u.username), fak.created_at
		FROM file_access_keys fak
		JOIN users u ON fak.user_id = u.id
		WHERE fak.file_id = $1 AND fak.user_id IS NOT NULL AND fak.user_id != $2
		ORDER BY fak.created_at ASC`, fileID, file.OwnerID.UUID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			var createdAt time.Time
			if rows.Scan(&name, &createdAt) == nil {
				timeline = append(timeline, fileTimelineEvent{
					ID:        file.ID.String() + ":share:" + createdAt.UTC().Format(time.RFC3339Nano),
					EventType: "shared",
					Label:     "Shared directly with " + name,
					At:        createdAt.UTC().Format(time.RFC3339),
					Tone:      "info",
				})
			}
		}
	}

	rows2, err := cfg.db.QueryContext(r.Context(), `
		SELECT g.name, gfs.created_at
		FROM group_file_shares gfs
		JOIN groups g ON g.id = gfs.group_id
		WHERE gfs.file_id = $1
		ORDER BY gfs.created_at ASC`, fileID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var name string
			var createdAt time.Time
			if rows2.Scan(&name, &createdAt) == nil {
				timeline = append(timeline, fileTimelineEvent{
					ID:        file.ID.String() + ":group:" + createdAt.UTC().Format(time.RFC3339Nano),
					EventType: "group_shared",
					Label:     "Shared with group " + name,
					At:        createdAt.UTC().Format(time.RFC3339),
					Tone:      "info",
				})
			}
		}
	}

	rows3, err := cfg.db.QueryContext(r.Context(), `
		SELECT id, created_at, expires_at, is_active, access_count, last_accessed_at
		FROM public_share_links
		WHERE file_id = $1
		ORDER BY created_at ASC`, fileID)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var linkID uuid.UUID
			var createdAt time.Time
			var expiresAt sql.NullTime
			var isActive bool
			var accessCount int
			var lastAccessedAt sql.NullTime
			if rows3.Scan(&linkID, &createdAt, &expiresAt, &isActive, &accessCount, &lastAccessedAt) == nil {
				timeline = append(timeline, fileTimelineEvent{
					ID:        linkID.String() + ":created",
					EventType: "link_created",
					Label:     "Public link created",
					At:        createdAt.UTC().Format(time.RFC3339),
					Tone:      "info",
				})
				if lastAccessedAt.Valid {
					timeline = append(timeline, fileTimelineEvent{
						ID:        linkID.String() + ":accessed",
						EventType: "accessed",
						Label:     fmt.Sprintf("Public link opened %d time(s)", accessCount),
						At:        lastAccessedAt.Time.UTC().Format(time.RFC3339),
						Tone:      "info",
					})
				}
				if !isActive {
					timeline = append(timeline, fileTimelineEvent{
						ID:        linkID.String() + ":revoked",
						EventType: "revoked",
						Label:     "Public link revoked",
						At:        createdAt.UTC().Format(time.RFC3339),
						Tone:      "warn",
					})
				} else if expiresAt.Valid && expiresAt.Time.Before(time.Now()) {
					timeline = append(timeline, fileTimelineEvent{
						ID:        linkID.String() + ":expired",
						EventType: "expired",
						Label:     "Public link expired",
						At:        expiresAt.Time.UTC().Format(time.RFC3339),
						Tone:      "warn",
					})
				}
			}
		}
	}

	slices.SortStableFunc(timeline, func(a, b fileTimelineEvent) int {
		if a.At == b.At {
			return strings.Compare(a.ID, b.ID)
		}
		if a.At < b.At {
			return 1
		}
		return -1
	})
	return timeline
}

func (cfg *ApiConfig) handlerGetFileAccessSummary(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, ok := cfg.getOwnedFileForAccess(r, user)
	if !ok {
		respondWithError(w, http.StatusForbidden, "You do not own this file", nil)
		return
	}
	entries := cfg.buildFileAccessEntries(r, fileID, dbFile, user)

	if len(entries) == 0 {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"summary": "Only you",
			"entries": entries,
		})
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"summary": func() string {
			summary, _ := summarizeVisibility(entries)
			return summary
		}(),
		"entries": entries,
	})
}

func (cfg *ApiConfig) handlerGetFileTrustSummary(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, ok := cfg.getOwnedFileForAccess(r, user)
	if !ok {
		respondWithV1Error(w, r, http.StatusForbidden, "You do not own this file")
		return
	}
	entries := cfg.buildFileAccessEntries(r, fileID, dbFile, user)
	visibilitySummary, accessState := summarizeVisibility(entries)
	origin := "vault_upload"
	if dbFile.DropSourceID.Valid {
		origin = "secure_drop"
	}
	timeline := cfg.buildFileTimeline(r, fileID, dbFile)
	latest := "Stored securely"
	if len(timeline) > 0 {
		latest = timeline[0].Label
	}
	ownerLabel := strings.TrimSpace(user.FirstName + " " + user.LastName)
	if ownerLabel == "" {
		ownerLabel = user.Username
	}
	respondWithV1(w, r, http.StatusOK, fileTrustSummary{
		FileID:            fileID.String(),
		Protection:        "Browser-encrypted ciphertext stored server-side",
		OwnerLabel:        ownerLabel,
		VisibilitySummary: visibilitySummary,
		AccessState:       accessState,
		Origin:            origin,
		LatestActivity:    latest,
		Entries:           entries,
	}, nil)
}

func (cfg *ApiConfig) handlerGetFileSecurityTimeline(w http.ResponseWriter, r *http.Request, user database.User) {
	fileID, dbFile, ok := cfg.getOwnedFileForAccess(r, user)
	if !ok {
		respondWithV1Error(w, r, http.StatusForbidden, "You do not own this file")
		return
	}
	respondWithV1(w, r, http.StatusOK, cfg.buildFileTimeline(r, fileID, dbFile), nil)
}

func (cfg *ApiConfig) handlerRevokeAllExternalAccess(w http.ResponseWriter, r *http.Request, user database.User) {
	fileIDStr := r.PathValue("id")
	if fileIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "File ID required", nil)
		return
	}
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid file ID", err)
		return
	}

	dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "File not found", err)
		return
	}
	if !dbFile.OwnerID.Valid || dbFile.OwnerID.UUID != user.ID {
		respondWithError(w, http.StatusForbidden, "You do not own this file", nil)
		return
	}

	if _, err := cfg.db.ExecContext(r.Context(),
		"DELETE FROM file_access_keys WHERE file_id = $1 AND user_id != $2", fileID, user.ID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to revoke direct access", err)
		return
	}
	if _, err := cfg.db.ExecContext(r.Context(),
		"UPDATE public_share_links SET is_active = FALSE WHERE file_id = $1 AND owner_id = $2",
		fileID, user.ID); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to revoke public links", err)
		return
	}

	cfg.insertActivity(r.Context(), user.ID, "external_access_revoked", map[string]interface{}{
		"file_id":  fileID.String(),
		"filename": dbFile.Filename,
	})
	cfg.insertAudit(r.Context(), user.ID, "file.external_access_revoked", "file", &fileID, map[string]interface{}{
		"filename": dbFile.Filename,
	}, r)

	respondWithJSON(w, http.StatusOK, map[string]bool{"success": true})
}
