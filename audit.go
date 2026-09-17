package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
	"github.com/vinuxito/VaultDrive/internal/database"
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

// Only the immediate trusted proxy may describe its upstream client chain.
// Apache on this host forwards over loopback and appends the actual peer.
func trustedProxyIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip.IsLoopback() {
		return true
	}
	ranges := strings.Split(os.Getenv("TRUSTED_PROXY_CIDRS"), ",")
	if len(ranges) > 16 {
		return false
	}
	for _, raw := range ranges {
		_, network, err := net.ParseCIDR(strings.TrimSpace(raw))
		if err == nil && network.Contains(ip) {
			return true
		}
	}
	return false
}

func requestIP(r *http.Request) string {
	host := strings.TrimSpace(r.RemoteAddr)
	if parsed, _, err := net.SplitHostPort(host); err == nil {
		host = parsed
	}
	peer := net.ParseIP(host)
	if peer == nil {
		return "unknown"
	}
	forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if forwarded == "" || !trustedProxyIP(peer) {
		return peer.String()
	}
	if len(forwarded) > 1024 {
		return "unknown"
	}
	parts := strings.Split(forwarded, ",")
	if len(parts) > 16 {
		return "unknown"
	}
	for i := len(parts) - 1; i >= 0 && trustedProxyIP(peer); i-- {
		peer = net.ParseIP(strings.TrimSpace(parts[i]))
		if peer == nil {
			return "unknown"
		}
	}
	return peer.String()
}

func requestInet(r *http.Request) pqtype.Inet {
	ip := net.ParseIP(requestIP(r))
	if ip == nil {
		return pqtype.Inet{}
	}
	bits := 128
	if ip.To4() != nil {
		bits = 32
	}
	return pqtype.Inet{IPNet: net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)}, Valid: true}
}

func (cfg *ApiConfig) insertActivity(ctx context.Context, userID uuid.UUID, eventType string, payload interface{}) {
	err := cfg.dbQueries.InsertActivity(ctx, database.InsertActivityParams{
		UserID:    userID,
		EventType: eventType,
		Payload:   marshalJSONB(payload),
	})
	if err != nil {
		log.Printf("event=activity_write_failed request_id=%q error_class=%s", operationalRequestID(ctx), operationalErrorClass(err))
	}
}

func (cfg *ApiConfig) insertAudit(ctx context.Context, userID uuid.UUID, action string, resourceType string, resourceID *uuid.UUID, metadata interface{}, r *http.Request) {
	_, err := cfg.dbQueries.CreateAuditLog(ctx, database.CreateAuditLogParams{
		UserID:       nullUUID(userID),
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   nullUUIDPtr(resourceID),
		Metadata:     marshalJSONB(metadata),
		IpAddress:    requestInet(r),
		CreatedAt:    time.Now().UTC(),
	})
	if err != nil {
		log.Printf("event=audit_write_failed request_id=%q error_class=%s", operationalRequestID(ctx), operationalErrorClass(err))
	}
}
