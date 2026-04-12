package main

import (
	"net"
	"net/http"
	"sync"
	"time"
)

// slidingWindow tracks request timestamps per key within a rolling window.
type slidingWindow struct {
	mu       sync.Mutex
	requests map[string][]time.Time
}

func newSlidingWindow() *slidingWindow {
	sw := &slidingWindow{
		requests: make(map[string][]time.Time),
	}
	// Periodically purge stale keys to prevent unbounded memory growth.
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			sw.purge()
		}
	}()
	return sw
}

// allow returns true if the key is within the limit for the given window duration.
func (sw *slidingWindow) allow(key string, limit int, window time.Duration) bool {
	now := time.Now()
	cutoff := now.Add(-window)

	sw.mu.Lock()
	defer sw.mu.Unlock()

	times := sw.requests[key]

	// Drop timestamps outside the window.
	valid := times[:0]
	for _, t := range times {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= limit {
		sw.requests[key] = valid
		return false
	}

	sw.requests[key] = append(valid, now)
	return true
}

func (sw *slidingWindow) purge() {
	sw.mu.Lock()
	defer sw.mu.Unlock()
	cutoff := time.Now().Add(-10 * time.Minute)
	for key, times := range sw.requests {
		valid := times[:0]
		for _, t := range times {
			if t.After(cutoff) {
				valid = append(valid, t)
			}
		}
		if len(valid) == 0 {
			delete(sw.requests, key)
		} else {
			sw.requests[key] = valid
		}
	}
}

// Global rate limiters — one per sensitive endpoint group.
var (
	loginRateLimiter  = newSlidingWindow()
	pinRateLimiter    = newSlidingWindow()
	globalRateLimiter = newSlidingWindow()
)

// isLoopbackIP returns true for 127.x.x.x and ::1, which are always local
// dev / CI traffic. Rate-limiting loopback breaks parallel E2E test suites
// running on the same machine without providing any real security benefit.
func isLoopbackIP(ip string) bool {
	// Strip port if present
	host := ip
	if h, _, err := net.SplitHostPort(ip); err == nil {
		host = h
	}
	parsed := net.ParseIP(host)
	return parsed != nil && parsed.IsLoopback()
}

// middlewareRateLimitLogin limits login attempts to 10 per minute per IP.
// Loopback addresses (127.x.x.x, ::1) are exempt for local dev and E2E tests.
func middlewareRateLimitLogin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := requestIP(r)
		if !isLoopbackIP(ip) && !loginRateLimiter.allow(ip, 10, time.Minute) {
			w.Header().Set("Retry-After", "60")
			respondWithError(w, http.StatusTooManyRequests, "Too many login attempts. Please wait before trying again.", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// middlewareRateLimitPIN limits PIN attempts to 5 per minute per IP.
// Loopback addresses (127.x.x.x, ::1) are exempt for local dev and E2E tests.
func middlewareRateLimitPIN(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := requestIP(r)
		if !isLoopbackIP(ip) && !pinRateLimiter.allow(ip, 5, time.Minute) {
			w.Header().Set("Retry-After", "60")
			respondWithError(w, http.StatusTooManyRequests, "Too many PIN attempts. Please wait before trying again.", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// middlewareRateLimit is a general-purpose rate limiter (100 req/min per IP).
func middlewareRateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := requestIP(r)
		if !globalRateLimiter.allow(ip, 100, time.Minute) {
			w.Header().Set("Retry-After", "60")
			respondWithError(w, http.StatusTooManyRequests, "Rate limit exceeded. Please slow down.", nil)
			return
		}
		next.ServeHTTP(w, r)
	})
}
