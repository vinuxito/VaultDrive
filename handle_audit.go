package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/vinuxito/VaultDrive/internal/database"
)

// auditEntry is the canonical shape returned by both the list and export endpoints.
type auditEntry struct {
	ID           string          `json:"id"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id,omitempty"`
	IPAddress    string          `json:"ip_address,omitempty"`
	Metadata     json.RawMessage `json:"metadata,omitempty"`
	CreatedAt    string          `json:"created_at"`
}

func parseAuditQueryParams(r *http.Request) (action, resourceType, resourceID, from, to string, limit, offset int32) {
	action = r.URL.Query().Get("action")
	resourceType = r.URL.Query().Get("resource_type")
	resourceID = r.URL.Query().Get("resource_id")
	from = r.URL.Query().Get("from")
	to = r.URL.Query().Get("to")

	limit = 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 500 {
			limit = int32(parsed)
		}
	}
	offset = 0
	if raw := r.URL.Query().Get("offset"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed >= 0 {
			offset = int32(parsed)
		}
	}
	return
}

// fetchAuditLogs builds a dynamic SQL query supporting any combination of
// action, resource_type, resource_id, and date-range filters.
func (cfg *ApiConfig) fetchAuditLogs(r *http.Request, user database.User, limit, offset int32, action, resourceType, resourceID, from, to string) ([]auditEntry, error) {
	args := []interface{}{user.ID}
	conditions := []string{"user_id = $1"}
	argIdx := 2

	if action != "" {
		conditions = append(conditions, fmt.Sprintf("action = $%d", argIdx))
		args = append(args, action)
		argIdx++
	}
	if resourceType != "" {
		conditions = append(conditions, fmt.Sprintf("resource_type = $%d", argIdx))
		args = append(args, resourceType)
		argIdx++
	}
	if resourceID != "" {
		conditions = append(conditions, fmt.Sprintf("resource_id::text = $%d", argIdx))
		args = append(args, resourceID)
		argIdx++
	}
	if from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			conditions = append(conditions, fmt.Sprintf("created_at >= $%d", argIdx))
			args = append(args, t)
			argIdx++
		}
	}
	if to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			conditions = append(conditions, fmt.Sprintf("created_at <= $%d", argIdx))
			args = append(args, t)
			argIdx++
		}
	}

	query := fmt.Sprintf(
		`SELECT id, action, resource_type, resource_id, ip_address, metadata, created_at
		 FROM audit_logs
		 WHERE %s
		 ORDER BY created_at DESC
		 LIMIT $%d OFFSET $%d`,
		strings.Join(conditions, " AND "),
		argIdx, argIdx+1,
	)
	args = append(args, limit, offset)

	rows, err := cfg.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []auditEntry
	for rows.Next() {
		var e auditEntry
		var createdAt time.Time
		var resourceIDRaw interface{}
		var ipRaw interface{}
		var metaRaw []byte

		if err := rows.Scan(&e.ID, &e.Action, &e.ResourceType, &resourceIDRaw, &ipRaw, &metaRaw, &createdAt); err != nil {
			return nil, err
		}
		if resourceIDRaw != nil {
			e.ResourceID = fmt.Sprintf("%v", resourceIDRaw)
		}
		if ipRaw != nil {
			e.IPAddress = fmt.Sprintf("%v", ipRaw)
		}
		if len(metaRaw) > 0 {
			e.Metadata = json.RawMessage(metaRaw)
		}
		e.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return entries, nil
}

func (cfg *ApiConfig) handlerGetAuditLogs(w http.ResponseWriter, r *http.Request, user database.User) {
	action, resourceType, resourceID, from, to, limit, offset := parseAuditQueryParams(r)

	entries, err := cfg.fetchAuditLogs(r, user, limit, offset, action, resourceType, resourceID, from, to)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not fetch audit logs")
		return
	}
	if entries == nil {
		entries = []auditEntry{}
	}

	respondWithV1(w, r, http.StatusOK, entries, map[string]int{
		"count":  len(entries),
		"limit":  int(limit),
		"offset": int(offset),
	})
}

// handlerExportAuditLogs exports filtered audit logs as CSV or JSON.
// Accepts the same filter params as the list endpoint, plus ?format=csv|json.
func (cfg *ApiConfig) handlerExportAuditLogs(w http.ResponseWriter, r *http.Request, user database.User) {
	action, resourceType, resourceID, from, to, _, _ := parseAuditQueryParams(r)
	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	const exportLimit = 10_000
	entries, err := cfg.fetchAuditLogs(r, user, exportLimit, 0, action, resourceType, resourceID, from, to)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not fetch audit logs for export")
		return
	}
	if entries == nil {
		entries = []auditEntry{}
	}

	if len(entries) == exportLimit {
		w.Header().Set("X-Export-Truncated", "true")
	}

	timestamp := time.Now().UTC().Format("2006-01-02")

	switch format {
	case "csv":
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="audit-%s.csv"`, timestamp))
		cw := csv.NewWriter(w)
		_ = cw.Write([]string{"timestamp", "action", "resource_type", "resource_id", "ip_address", "metadata"})
		for _, e := range entries {
			meta := ""
			if e.Metadata != nil {
				meta = string(e.Metadata)
			}
			_ = cw.Write([]string{e.CreatedAt, e.Action, e.ResourceType, e.ResourceID, e.IPAddress, meta})
		}
		cw.Flush()
	default:
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="audit-%s.json"`, timestamp))
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"entries":   entries,
			"truncated": len(entries) == exportLimit,
			"count":     len(entries),
		})
	}
}
