package main

import (
	"net/http"
	"strconv"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerGetAuditLogs(w http.ResponseWriter, r *http.Request, user database.User) {
	limit := int32(50)
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 200 {
			limit = int32(parsed)
		}
	}
	offset := int32(0)
	if raw := r.URL.Query().Get("offset"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = int32(parsed)
		}
	}
	logs, err := cfg.dbQueries.GetRecentAuditLogs(r.Context(), database.GetRecentAuditLogsParams{
		UserID: nullUUID(user.ID),
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not fetch audit logs")
		return
	}
	resourceType := r.URL.Query().Get("resource_type")
	resourceID := r.URL.Query().Get("resource_id")
	items := make([]map[string]interface{}, 0, len(logs))
	for _, item := range logs {
		if resourceType != "" && item.ResourceType != resourceType {
			continue
		}
		if resourceID != "" {
			parsedID, err := uuid.Parse(resourceID)
			if err != nil || !item.ResourceID.Valid || item.ResourceID.UUID != parsedID {
				continue
			}
		}
		entry := map[string]interface{}{
			"id":            item.ID.String(),
			"action":        item.Action,
			"resource_type": item.ResourceType,
			"created_at":    item.CreatedAt,
		}
		if item.ResourceID.Valid {
			entry["resource_id"] = item.ResourceID.UUID.String()
		}
		if item.Metadata.Valid {
			entry["metadata"] = item.Metadata.RawMessage
		}
		items = append(items, entry)
	}
	respondWithV1(w, r, http.StatusOK, items, map[string]int{
		"count":  len(items),
		"limit":  int(limit),
		"offset": int(offset),
	})
}
