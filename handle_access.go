package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

type accessEntry struct {
	Kind      string  `json:"kind"`
	Label     string  `json:"label"`
	Since     string  `json:"since"`
	ExpiresAt *string `json:"expires_at,omitempty"`
	AccessCount *int  `json:"access_count,omitempty"`
}

func (cfg *ApiConfig) handlerGetFileAccessSummary(w http.ResponseWriter, r *http.Request, user database.User) {
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

	entries := []accessEntry{}

	rows, err := cfg.db.QueryContext(r.Context(), `
		SELECT
			COALESCE(u.first_name || ' ' || u.last_name, u.username) as display_name,
			fak.created_at,
			g.name as group_name
		FROM file_access_keys fak
		JOIN users u ON fak.user_id = u.id
		LEFT JOIN groups g ON fak.group_id = g.id
		WHERE fak.file_id = $1
		  AND fak.user_id != $2
		ORDER BY fak.created_at ASC`, fileID, user.ID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var name string
			var ca time.Time
			var grpName *string
			if rows.Scan(&name, &ca, &grpName) == nil {
				kind := "direct"
				label := "Shared with " + name
				if grpName != nil && *grpName != "" {
					kind = "group"
					label = "Group: " + *grpName + " → " + name
				}
				since := ca.UTC().Format(time.RFC3339)
				entries = append(entries, accessEntry{Kind: kind, Label: label, Since: since})
			}
		}
	}

	rows2, err := cfg.db.QueryContext(r.Context(), `
		SELECT token, created_at, expires_at, access_count, last_accessed_at
		FROM public_share_links
		WHERE file_id = $1 AND is_active = TRUE
		ORDER BY created_at ASC`, fileID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var tok string
			var ca time.Time
			var exp *time.Time
			var cnt int
			var lastAccess *time.Time
			if rows2.Scan(&tok, &ca, &exp, &cnt, &lastAccess) == nil {
				label := "Public link (share/" + tok[:8] + "…)"
				if cnt > 0 {
					label += " · accessed " + formatCount(cnt)
				} else {
					label += " · not yet accessed"
				}
				since := ca.UTC().Format(time.RFC3339)
				e := accessEntry{Kind: "share_link", Label: label, Since: since, AccessCount: &cnt}
				if exp != nil {
					s := exp.UTC().Format(time.RFC3339)
					e.ExpiresAt = &s
				}
				entries = append(entries, e)
			}
		}
	}

	if len(entries) == 0 {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"summary": "Only you",
			"entries": entries,
		})
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"summary": "Shared",
		"entries": entries,
	})
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

	cfg.db.ExecContext(r.Context(),
		"DELETE FROM file_access_keys WHERE file_id = $1 AND user_id != $2", fileID, user.ID)
	cfg.db.ExecContext(r.Context(),
		"UPDATE public_share_links SET is_active = FALSE WHERE file_id = $1 AND owner_id = $2",
		fileID, user.ID)

	respondWithJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func formatCount(n int) string {
	if n == 1 {
		return "1 time"
	}
	return fmt.Sprintf("%d times", n)
}
