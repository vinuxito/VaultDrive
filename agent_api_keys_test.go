package main

import "testing"

func TestGenerateAgentAPIKeyTokenProducesPrefixAndHash(t *testing.T) {
	raw, prefix, hash, err := generateAgentAPIKeyToken()
	if err != nil {
		t.Fatalf("generateAgentAPIKeyToken returned error: %v", err)
	}
	if len(raw) < 32 {
		t.Fatalf("expected long raw key, got %q", raw)
	}
	if prefix == "" {
		t.Fatal("expected visible prefix")
	}
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}
	if hash != hashAgentAPIKey(raw) {
		t.Fatalf("expected stable hash for generated key")
	}
	if prefix == raw {
		t.Fatalf("prefix must not equal full raw key")
	}
}

func TestNormalizeAgentScopesDeduplicatesAndSorts(t *testing.T) {
	got := normalizeAgentScopes([]string{"files:list", "activity:read", "files:list", " folders:read "})
	if len(got) != 3 {
		t.Fatalf("expected 3 scopes, got %d", len(got))
	}
	if got[0] != "activity:read" || got[1] != "files:list" || got[2] != "folders:read" {
		t.Fatalf("unexpected scopes order/content: %#v", got)
	}
	if !scopeAllowed(got, "files:list") {
		t.Fatal("expected files:list to be allowed")
	}
	if scopeAllowed(got, "files:delete") {
		t.Fatal("did not expect files:delete to be allowed")
	}
}
