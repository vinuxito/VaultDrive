package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

type agentAPIKeyResponse struct {
	ID                string     `json:"id"`
	Name              string     `json:"name"`
	KeyPrefix         string     `json:"key_prefix"`
	Scopes            []string   `json:"scopes"`
	Status            string     `json:"status"`
	CreatedAt         time.Time  `json:"created_at"`
	LastUsedAt        *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt         *time.Time `json:"expires_at,omitempty"`
	RevokedAt         *time.Time `json:"revoked_at,omitempty"`
	CreatedByIP       string     `json:"created_by_ip,omitempty"`
	LastUsedIP        string     `json:"last_used_ip,omitempty"`
	LastUsedUserAgent string     `json:"last_used_user_agent,omitempty"`
	Notes             string     `json:"notes,omitempty"`
	UsageCount        int32      `json:"usage_count"`
	PlaintextKey      string     `json:"plaintext_key,omitempty"`
}

func toAgentAPIKeyResponse(key database.AgentApiKey) agentAPIKeyResponse {
	resp := agentAPIKeyResponse{
		ID:                key.ID.String(),
		Name:              key.Name,
		KeyPrefix:         key.KeyPrefix,
		Scopes:            decodeAgentScopes(key.ScopesJson),
		Status:            key.Status,
		CreatedAt:         key.CreatedAt,
		CreatedByIP:       key.CreatedByIp.String,
		LastUsedIP:        key.LastUsedIp.String,
		LastUsedUserAgent: key.LastUsedUserAgent.String,
		Notes:             key.Notes.String,
		UsageCount:        key.UsageCount,
	}
	if key.LastUsedAt.Valid {
		t := key.LastUsedAt.Time
		resp.LastUsedAt = &t
	}
	if key.ExpiresAt.Valid {
		t := key.ExpiresAt.Time
		resp.ExpiresAt = &t
	}
	if key.RevokedAt.Valid {
		t := key.RevokedAt.Time
		resp.RevokedAt = &t
	}
	if resp.Status == "active" && key.ExpiresAt.Valid && key.ExpiresAt.Time.Before(time.Now()) {
		resp.Status = "expired"
	}
	return resp
}

func (cfg *ApiConfig) handlerListAgentAPIKeys(w http.ResponseWriter, r *http.Request, user database.User) {
	keys, err := cfg.dbQueries.ListAgentAPIKeysByUser(r.Context(), user.ID)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not list agent API keys")
		return
	}
	items := make([]agentAPIKeyResponse, 0, len(keys))
	for _, key := range keys {
		items = append(items, toAgentAPIKeyResponse(key))
	}
	respondWithV1(w, r, http.StatusOK, items, map[string]int{"count": len(items)})
}

