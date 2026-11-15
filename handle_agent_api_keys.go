package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type agentAPIKeyResponse struct {
	ID                string     `json:"id"`
	Name              string     `json:"name"`
	KeyPrefix         string     `json:"key_prefix"`
	KeyKind           string     `json:"key_kind"`
	Scopes            []string   `json:"scopes"`
	AllowedFolderIDs  []string   `json:"allowed_folder_ids,omitempty"`
	AllowedIPs        []string   `json:"allowed_ips,omitempty"`
	RateLimitRPM      int32      `json:"rate_limit_rpm"`
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
	kind := key.KeyKind
	if kind == "" {
		kind = agentKeyKindStandard
	}
	rpm := key.RateLimitRpm
	if rpm <= 0 {
		rpm = 60
	}
	resp := agentAPIKeyResponse{
		ID:                key.ID.String(),
		Name:              key.Name,
		KeyPrefix:         key.KeyPrefix,
		KeyKind:           kind,
		Scopes:            decodeAgentScopes(key.ScopesJson),
		AllowedFolderIDs:  decodeStringSliceRawJSON(key.AllowedFolderIds),
		AllowedIPs:        decodeStringSliceRawJSON(key.AllowedIps),
		RateLimitRPM:      rpm,
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
		Name             string   `json:"name"`
		KeyKind          string   `json:"key_kind"`
		Scopes           []string `json:"scopes"`
		ExpiresAt        string   `json:"expires_at"`
		Notes            string   `json:"notes"`
		AllowedFolderIDs []string `json:"allowed_folder_ids"`
		AllowedIPs       []string `json:"allowed_ips"`
		RateLimitRPM     *int     `json:"rate_limit_rpm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid request body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		respondWithV1Error(w, r, http.StatusBadRequest, "Name is required")
		return
	}
	if len(name) > 64 {
		respondWithV1Error(w, r, http.StatusBadRequest, "Name must be 64 characters or fewer")
		return
	}
	if actor != nil && actor.AuthType == "agent_api_key" {
		if strings.TrimSpace(body.KeyKind) == agentKeyKindDeleteOnly || scopeAllowed(normalizeAgentScopes(body.Scopes), scopeFilesSoftDelete) {
			respondWithV1ErrorCode(w, r, http.StatusForbidden, "human_jwt_required", "Only human owner sessions can mint a Special Delete-Only key")
			return
		}
	}
	keyKind, scopes, err := normalizeAgentKeyConfig(body.KeyKind, body.Scopes)
	if err != nil {
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

	folderIDs, err := cfg.validateAndNormalizeAllowedFolders(r.Context(), user.ID, body.AllowedFolderIDs)
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, err.Error())
		return
	}
	allowedIPs, err := normalizeAllowedIPsInput(body.AllowedIPs)
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, err.Error())
		return
	}
	rateLimitRPM, err := normalizeRateLimitRPMInput(body.RateLimitRPM)
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, err.Error())
		return
	}

	if actor != nil && actor.AuthType == "agent_api_key" {
		_, parentSet, setErr := cfg.resolveActorAllowedFolderSet(r.Context(), actor)
		if setErr != nil {
			respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to verify parent folder scope")
			return
		}
		var denyCode, denyMsg string
		folderIDs, allowedIPs, rateLimitRPM, denyCode, denyMsg = attenuateAgentKeyGuardrails(
			actor,
			parentSet,
			folderIDs,
			allowedIPs,
			rateLimitRPM,
			body.RateLimitRPM != nil,
		)
		if denyCode != "" {
			respondWithV1ErrorCode(w, r, http.StatusForbidden, denyCode, denyMsg)
			return
		}
	}

	tokenPrefix := cfg.Product.AgentKeyPrefix
	if keyKind == agentKeyKindDeleteOnly {
		tokenPrefix = cfg.Product.AgentKeyPrefix + "_del"
	}
	rawKey, prefix, hash, err := generateAgentAPIKeyToken(tokenPrefix)
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
		KeyKind:             keyKind,
		AllowedFolderIds:    encodeUUIDSliceRawJSON(folderIDs),
		AllowedIps:          encodeStringSliceRawJSON(allowedIPs),
		RateLimitRpm:        rateLimitRPM,
	})
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Could not create API key")
		return
	}
	resp := toAgentAPIKeyResponse(created)
	resp.PlaintextKey = rawKey
	cfg.insertActivity(r.Context(), user.ID, "agent_api_key_created", map[string]interface{}{
		"key_id":             created.ID.String(),
		"name":               created.Name,
		"key_prefix":         created.KeyPrefix,
		"key_kind":           keyKind,
		"scopes":             scopes,
		"allowed_folder_ids": resp.AllowedFolderIDs,
		"allowed_ips":        resp.AllowedIPs,
		"rate_limit_rpm":     resp.RateLimitRPM,
	})
	cfg.insertAudit(r.Context(), user.ID, "agent_api_key.created", "agent_api_key", &created.ID, map[string]interface{}{
		"name":               created.Name,
		"key_prefix":         created.KeyPrefix,
		"key_kind":           keyKind,
		"scopes":             scopes,
		"allowed_folder_ids": resp.AllowedFolderIDs,
		"allowed_ips":        resp.AllowedIPs,
		"rate_limit_rpm":     resp.RateLimitRPM,
	}, r)
	broadcastAgentOperation(user.ID, "agent_api_key.created", map[string]interface{}{
		"key_id":      created.ID.String(),
		"agent_name":  created.Name,
		"key_prefix":  created.KeyPrefix,
		"key_kind":    keyKind,
		"resource":    "/api/v1/agent-keys",
		"result":      "created",
		"method":      http.MethodPost,
		"scope_grant": scopes,
	})
	respondWithV1(w, r, http.StatusCreated, resp, nil)
}

func (cfg *ApiConfig) handlerRevokeAgentAPIKey(w http.ResponseWriter, r *http.Request, user database.User) {
	actor, _ := actorFromContext(r.Context())
	keyID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		respondWithV1Error(w, r, http.StatusBadRequest, "Invalid API key ID")
		return
	}
	if actor != nil && actor.AuthType == "agent_api_key" {
		existing, lookupErr := cfg.dbQueries.GetAgentAPIKeyByIDForUser(r.Context(), database.GetAgentAPIKeyByIDForUserParams{
			ID:     keyID,
			UserID: user.ID,
		})
		if lookupErr == nil && existing.KeyKind == agentKeyKindDeleteOnly {
			respondWithV1ErrorCode(w, r, http.StatusForbidden, "human_jwt_required", "Only human owner sessions can revoke a Special Delete-Only key")
			return
		}
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
		"key_kind":   revoked.KeyKind,
	})
	cfg.insertAudit(r.Context(), user.ID, "agent_api_key.revoked", "agent_api_key", &revoked.ID, map[string]interface{}{
		"name":       revoked.Name,
		"key_prefix": revoked.KeyPrefix,
		"key_kind":   revoked.KeyKind,
	}, r)
	broadcastAgentOperation(user.ID, "agent_api_key.revoked", map[string]interface{}{
		"key_id":     revoked.ID.String(),
		"agent_name": revoked.Name,
		"key_prefix": revoked.KeyPrefix,
		"key_kind":   revoked.KeyKind,
		"resource":   "/api/v1/agent-keys/" + revoked.ID.String(),
		"result":     "revoked",
		"method":     http.MethodDelete,
	})
	respondWithV1(w, r, http.StatusOK, toAgentAPIKeyResponse(revoked), nil)
}

func (cfg *ApiConfig) handlerAgentAuthIntrospect(w http.ResponseWriter, r *http.Request, user database.User) {
	actor, _ := actorFromContext(r.Context())
	dbUser, userErr := cfg.dbQueries.GetUserByID(r.Context(), user.ID)
	publicKey := ""
	if userErr == nil {
		publicKey = dbUser.PublicKey
	}
	data := map[string]interface{}{
		"auth_type": "jwt",
		"key_kind":  "human_jwt",
		"user_id":   user.ID.String(),
	}
	if actor != nil {
		data["auth_type"] = actor.AuthType
		data["scopes"] = actor.Scopes
		if actor.KeyKind != "" {
			data["key_kind"] = actor.KeyKind
		}
		if actor.KeyID != nil {
			data["key_id"] = actor.KeyID.String()
		}
		if actor.AuthType == "agent_api_key" {
			folderStrs := make([]string, 0, len(actor.AllowedFolderIDs))
			for _, fid := range actor.AllowedFolderIDs {
				folderStrs = append(folderStrs, fid.String())
			}
			data["allowed_folder_ids"] = folderStrs
			data["allowed_ips"] = actor.AllowedIPs
			data["rate_limit_rpm"] = actor.RateLimitRPM
		}
	}
	if publicKey != "" {
		data["public_key"] = publicKey
	}
	respondWithV1(w, r, http.StatusOK, data, nil)
}
