package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
)

func (cfg *ApiConfig) handlerGetActivity(w http.ResponseWriter, r *http.Request, user database.User) {
	items, err := cfg.dbQueries.GetRecentActivitiesForUser(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not fetch activity", err)
		return
	}

	type ActivityResponse struct {
		ID        string `json:"id"`
		EventType string `json:"event_type"`
		Message   string `json:"message"`
		CreatedAt string `json:"created_at"`
	}

	result := make([]ActivityResponse, 0, len(items))
	for _, item := range items {
		msg := item.EventType
		if item.Payload.RawMessage != nil {
			var p map[string]interface{}
			if json.Unmarshal(item.Payload.RawMessage, &p) == nil {
				if fn, ok := p["filename"].(string); ok && fn != "" {
					switch item.EventType {
					case "drop_upload":
						msg = "File received: " + fn
					case "file_upload":
						msg = "File uploaded: " + fn
					case "file_share":
						msg = "File shared: " + fn
					}
				} else if tk, ok := p["token"].(string); ok && tk != "" {
					msg = "Drop link activity: " + tk[:8] + "…"
				}
			}
		}
		result = append(result, ActivityResponse{
			ID:        item.ID.String(),
			EventType: item.EventType,
			Message:   msg,
			CreatedAt: item.CreatedAt.UTC().Format(time.RFC3339),
		})
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (cfg *ApiConfig) handlerGetSecurityPosture(w http.ResponseWriter, r *http.Request, user database.User) {
	type ExpiringToken struct {
		ID       string `json:"id"`
		LinkName string `json:"link_name"`
		ExpiresAt string `json:"expires_at"`
	}
	type StaleLink struct {
		ID        string `json:"id"`
		Token     string `json:"token"`
		CreatedAt string `json:"created_at"`
	}

	expiringTokens := []ExpiringToken{}
	rows, err := cfg.db.QueryContext(r.Context(),
		`SELECT id::text, COALESCE(link_name,''), expires_at
		 FROM upload_tokens
		 WHERE owner_user_id = $1
		   AND used = FALSE
		   AND expires_at IS NOT NULL
		   AND expires_at > NOW()
		   AND expires_at < NOW() + INTERVAL '48 hours'
		 ORDER BY expires_at ASC`, user.ID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t ExpiringToken
			var exp time.Time
			if rows.Scan(&t.ID, &t.LinkName, &exp) == nil {
				t.ExpiresAt = exp.UTC().Format(time.RFC3339)
				expiringTokens = append(expiringTokens, t)
			}
		}
	}

	staleLinks := []StaleLink{}
	rows2, err := cfg.db.QueryContext(r.Context(),
		`SELECT id::text, token, created_at
		 FROM public_share_links
		 WHERE owner_id = $1
		   AND is_active = TRUE
		   AND created_at < NOW() - INTERVAL '30 days'
		   AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '30 days')
		 ORDER BY created_at ASC
		 LIMIT 10`, user.ID)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var l StaleLink
			var ca time.Time
			if rows2.Scan(&l.ID, &l.Token, &ca) == nil {
				l.CreatedAt = ca.UTC().Format(time.RFC3339)
				staleLinks = append(staleLinks, l)
			}
		}
	}

	attentionCount := len(expiringTokens) + len(staleLinks)

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":          "healthy",
		"attention_count": attentionCount,
		"expiring_tokens": expiringTokens,
		"stale_links":     staleLinks,
	})
}
