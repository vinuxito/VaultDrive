package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func decodeStringSliceRawJSON(raw pqtype.NullRawMessage) []string {
	if !raw.Valid || len(raw.RawMessage) == 0 {
		return nil
	}
	var out []string
	if err := json.Unmarshal(raw.RawMessage, &out); err != nil {
		return nil
	}
	return out
}

func decodeUUIDSliceRawJSON(raw pqtype.NullRawMessage) []uuid.UUID {
	items := decodeStringSliceRawJSON(raw)
	if len(items) == 0 {
		return nil
	}
	out := make([]uuid.UUID, 0, len(items))
	for _, s := range items {
		if id, err := uuid.Parse(s); err == nil {
			out = append(out, id)
		}
	}
	return out
}

func encodeStringSliceRawJSON(items []string) pqtype.NullRawMessage {
	if len(items) == 0 {
		return pqtype.NullRawMessage{}
	}
	b, _ := json.Marshal(items)
	return pqtype.NullRawMessage{RawMessage: b, Valid: true}
}

func encodeUUIDSliceRawJSON(ids []uuid.UUID) pqtype.NullRawMessage {
	if len(ids) == 0 {
		return pqtype.NullRawMessage{}
	}
	strs := make([]string, 0, len(ids))
	for _, id := range ids {
		strs = append(strs, id.String())
	}
	return encodeStringSliceRawJSON(strs)
}

func normalizeAllowedIPsInput(raw []string) ([]string, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	seen := make(map[string]struct{}, len(raw))
	out := make([]string, 0, len(raw))
	for _, entry := range raw {
		trimmed := strings.TrimSpace(entry)
		if trimmed == "" {
			continue
		}
		if strings.Contains(trimmed, "/") {
			_, cidr, err := net.ParseCIDR(trimmed)
			if err != nil {
				return nil, fmt.Errorf("Invalid CIDR entry in allowed_ips: %q", trimmed)
			}
			canon := cidr.String()
			if _, ok := seen[canon]; !ok {
				seen[canon] = struct{}{}
				out = append(out, canon)
			}
		} else {
			ip := net.ParseIP(trimmed)
			if ip == nil {
				return nil, fmt.Errorf("Invalid IP address in allowed_ips: %q", trimmed)
			}
			canon := ip.String()
			if _, ok := seen[canon]; !ok {
				seen[canon] = struct{}{}
				out = append(out, canon)
			}
		}
	}
	return out, nil
}

func parseClientIP(raw string) net.IP {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil
	}
	if host, _, err := net.SplitHostPort(s); err == nil {
		s = host
	}
	s = strings.Trim(s, "[]")
	return net.ParseIP(s)
}

func ipAllowedByAllowlist(clientIP string, allowlist []string) bool {
	if len(allowlist) == 0 {
		return true
	}
	parsed := parseClientIP(clientIP)
	if parsed == nil {
		return false
	}
	for _, rule := range allowlist {
		if strings.Contains(rule, "/") {
			if _, cidr, err := net.ParseCIDR(rule); err == nil && cidr.Contains(parsed) {
				return true
			}
		} else if allowedIP := net.ParseIP(rule); allowedIP != nil && allowedIP.Equal(parsed) {
			return true
		}
	}
	return false
}

func normalizeRateLimitRPMInput(rpm *int) (int32, error) {
	if rpm == nil {
		return 60, nil
	}
	if *rpm < 1 || *rpm > 6000 {
		return 0, fmt.Errorf("rate_limit_rpm must be between 1 and 6000")
	}
	return int32(*rpm), nil
}

func (cfg *ApiConfig) validateAndNormalizeAllowedFolders(ctx context.Context, ownerID uuid.UUID, rawIDs []string) ([]uuid.UUID, error) {
	if len(rawIDs) == 0 {
		return nil, nil
	}
	seen := make(map[uuid.UUID]struct{}, len(rawIDs))
	out := make([]uuid.UUID, 0, len(rawIDs))
	for _, raw := range rawIDs {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}
		fid, err := uuid.Parse(trimmed)
		if err != nil {
			return nil, fmt.Errorf("Invalid folder UUID in allowed_folder_ids: %q", trimmed)
		}
		if _, ok := seen[fid]; ok {
			continue
		}
		folder, err := cfg.dbQueries.GetFolderByID(ctx, fid)
		if err != nil || folder.OwnerID != ownerID {
			return nil, fmt.Errorf("Folder %s not found or not owned by user", fid.String())
		}
		seen[fid] = struct{}{}
		out = append(out, fid)
	}
	return out, nil
}