func (cfg *ApiConfig) handlerCreateAgentAPIKey(w http.ResponseWriter, r *http.Request, user database.User) {
	actor, _ := actorFromContext(r.Context())
	var body struct {
		Name      string   `json:"name"`
		Scopes    []string `json:"scopes"`
		ExpiresAt string   `json:"expires_at"`
		Notes     string   `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	name := body.Name
	if name == "" {
		respondWithV1Error(w, r, http.StatusBadRequest, "Name is required")
		return
	}
	scopes := normalizeAgentScopes(body.Scopes)
	if len(scopes) == 0 {
		respondWithV1Error(w, r, http.StatusBadRequest, "At least one scope is required")
		return
	}
	if err := validateAgentScopes(scopes); err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, err.Error())
		return
	}
	if actor != nil && actor.AuthType == "agent_api_key" {
		for _, requested := range scopes {
			if !scopeAllowed(actor.Scopes, requested) {
				respondWithV1Error(w, r, http.StatusForbidden, "Agent keys cannot create broader child scopes")
				return
			}
		}
	}
	rawKey, prefix, hash, err := generateAgentAPIKeyToken()
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not generate API key")
		return
	}
	var expiresAt sql.NullTime
	if body.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, body.ExpiresAt)
		if err != nil {
			respondWithV1Error(w, r, http.StatusBadRequest, "Invalid expires_at format")
			return
		}
		expiresAt = sql.NullTime{Time: t, Valid: true}
	}
	created, err := cfg.dbQueries.CreateAgentAPIKey(r.Context(), database.CreateAgentAPIKeyParams{
		UserID:              user.ID,
		Name:                name,
		KeyPrefix:           prefix,
		KeyHash:             hash,
		ScopesJson:          mustJSON(scopes),
		Status:              "active",
		CreatedByIp:         sql.NullString{String: requestIP(r), Valid: requestIP(r) != ""},
		ExpiresAt:           expiresAt,
		Notes:               sql.NullString{String: body.Notes, Valid: body.Notes != ""},
		UsageCount:          0,
		LastSeenContextJson: mustJSON(map[string]interface{}{}),
	})
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not create API key")
		return
	}
	resp := toAgentAPIKeyResponse(created)
	resp.PlaintextKey = rawKey
	cfg.insertActivity(r.Context(), user.ID, "agent_api_key_created", map[string]interface{}{
		"key_id":     created.ID.String(),
		"name":       created.Name,
		"key_prefix": created.KeyPrefix,
		"scopes":     scopes,
	})
	cfg.insertAudit(r.Context(), user.ID, "agent_api_key.created", "agent_api_key", &created.ID, map[string]interface{}{
		"name":       created.Name,
		"key_prefix": created.KeyPrefix,
		"scopes":     scopes,
	}, r)
	broadcastAgentOperation(user.ID, "agent_api_key.created", map[string]interface{}{
		"key_id":      created.ID.String(),
		"agent_name":  created.Name,
		"key_prefix":  created.KeyPrefix,
		"resource":    "/api/v1/agent-keys",
		"result":      "created",
		"method":      http.MethodPost,
		"scope_grant": scopes,
	})
	respondWithV1(w, r, http.StatusCreated, resp, nil)
}

func (cfg *ApiConfig) handlerRevokeAgentAPIKey(w http.ResponseWriter, r *http.Request, user database.User) {
	keyID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid API key ID")
		return
	}
	revoked, err := cfg.dbQueries.RevokeAgentAPIKey(r.Context(), database.RevokeAgentAPIKeyParams{
		ID:        keyID,
		UserID:    user.ID,
		RevokedAt: sql.NullTime{Time: time.Now().UTC(), Valid: true},
	})
	if err != nil {
		respondWithV1Error(w, r, http.StatusNotFound, "API key not found")
		return
	}
	cfg.insertActivity(r.Context(), user.ID, "agent_api_key_revoked", map[string]interface{}{
		"key_id":     revoked.ID.String(),
		"name":       revoked.Name,
		"key_prefix": revoked.KeyPrefix,
	})
	cfg.insertAudit(r.Context(), user.ID, "agent_api_key.revoked", "agent_api_key", &revoked.ID, map[string]interface{}{
		"name":       revoked.Name,
		"key_prefix": revoked.KeyPrefix,
	}, r)
	broadcastAgentOperation(user.ID, "agent_api_key.revoked", map[string]interface{}{
		"key_id":     revoked.ID.String(),
		"agent_name": revoked.Name,
		"key_prefix": revoked.KeyPrefix,
		"resource":   "/api/v1/agent-keys/" + revoked.ID.String(),
		"result":     "revoked",
		"method":     http.MethodDelete,
	})
	respondWithV1(w, r, http.StatusOK, toAgentAPIKeyResponse(revoked), nil)
}

func (cfg *ApiConfig) handlerAgentAuthIntrospect(w http.ResponseWriter, r *http.Request, user database.User) {
	actor, _ := actorFromContext(r.Context())
	data := map[string]interface{}{
		"auth_type": "jwt",
		"user_id":   user.ID.String(),
	}
	if actor != nil {
		data["auth_type"] = actor.AuthType
		data["scopes"] = actor.Scopes
		if actor.KeyID != nil {
			data["key_id"] = actor.KeyID.String()
		}
	}
	respondWithV1(w, r, http.StatusOK, data, nil)
}
