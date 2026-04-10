package main

import (
	"net/http"
	"time"

	"github.com/vinuxito/VaultDrive/internal/database"
)

// handlerListShares returns all outbound access grants for the authenticated user:
// file share links and folder share links, unified with status metadata.
func (cfg *ApiConfig) handlerListShares(w http.ResponseWriter, r *http.Request, user database.User) {
	type ShareItem struct {
		ID             string     `json:"id"`
		Type           string     `json:"type"` // "file" | "folder"
		Token          string     `json:"token"`
		ResourceName   string     `json:"resource_name"`
		ResourceID     string     `json:"resource_id"`
		IsActive       bool       `json:"is_active"`
		ExpiresAt      *time.Time `json:"expires_at,omitempty"`
		CreatedAt      time.Time  `json:"created_at"`
		AccessCount    int        `json:"access_count"`
		LastAccessedAt *time.Time `json:"last_accessed_at,omitempty"`
		Status         string     `json:"status"` // active | expired | revoked | stale | never_used
	}

	items := []ShareItem{}

	// --- File share links ---
	fileRows, err := cfg.db.QueryContext(r.Context(),
		`SELECT psl.id::text, psl.token, f.filename, f.id::text,
		        psl.is_active, psl.expires_at, psl.created_at,
		        psl.access_count, psl.last_accessed_at
		 FROM public_share_links psl
		 INNER JOIN files f ON f.id = psl.file_id
		 WHERE psl.owner_id = $1
		 ORDER BY psl.created_at DESC`, user.ID)
	if err == nil {
		defer fileRows.Close()
		for fileRows.Next() {
			var item ShareItem
			var expiresAt, lastAccessed *time.Time
			if err := fileRows.Scan(
				&item.ID, &item.Token, &item.ResourceName, &item.ResourceID,
				&item.IsActive, &expiresAt, &item.CreatedAt,
				&item.AccessCount, &lastAccessed,
			); err != nil {
				continue
			}
			item.Type = "file"
			item.ExpiresAt = expiresAt
			item.LastAccessedAt = lastAccessed
			item.Status = shareStatus(item.IsActive, expiresAt, lastAccessed, item.AccessCount)
			items = append(items, item)
		}
	}

	// --- Folder share links ---
	folderRows, err := cfg.db.QueryContext(r.Context(),
		`SELECT fsl.id::text, fsl.token, fol.name, fol.id::text,
		        fsl.is_active, fsl.expires_at, fsl.created_at,
		        fsl.access_count, fsl.last_accessed_at
		 FROM folder_share_links fsl
		 INNER JOIN folders fol ON fol.id = fsl.folder_id
		 WHERE fsl.owner_id = $1
		 ORDER BY fsl.created_at DESC`, user.ID)
	if err == nil {
		defer folderRows.Close()
		for folderRows.Next() {
			var item ShareItem
			var expiresAt, lastAccessed *time.Time
			if err := folderRows.Scan(
				&item.ID, &item.Token, &item.ResourceName, &item.ResourceID,
				&item.IsActive, &expiresAt, &item.CreatedAt,
				&item.AccessCount, &lastAccessed,
			); err != nil {
				continue
			}
			item.Type = "folder"
			item.ExpiresAt = expiresAt
			item.LastAccessedAt = lastAccessed
			item.Status = shareStatus(item.IsActive, expiresAt, lastAccessed, item.AccessCount)
			items = append(items, item)
		}
	}

	respondWithJSON(w, http.StatusOK, items)
}

// shareStatus derives a human-readable status from share link state.
func shareStatus(isActive bool, expiresAt, lastAccessedAt *time.Time, accessCount int) string {
	if !isActive {
		return "revoked"
	}
	if expiresAt != nil && expiresAt.Before(time.Now()) {
		return "expired"
	}
	if accessCount == 0 {
		return "never_used"
	}
	if lastAccessedAt != nil && time.Since(*lastAccessedAt) > 30*24*time.Hour {
		return "stale"
	}
	return "active"
}
