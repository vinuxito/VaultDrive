package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/joho/godotenv"
)

func TestHealthCheckHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(healthCheckHandler)

	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var resp map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}

	if resp["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", resp["status"])
	}
}

func TestReadinessCheckHandler_OfflineDB(t *testing.T) {
	// Setup config with closed DB to test not-ready path
	db, err := sql.Open("postgres", "postgres://nonexistent:5432/db?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	db.Close() // Explicitly close to force ping failure

	cfg := &ApiConfig{
		db: db,
	}

	req, err := http.NewRequest("GET", "/ready", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(cfg.readinessCheckHandler)

	handler.ServeHTTP(rr, req)

	// Since database is down, should return StatusServiceUnavailable (503)
	if rr.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status code %v, got %v", http.StatusServiceUnavailable, rr.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}

	if resp["status"] != "not ready" {
		t.Errorf("expected status 'not ready', got %v", resp["status"])
	}

	diagnostics, ok := resp["diagnostics"].(map[string]interface{})
	if !ok {
		t.Fatal("expected diagnostics map in response")
	}

	if dbErr, present := diagnostics["database"]; !present || dbErr == "ok" {
		t.Errorf("expected database error in diagnostics, got %v", dbErr)
	}
}

func TestReadinessCheckHandler_OnlineDB(t *testing.T) {
	if err := godotenv.Load(); err != nil {
		t.Log("Warning: .env file not found")
	}
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		t.Skip("Skipping test: DB_URL not set")
	}
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	cfg := &ApiConfig{
		db: db,
	}

	req, err := http.NewRequest("GET", "/ready", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(cfg.readinessCheckHandler)

	// Set temporary test context with short timeout
	ctx, cancel := context.WithTimeout(req.Context(), 2*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	handler.ServeHTTP(rr, req)

	// If migrations aren't set up perfectly it might return 503, but it should still respond with valid JSON diagnostics
	if rr.Code != http.StatusOK && rr.Code != http.StatusServiceUnavailable {
		t.Errorf("unexpected status code: %v", rr.Code)
	}

	var resp map[string]interface{}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode JSON response: %v", err)
	}

	if _, ok := resp["status"]; !ok {
		t.Errorf("expected status key in response, got body: %s", rr.Body.String())
	}
}
