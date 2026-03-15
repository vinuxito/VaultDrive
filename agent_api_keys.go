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

const agentAPIKeyPrefix = "abrn_ak"

var allowedAgentScopes = []string{
	"activity:read",
	"api_keys:read",
	"api_keys:write",
	"files:download_ciphertext",
	"files:list",
	"files:read_metadata",
	"files:upload_ciphertext",
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

func generateAgentAPIKeyToken() (string, string, string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", "", fmt.Errorf("generate api key: %w", err)
	}
	raw := agentAPIKeyPrefix + "_" + base64.RawURLEncoding.EncodeToString(b)
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
