package main

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

func nullUUID(id uuid.UUID) uuid.NullUUID {
	return uuid.NullUUID{UUID: id, Valid: true}
}

func nullUUIDPtr(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func marshalJSONB(value interface{}) pqtype.NullRawMessage {
	if value == nil {
		return pqtype.NullRawMessage{}
	}
	b, err := json.Marshal(value)
	if err != nil {
		return pqtype.NullRawMessage{}
	}
	return pqtype.NullRawMessage{RawMessage: b, Valid: true}
}

func mustJSON(value interface{}) json.RawMessage {
	b, err := json.Marshal(value)
	if err != nil {
		return json.RawMessage([]byte("{}"))
	}
	return json.RawMessage(b)
}

func requestIP(r *http.Request) string {
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func requestInet(r *http.Request) pqtype.Inet {
	ip := net.ParseIP(requestIP(r))
	if ip == nil {
		return pqtype.Inet{}
	}
	return pqtype.Inet{IPNet: net.IPNet{IP: ip, Mask: net.CIDRMask(32, 32)}, Valid: true}
}

func (cfg *ApiConfig) insertActivity(ctx context.Context, userID uuid.UUID, eventType string, payload interface{}) {
	_ = cfg.dbQueries.InsertActivity(ctx, database.InsertActivityParams{
		UserID:    userID,
		EventType: eventType,
		Payload:   marshalJSONB(payload),
	})
}

func (cfg *ApiConfig) insertAudit(ctx context.Context, userID uuid.UUID, action string, resourceType string, resourceID *uuid.UUID, metadata interface{}, r *http.Request) {
	_, _ = cfg.dbQueries.CreateAuditLog(ctx, database.CreateAuditLogParams{
		UserID:       nullUUID(userID),
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   nullUUIDPtr(resourceID),
		Metadata:     marshalJSONB(metadata),
		IpAddress:    requestInet(r),
		CreatedAt:    time.Now().UTC(),
	})
	}
