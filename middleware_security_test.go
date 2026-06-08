package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMiddlewareSecurityHeaders(t *testing.T) {
	// Simple handler that returns 200
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middlewareSecurityHeaders(inner)
	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	tests := []struct {
		header string
		want   string
	}{
		{"X-Content-Type-Options", "nosniff"},
		{"X-Frame-Options", "DENY"},
		{"Referrer-Policy", "strict-origin-when-cross-origin"},
		{"X-DNS-Prefetch-Control", "off"},
	}

	for _, tt := range tests {
		got := rr.Header().Get(tt.header)
		if got != tt.want {
			t.Errorf("header %s = %q, want %q", tt.header, got, tt.want)
		}
	}

	// CSP should contain key directives
	csp := rr.Header().Get("Content-Security-Policy")
	if csp == "" {
		t.Fatal("Content-Security-Policy header missing")
	}
	for _, directive := range []string{"default-src", "script-src", "frame-ancestors 'none'"} {
		if !contains(csp, directive) {
			t.Errorf("CSP missing directive: %q", directive)
		}
	}

	// HSTS should have max-age
	hsts := rr.Header().Get("Strict-Transport-Security")
	if !contains(hsts, "max-age=") {
		t.Errorf("HSTS missing max-age: %q", hsts)
	}

	// Permissions-Policy should disable camera, microphone, geolocation
	pp := rr.Header().Get("Permissions-Policy")
	if pp == "" {
		t.Fatal("Permissions-Policy header missing")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstr(s, substr))
}

func containsSubstr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