func (cfg *ApiConfig) resolveActorAllowedFolderSet(ctx context.Context, actor *actorAuth) (bool, map[uuid.UUID]struct{}, error) {
	if actor == nil || actor.AuthType != "agent_api_key" || len(actor.AllowedFolderIDs) == 0 {
		return false, nil, nil
	}
	ids, err := cfg.dbQueries.GetActiveDescendantFolderIDsForOwner(ctx, database.GetActiveDescendantFolderIDsForOwnerParams{
		OwnerID: actor.User.ID,
		Column2: actor.AllowedFolderIDs,
	})
	if err != nil {
		return true, nil, err
	}
	set := make(map[uuid.UUID]struct{}, len(ids))
	for _, id := range ids {
		set[id] = struct{}{}
	}
	return true, set, nil
}

func (cfg *ApiConfig) denyFolderScope(w http.ResponseWriter, r *http.Request, folderID *uuid.UUID, reason string) {
	actor, _ := actorFromContext(r.Context())
	if actor != nil && actor.KeyID != nil {
		meta := map[string]interface{}{
			"path":   r.URL.Path,
			"method": r.Method,
			"reason": reason,
		}
		if folderID != nil {
			meta["folder_id"] = folderID.String()
		}
		cfg.insertAudit(r.Context(), actor.User.ID, "agent_api_key.folder_denied", "agent_api_key", actor.KeyID, meta, r)
		broadcastAgentOperation(actor.User.ID, "agent_api_key.folder_denied", map[string]interface{}{
			"key_id":   actor.KeyID.String(),
			"resource": r.URL.Path,
			"result":   "denied",
			"method":   r.Method,
			"reason":   reason,
		})
	}
	respondWithV1ErrorCode(w, r, http.StatusForbidden, "folder_scope_denied", reason)
}

func (cfg *ApiConfig) enforceFolderJailID(w http.ResponseWriter, r *http.Request, folderID *uuid.UUID, allowEmpty bool) bool {
	actor, ok := actorFromContext(r.Context())
	if !ok || actor == nil || actor.AuthType != "agent_api_key" || len(actor.AllowedFolderIDs) == 0 {
		return true
	}
	if folderID == nil {
		if allowEmpty {
			return true
		}
		cfg.denyFolderScope(w, r, nil, "This agent key is restricted to specific folders; root-level access is denied")
		return false
	}
	jailed, set, err := cfg.resolveActorAllowedFolderSet(r.Context(), actor)
	if err != nil {
		respondWithV1Error(w, r, http.StatusInternalServerError, "Failed to verify folder scope")
		return false
	}
	if !jailed {
		return true
	}
	if _, allowed := set[*folderID]; !allowed {
		cfg.denyFolderScope(w, r, folderID, "Folder is outside this agent key's allowed folder scope")
		return false
	}
	return true
}

func (cfg *ApiConfig) enforceFolderJailForFile(w http.ResponseWriter, r *http.Request, file database.File) bool {
	var fid *uuid.UUID
	if file.FolderID.Valid {
		v := file.FolderID.UUID
		fid = &v
	}
	return cfg.enforceFolderJailID(w, r, fid, false)
}

func attenuateAgentKeyGuardrails(
	parent *actorAuth,
	parentAllowedSet map[uuid.UUID]struct{},
	reqFolders []uuid.UUID,
	reqIPs []string,
	reqRPM int32,
	hasCustomRPM bool,
) ([]uuid.UUID, []string, int32, string, string) {
	finalRPM := reqRPM
	if !hasCustomRPM && parent.RateLimitRPM > 0 {
		finalRPM = parent.RateLimitRPM
	} else if parent.RateLimitRPM > 0 && parent.RateLimitRPM < finalRPM {
		finalRPM = parent.RateLimitRPM
	}

	finalFolders := reqFolders
	if len(parent.AllowedFolderIDs) > 0 {
		if len(reqFolders) == 0 {
			finalFolders = append([]uuid.UUID(nil), parent.AllowedFolderIDs...)
		} else {
			for _, fid := range reqFolders {
				if _, ok := parentAllowedSet[fid]; !ok {
					return nil, nil, 0, "folder_scope_denied", "Child key allowed_folder_ids must stay inside parent key folder scope"
				}
			}
		}
	}

	finalIPs := reqIPs
	if len(parent.AllowedIPs) > 0 {
		if len(reqIPs) == 0 {
			finalIPs = append([]string(nil), parent.AllowedIPs...)
		} else {
			for _, ipOrCIDR := range reqIPs {
				if !cidrOrIPSubset(ipOrCIDR, parent.AllowedIPs) {
					return nil, nil, 0, "ip_not_allowed", "Child key allowed_ips must be a subset of parent key allowed_ips"
				}
			}
		}
	}

	return finalFolders, finalIPs, finalRPM, "", ""
}

