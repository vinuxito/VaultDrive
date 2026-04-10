package main

import (
	"fmt"
	"log"
	"os"
	"strings"
)

// ProductConfig captures the per-deployment branding and base-path settings
// that differ between the upstream QuantiX Drive product and downstream
// forks like ABRN Drive. All fields are populated from environment variables
// at startup and are read-only thereafter.
type ProductConfig struct {
	// Name is the human-facing product name (e.g. "QuantiX Drive", "ABRN Drive").
	Name string
	// Slug is the kebab-case identifier used in URLs, filenames, and logs
	// (e.g. "quantix-drive", "abrn-drive"). Must not contain slashes.
	Slug string
	// BasePath is the URL prefix the SPA is served under (e.g. "/quantix/",
	// "/abrn/"). Always begins AND ends with a forward slash.
	BasePath string
	// AgentKeyPrefix is the string prefix for newly issued agent API keys
	// (e.g. "qx_ak", "abrn_ak"). Legacy prefixes are still accepted for
	// authentication; only issuance uses this value.
	AgentKeyPrefix string
	// PublicBaseURL is the canonical public URL for this deployment
	// (e.g. "https://abrndrive.filemonprime.net"). Used only for
	// informational responses; not for routing.
	PublicBaseURL string
	// CORSOrigins is the list of origins allowed by the CORS middleware.
	CORSOrigins []string
	// AdminBootstrap is an optional list of emails that should be promoted
	// to admin on server startup. Idempotent — safe to run every boot.
	AdminBootstrap []string
}

// legacyAgentAPIKeyPrefixes lists historical prefixes that existing
// production keys may start with. They are always accepted during agent
// API key authentication even when the active prefix has changed. Adding
// to this list is the correct way to retire an old prefix without
// invalidating in-flight keys.
var legacyAgentAPIKeyPrefixes = []string{"abrn_ak"}

// LoadProductConfig reads product branding and base-path settings from the
// environment. All values have QuantiX Drive defaults so an unconfigured
// deployment boots with sensible values; downstream forks override via env.
func LoadProductConfig() ProductConfig {
	cfg := ProductConfig{
		Name:           envOr("PRODUCT_NAME", "QuantiX Drive"),
		Slug:           envOr("PRODUCT_SLUG", "quantix-drive"),
		BasePath:       envOr("BASE_PATH", "/quantix/"),
		AgentKeyPrefix: envOr("AGENT_KEY_PREFIX", "qx_ak"),
		PublicBaseURL:  envOr("PUBLIC_BASE_URL", "https://app.quantixdrive.io"),
	}

	corsRaw := envOr("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8082")
	cfg.CORSOrigins = splitCSV(corsRaw)

	if admins := os.Getenv("ADMIN_BOOTSTRAP_EMAILS"); admins != "" {
		cfg.AdminBootstrap = splitCSV(admins)
	}

	if err := cfg.validate(); err != nil {
		log.Fatalf("invalid product config: %v", err)
	}
	return cfg
}

// validate enforces invariants that the rest of the server relies on. It
// fails fast at startup rather than allowing a malformed base path to
// produce silent routing bugs later.
func (p *ProductConfig) validate() error {
	if p.Name == "" {
		return fmt.Errorf("PRODUCT_NAME must not be empty")
	}
	if p.Slug == "" {
		return fmt.Errorf("PRODUCT_SLUG must not be empty")
	}
	if strings.ContainsAny(p.Slug, "/ ") {
		return fmt.Errorf("PRODUCT_SLUG must not contain slashes or spaces: %q", p.Slug)
	}
	if !strings.HasPrefix(p.BasePath, "/") || !strings.HasSuffix(p.BasePath, "/") {
		return fmt.Errorf("BASE_PATH must begin and end with '/': %q", p.BasePath)
	}
	if p.AgentKeyPrefix == "" {
		return fmt.Errorf("AGENT_KEY_PREFIX must not be empty")
	}
	if strings.Contains(p.AgentKeyPrefix, "_") {
		// Guard against double-underscore keys: the issuance path appends
		// "_" + random, so the prefix itself must not contain one.
		return fmt.Errorf("AGENT_KEY_PREFIX must not contain underscores: %q", p.AgentKeyPrefix)
	}
	if len(p.CORSOrigins) == 0 {
		return fmt.Errorf("CORS_ALLOWED_ORIGINS must list at least one origin")
	}
	return nil
}

// BasePathTrimmed returns BasePath without its trailing slash. Useful when
// concatenating to a path that already starts with one (e.g. "/drop/...").
func (p *ProductConfig) BasePathTrimmed() string {
	return strings.TrimSuffix(p.BasePath, "/")
}

// IsAgentAPIKey reports whether the given credential looks like an agent
// API key issued by this server (current prefix) or any previously active
// prefix (legacy support). Non-matching tokens are treated as JWTs.
func (p *ProductConfig) IsAgentAPIKey(credential string) bool {
	if strings.HasPrefix(credential, p.AgentKeyPrefix+"_") {
		return true
	}
	for _, legacy := range legacyAgentAPIKeyPrefixes {
		if strings.HasPrefix(credential, legacy+"_") {
			return true
		}
	}
	return false
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
