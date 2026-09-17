package main

import (
	"bytes"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestForwardedIdentityRequiresTrustedPeer(t *testing.T) {
	t.Setenv("TRUSTED_PROXY_CIDRS", "192.0.2.0/24")
	for _, tt := range []struct{ peer, chain, want string }{
		{"203.0.113.4:80", "127.0.0.1", "203.0.113.4"},
		{"127.0.0.1:80", "127.0.0.1, 203.0.113.4", "203.0.113.4"},
		{"127.0.0.1:80", "198.51.100.7, 192.0.2.4", "198.51.100.7"},
		{"127.0.0.1:80", "198.51.100.7, invalid", "unknown"},
		{"127.0.0.1:80", "", "127.0.0.1"},
		{"[2001:db8::1]:80", "127.0.0.1", "2001:db8::1"},
	} {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = tt.peer
		r.Header.Set("X-Forwarded-For", tt.chain)
		if got := requestIP(r); got != tt.want {
			t.Errorf("peer=%s chain=%s got=%s want=%s", tt.peer, tt.chain, got, tt.want)
		}
	}
	if isLoopbackIP("10.1.2.3") || isLoopbackIP("192.168.1.2") {
		t.Fatal("private clients bypass abuse limits")
	}
}

func TestPrivateClientCannotBypassLoginRateLimit(t *testing.T) {
	old := loginRateLimiter
	loginRateLimiter = &slidingWindow{requests: make(map[string][]time.Time)}
	t.Cleanup(func() { loginRateLimiter = old })
	h := middlewareRateLimitLogin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	for i := 0; i < 11; i++ {
		r := httptest.NewRequest("POST", "/api/login", nil)
		r.RemoteAddr = "10.8.1.9:1234"
		r.Header.Set("X-Forwarded-For", "127.0.0.1")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if i == 10 && (w.Code != 429 || w.Header().Get("Retry-After") == "") {
			t.Fatalf("attempt 11=%d, expected429", w.Code)
		}
	}
}

func TestOperationalLogsExcludeRequestSecrets(t *testing.T) {
	var output bytes.Buffer
	old := log.Writer()
	log.SetOutput(&output)
	t.Cleanup(func() { log.SetOutput(old) })
	cfg := &ApiConfig{}
	r := httptest.NewRequest("GET", "/api/share/secret-token?ticket=secret-ticket&email=secret@example.test", nil)
	r.Pattern = "GET /api/share/{token}"
	r.Header.Set("User-Agent", "secret-browser-agent")
	r.Header.Set("X-Request-Id", "secret@example.test")
	w := httptest.NewRecorder()
	cfg.middlewareMetricsInc(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		respondWithError(w, 503, "Service unavailable", errors.New("secret-database-password"))
	})).ServeHTTP(w, r)
	for _, secret := range []string{"secret-token", "secret-ticket", "secret@example.test", "secret-browser-agent", "secret-database-password"} {
		if strings.Contains(output.String(), secret) {
			t.Errorf("log disclosed %s", secret)
		}
	}
	id := w.Header().Get("X-Request-Id")
	if _, err := uuid.Parse(id); err != nil {
		t.Fatalf("missing safe request correlation: %q", id)
	}
	if !strings.Contains(output.String(), id) || !strings.Contains(output.String(), "503") || !strings.Contains(output.String(), "GET /api/share/{token}") {
		t.Fatalf("missing diagnostic context: %s", output.String())
	}
}

func TestRequestIDAndRecordedStatusAreStable(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Request-Id", "secret\nvalue")
	w := httptest.NewRecorder()
	id := ensureRequestID(w, r)
	if _, err := uuid.Parse(id); err != nil {
		t.Fatalf("unsafe request ID %q", id)
	}
	if again := ensureRequestID(w, r); again != id {
		t.Fatal("one request produced multiple correlation IDs")
	}
	sr := &statusRecorder{ResponseWriter: w, statusCode: 200}
	_, _ = sr.Write([]byte("started"))
	sr.WriteHeader(503)
	if sr.statusCode != 200 {
		t.Fatalf("reported status differs from actual stream status: %d", sr.statusCode)
	}
}

func TestRateLimitPurgeRespectsConfiguredWindow(t *testing.T) {
	sw := &slidingWindow{requests: map[string][]time.Time{"recovery": {time.Now().Add(-30 * time.Minute)}}}
	if sw.allow("recovery", 1, time.Hour) {
		t.Fatal("hourly limit lost existing attempt")
	}
	sw.purge()
	if sw.allow("recovery", 1, time.Hour) {
		t.Fatal("cleanup reset a still-active hourly limit")
	}
	sw.requests["recovery"] = []time.Time{time.Now().Add(-2 * time.Hour)}
	sw.purge()
	if _, exists := sw.requests["recovery"]; exists {
		t.Fatal("expired key was not reclaimed")
	}
	if !sw.allow("recovery", 1, time.Hour) {
		t.Fatal("expired limit did not reopen")
	}
}
