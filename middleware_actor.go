package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type actorContextKey struct{}

type actorAuth struct {
	AuthType         string
	KeyID            *uuid.UUID
	KeyKind          string
	Scopes           []string
	AllowedFolderIDs []uuid.UUID
	AllowedIPs       []string
	RateLimitRPM     int32
	User             database.User
}

func actorFromContext(ctx context.Context) (*actorAuth, bool) {
	actor, ok := ctx.Value(actorContextKey{}).(*actorAuth)
	return actor, ok
}

func decodeAgentScopes(raw json.RawMessage) []string {
	if len(raw) == 0 {
		return nil
	}
	var scopes []string
	if err := json.Unmarshal(raw, &scopes); err != nil {
		return nil
	}
	return scopes
}

func (cfg *ApiConfig) middlewareActor(requiredScopes ...string) func(authedHandler) http.HandlerFunc {
	return func(handler authedHandler) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			credential, err := auth.GetBearerToken(r.Header)
			if err != nil {
				respondWithV1Error(w, r, http.StatusUnauthorized, "Missing or invalid token")
				return
			}

			if cfg.Product.IsAgentAPIKey(credential) {
				cfg.handleAgentKeyAuth(w, r, credential, requiredScopes, handler)
				return
			}

			userID, err := auth.ValidateJWT(credential, cfg.jwtSecret)
			if err != nil {
				respondWithV1Error(w, r, http.StatusUnauthorized, "Invalid token")
				return
			}

			user, err := cfg.dbQueries.GetUserByID(r.Context(), userID)
			if err != nil {
				respondWithV1Error(w, r, http.StatusInternalServerError, "Error getting user")
				return
			}

			ctx := context.WithValue(r.Context(), actorContextKey{}, &actorAuth{
				AuthType: "jwt",
				User:     user,
			})
			handler(w, r.WithContext(ctx), user)
		}
	}
}

