package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
)

const (
	agentKeyKindStandard   = "standard"
	agentKeyKindDeleteOnly = "delete_only"
	scopeFilesSoftDelete   = "files:soft_delete"
)

var allowedAgentScopes = []string{
	"activity:read",
	"api_keys:read",
	"api_keys:write",
	"files:download_ciphertext",
	"files:list",
	"files:read_metadata",
	"files:soft_delete",
	"files:upload_ciphertext",
	"files:write",
	"folders:read",
	"folders:write",
	"requests:create",
	"requests:list",
	"requests:revoke",
	"shares:create",
	"shares:list",
	"shares:revoke",
	"trust:read",
}

// generateAgentAPIKeyToken mints a new agent API key using the supplied
// product prefix (e.g. "abrnak" -> "abrnak_...", or "abrnak_del" -> "abrnak_del_...").
// Legacy prefixes continue to validate via ProductConfig.IsAgentAPIKey — this
// function only governs issuance of new keys.
func generateAgentAPIKeyToken(keyPrefix string) (string, string, string, error) {
	if keyPrefix == "" {
		return "", "", "", fmt.Errorf("generate api key: empty prefix")
	}
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", "", fmt.Errorf("generate api key: %w", err)
	}
	raw := keyPrefix + "_" + base64.RawURLEncoding.EncodeToString(b)
	prefix := raw
	if len(prefix) > 18 {
		prefix = prefix[:18]
	}
	return raw, prefix, hashAgentAPIKey(raw), nil
}

func hashAgentAPIKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func normalizeAgentScopes(scopes []string) []string {
	seen := make(map[string]struct{}, len(scopes))
	normalized := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		trimmed := strings.TrimSpace(scope)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	sort.Strings(normalized)
	return normalized
}

func scopeAllowed(scopes []string, required string) bool {
	for _, scope := range scopes {
		if scope == required {
			return true
		}
	}
	return false
}

func validateAgentScopes(scopes []string) error {
	allowed := make(map[string]struct{}, len(allowedAgentScopes))
	for _, scope := range allowedAgentScopes {
		allowed[scope] = struct{}{}
	}
	for _, scope := range scopes {
		if _, ok := allowed[scope]; !ok {
			return fmt.Errorf("unsupported scope %q", scope)
		}
	}
	return nil
}

func normalizeAgentKeyConfig(rawKind string, rawScopes []string) (string, []string, error) {
	kind := strings.TrimSpace(rawKind)
	if kind == "" {
		kind = agentKeyKindStandard
	}
	scopes := normalizeAgentScopes(rawScopes)
	switch kind {
	case agentKeyKindDeleteOnly:
		if len(scopes) == 0 {
			scopes = []string{scopeFilesSoftDelete}
		}
		if len(scopes) != 1 || scopes[0] != scopeFilesSoftDelete {
			return "", nil, fmt.Errorf("delete_only keys can only carry the exclusive scope %q", scopeFilesSoftDelete)
		}
		return agentKeyKindDeleteOnly, scopes, nil
	case agentKeyKindStandard:
		if len(scopes) == 0 {
			return "", nil, fmt.Errorf("At least one scope is required")
		}
		if err := validateAgentScopes(scopes); err != nil {
			return "", nil, err
		}
		if scopeAllowed(scopes, scopeFilesSoftDelete) {
			return "", nil, fmt.Errorf("Standard agent keys cannot include %q; mint a dedicated delete_only key instead", scopeFilesSoftDelete)
		}
		return agentKeyKindStandard, scopes, nil
	default:
		return "", nil, fmt.Errorf("unsupported key_kind %q", rawKind)
	}
}