func cidrOrIPSubset(childRule string, parentRules []string) bool {
	if !strings.Contains(childRule, "/") {
		return ipAllowedByAllowlist(childRule, parentRules)
	}
	_, childNet, err := net.ParseCIDR(childRule)
	if err != nil {
		return false
	}
	onesChild, _ := childNet.Mask.Size()
	for _, parentRule := range parentRules {
		if !strings.Contains(parentRule, "/") {
			continue
		}
		_, parentNet, err := net.ParseCIDR(parentRule)
		if err != nil {
			continue
		}
		onesParent, _ := parentNet.Mask.Size()
		if onesChild >= onesParent && parentNet.Contains(childNet.IP) {
			return true
		}
	}
	return false
}

type idempotencyResponseRecorder struct {
	header     http.Header
	statusCode int
	body       bytes.Buffer
	wroteHead  bool
}

func (r *idempotencyResponseRecorder) Header() http.Header {
	return r.header
}

func (r *idempotencyResponseRecorder) WriteHeader(code int) {
	if !r.wroteHead {
		r.statusCode = code
		r.wroteHead = true
	}
}

func (r *idempotencyResponseRecorder) Write(p []byte) (int, error) {
	if !r.wroteHead {
		r.statusCode = http.StatusOK
		r.wroteHead = true
	}
	return r.body.Write(p)
}

func (cfg *ApiConfig) withV1Idempotency(next authedHandler) authedHandler {
	return func(w http.ResponseWriter, r *http.Request, user database.User) {
		idemKey := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
		if idemKey == "" {
			next(w, r, user)
			return
		}
		if len(idemKey) > 128 {
			respondWithV1ErrorCode(w, r, http.StatusBadRequest, "bad_request", "Idempotency-Key must be 128 characters or fewer")
			return
		}

		bodyBytes, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
		if err != nil {
			respondWithV1Error(w, r, http.StatusBadRequest, "Could not read request body")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

		h := sha256.New()
		h.Write([]byte(r.Method))
		h.Write([]byte("\n"))
		h.Write([]byte(r.URL.Path))
		h.Write([]byte("\n"))
		h.Write(bodyBytes)
		reqHash := hex.EncodeToString(h.Sum(nil))

		keyScope := "user:" + user.ID.String()
		if actor, ok := actorFromContext(r.Context()); ok && actor != nil && actor.KeyID != nil {
			keyScope = "key:" + actor.KeyID.String()
		}

		existing, err := cfg.dbQueries.GetAgentIdempotencyRecord(r.Context(), database.GetAgentIdempotencyRecordParams{
			KeyScope:       keyScope,
			IdempotencyKey: idemKey,
		})
		if err == nil {
			if existing.RequestHash != reqHash {
				respondWithV1ErrorCode(w, r, http.StatusConflict, "idempotency_conflict", "Idempotency-Key was already used with a different request")
				return
			}
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Idempotency-Replayed", "true")
			w.WriteHeader(int(existing.StatusCode))
			_, _ = w.Write(existing.ResponseBody)
			return
		}
		if !errors.Is(err, sql.ErrNoRows) {
			next(w, r, user)
			return
		}

		rec := &idempotencyResponseRecorder{
			header:     make(http.Header),
			statusCode: http.StatusOK,
		}
		next(rec, r, user)

		for k, vals := range rec.header {
			for _, v := range vals {
				w.Header().Add(k, v)
			}
		}

		rawResp := rec.body.Bytes()
		if rec.statusCode >= 200 && rec.statusCode < 300 && json.Valid(rawResp) {
			_ = cfg.dbQueries.UpsertAgentIdempotencyRecord(r.Context(), database.UpsertAgentIdempotencyRecordParams{
				KeyScope:       keyScope,
				IdempotencyKey: idemKey,
				RequestHash:    reqHash,
				StatusCode:     int32(rec.statusCode),
				ResponseBody:   json.RawMessage(rawResp),
				ExpiresAt:      time.Now().UTC().Add(24 * time.Hour),
			})
		}

		w.WriteHeader(rec.statusCode)
		_, _ = w.Write(rawResp)
	}
}