func (cfg *ApiConfig) handleAgentKeyAuth(w http.ResponseWriter, r *http.Request, rawKey string, requiredScopes []string, handler authedHandler) {
	dbKey, err := cfg.dbQueries.GetAgentAPIKeyByHash(r.Context(), hashAgentAPIKey(rawKey))
	if err != nil {
		respondWithV1Error(w, r, http.StatusUnauthorized, "Invalid API key")
		return
	}

	if dbKey.RevokedAt.Valid || dbKey.Status != "active" {
		respondWithV1ErrorCode(w, r, http.StatusUnauthorized, "key_inactive", "API key is not active")
		return
	}
	if dbKey.ExpiresAt.Valid && dbKey.ExpiresAt.Time.Before(time.Now()) {
		_, _ = cfg.dbQueries.MarkAgentAPIKeyExpired(r.Context(), dbKey.ID)
		cfg.insertActivity(r.Context(), dbKey.UserID, "agent_api_key_expired", map[string]interface{}{
			"key_id": dbKey.ID.String(),
			"name":   dbKey.Name,
		})
		cfg.insertAudit(r.Context(), dbKey.UserID, "agent_api_key.expired", "agent_api_key", &dbKey.ID, map[string]interface{}{
			"path": r.URL.Path,
		}, r)
		broadcastAgentOperation(dbKey.UserID, "agent_api_key.expired", map[string]interface{}{
			"key_id":     dbKey.ID.String(),
			"agent_name": dbKey.Name,
			"key_prefix": dbKey.KeyPrefix,
			"resource":   r.URL.Path,
			"result":     "expired",
			"method":     r.Method,
		})
		respondWithV1ErrorCode(w, r, http.StatusUnauthorized, "key_expired", "API key has expired")
		return
	}

	allowedIPs := decodeStringSliceRawJSON(dbKey.AllowedIps)
	allowedFolderIDs := decodeUUIDSliceRawJSON(dbKey.AllowedFolderIds)
	rpm := int(dbKey.RateLimitRpm)
	if rpm <= 0 {
		rpm = 60
	}

	ip := requestIP(r)
	if len(allowedIPs) > 0 && !ipAllowedByAllowlist(ip, allowedIPs) {
		cfg.insertAudit(r.Context(), dbKey.UserID, "agent_api_key.ip_denied", "agent_api_key", &dbKey.ID, map[string]interface{}{
			"path":      r.URL.Path,
			"method":    r.Method,
			"client_ip": ip,
		}, r)
		broadcastAgentOperation(dbKey.UserID, "agent_api_key.ip_denied", map[string]interface{}{
			"key_id":     dbKey.ID.String(),
			"agent_name": dbKey.Name,
			"key_prefix": dbKey.KeyPrefix,
			"resource":   r.URL.Path,
			"result":     "denied",
			"method":     r.Method,
			"client_ip":  ip,
		})
		respondWithV1ErrorCode(w, r, http.StatusForbidden, "ip_not_allowed", "Request IP address is not in this agent key's allowlist")
		return
	}
	if (!isLoopbackIP(ip) || rpm != 60) && !agentKeyRateLimiter.allow(dbKey.ID.String(), rpm, time.Minute) {
		w.Header().Set("Retry-After", "60")
		respondWithV1ErrorCode(w, r, http.StatusTooManyRequests, "rate_limited", "Rate limit exceeded for this agent key")
		return
	}

	scopes := decodeAgentScopes(dbKey.ScopesJson)
	matchedScope := ""
	for _, required := range requiredScopes {
		if required == scopeFilesSoftDelete && dbKey.KeyKind != agentKeyKindDeleteOnly {
			cfg.insertActivity(r.Context(), dbKey.UserID, "agent_api_key_delete_denied", map[string]interface{}{
				"key_id": dbKey.ID.String(),
				"scope":  required,
				"path":   r.URL.Path,
			})
			cfg.insertAudit(r.Context(), dbKey.UserID, "agent_api_key.delete_denied", "agent_api_key", &dbKey.ID, map[string]interface{}{
				"required_scope": required,
				"key_kind":       dbKey.KeyKind,
				"path":           r.URL.Path,
				"method":         r.Method,
			}, r)
			broadcastAgentOperation(dbKey.UserID, "agent_api_key.scope_denied", map[string]interface{}{
				"key_id":         dbKey.ID.String(),
				"agent_name":     dbKey.Name,
				"key_prefix":     dbKey.KeyPrefix,
				"resource":       r.URL.Path,
				"result":         "denied",
				"method":         r.Method,
				"required_scope": required,
			})
			respondWithV1ErrorCode(w, r, http.StatusForbidden, "delete_key_required", "Standard agent keys cannot delete files or folders. Create a Special Delete-Only key (abrnak_del_) whose actions are 100% recoverable in Trash.")
			return
		}
		if dbKey.KeyKind == agentKeyKindDeleteOnly && required != scopeFilesSoftDelete {
			cfg.insertAudit(r.Context(), dbKey.UserID, "agent_api_key.scope_denied", "agent_api_key", &dbKey.ID, map[string]interface{}{
				"required_scope": required,
				"key_kind":       dbKey.KeyKind,
				"path":           r.URL.Path,
				"method":         r.Method,
			}, r)
			respondWithV1ErrorCode(w, r, http.StatusForbidden, "insufficient_scope", "Special Delete-Only keys are strictly isolated to recoverable trash operations (files:soft_delete)")
			return
		}
		if !scopeAllowed(scopes, required) {
			cfg.insertActivity(r.Context(), dbKey.UserID, "agent_api_key_scope_denied", map[string]interface{}{
				"key_id": dbKey.ID.String(),
				"scope":  required,
				"path":   r.URL.Path,
			})
			cfg.insertAudit(r.Context(), dbKey.UserID, "agent_api_key.scope_denied", "agent_api_key", &dbKey.ID, map[string]interface{}{
				"required_scope": required,
				"path":           r.URL.Path,
				"method":         r.Method,
			}, r)
			broadcastAgentOperation(dbKey.UserID, "agent_api_key.scope_denied", map[string]interface{}{
				"key_id":         dbKey.ID.String(),
				"agent_name":     dbKey.Name,
				"key_prefix":     dbKey.KeyPrefix,
				"resource":       r.URL.Path,
				"result":         "denied",
				"method":         r.Method,
				"required_scope": required,
			})
			respondWithV1ErrorCode(w, r, http.StatusForbidden, "insufficient_scope", "API key scope denied")
			return
		}
		matchedScope = required
	}

	user, err := cfg.dbQueries.GetUserByID(r.Context(), dbKey.UserID)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Error getting user")
		return
	}

	_, _ = cfg.dbQueries.MarkAgentAPIKeyUsed(r.Context(), database.MarkAgentAPIKeyUsedParams{
		ID:                dbKey.ID,
		LastUsedAt:        sql.NullTime{Time: time.Now().UTC(), Valid: true},
		LastUsedIp:        sql.NullString{String: strings.TrimSpace(requestIP(r)), Valid: strings.TrimSpace(requestIP(r)) != ""},
		LastUsedUserAgent: sql.NullString{String: strings.TrimSpace(r.UserAgent()), Valid: strings.TrimSpace(r.UserAgent()) != ""},
		LastSeenContextJson: mustJSON(map[string]interface{}{
			"path":   r.URL.Path,
			"method": r.Method,
		}),
	})
	cfg.insertAudit(r.Context(), dbKey.UserID, "agent_api_key.used", "agent_api_key", &dbKey.ID, map[string]interface{}{
		"path":     r.URL.Path,
		"method":   r.Method,
		"key_kind": dbKey.KeyKind,
	}, r)
	broadcastAgentOperation(dbKey.UserID, "agent_api_key.used", map[string]interface{}{
		"key_id":        dbKey.ID.String(),
		"agent_name":    dbKey.Name,
		"key_prefix":    dbKey.KeyPrefix,
		"key_kind":      dbKey.KeyKind,
		"resource":      r.URL.Path,
		"result":        "ok",
		"method":        r.Method,
		"matched_scope": matchedScope,
	})

	ctx := context.WithValue(r.Context(), actorContextKey{}, &actorAuth{
		AuthType:         "agent_api_key",
		KeyID:            &dbKey.ID,
		KeyKind:          dbKey.KeyKind,
		Scopes:           scopes,
		AllowedFolderIDs: allowedFolderIDs,
		AllowedIPs:       allowedIPs,
		RateLimitRPM:     int32(rpm),
		User:             user,
	})
	handler(w, r.WithContext(ctx), user)
}
