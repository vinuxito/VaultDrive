package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/vinuxito/VaultDrive/internal/database"
	_ "github.com/lib/pq"
)

func TestValidateRegisterInput(t *testing.T) {
	tests := []struct {
		name      string
		firstName string
		lastName  string
		username  string
		email     string
		password  string
		wantErr   bool
		errSubstr string
	}{
		{
			name:      "happy path",
			firstName: "Jane",
			lastName:  "Doe",
			username:  "janedoe",
			email:     "jane@example.com",
			password:  "password123",
			wantErr:   false,
		},
		{
			name:      "empty first name",
			firstName: "",
			lastName:  "Doe",
			username:  "janedoe",
			email:     "jane@example.com",
			password:  "password123",
			wantErr:   true,
			errSubstr: "first_name",
		},
		{
			name:      "empty email",
			firstName: "Jane",
			lastName:  "Doe",
			username:  "janedoe",
			email:     "",
			password:  "password123",
			wantErr:   true,
			errSubstr: "email is required",
		},
		{
			name:      "malformed email",
			firstName: "Jane",
			lastName:  "Doe",
			username:  "janedoe",
			email:     "not-an-email",
			password:  "password123",
			wantErr:   true,
			errSubstr: "valid email",
		},
		{
			name:      "password too short",
			firstName: "Jane",
			lastName:  "Doe",
			username:  "janedoe",
			email:     "jane@example.com",
			password:  "short",
			wantErr:   true,
			errSubstr: "at least",
		},
		{
			name:      "password too long",
			firstName: "Jane",
			lastName:  "Doe",
			username:  "janedoe",
			email:     "jane@example.com",
			password:  strings.Repeat("a", maxPasswordLength+1),
			wantErr:   true,
			errSubstr: "fewer",
		},
		{
			name:      "first name only whitespace",
			firstName: "   ",
			lastName:  "Doe",
			username:  "janedoe",
			email:     "jane@example.com",
			password:  "password123",
			wantErr:   true,
			errSubstr: "first_name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateRegisterInput(tt.firstName, tt.lastName, tt.username, tt.email, tt.password)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error containing %q, got nil", tt.errSubstr)
				}
				if !strings.Contains(err.Error(), tt.errSubstr) {
					t.Errorf("expected error containing %q, got %q", tt.errSubstr, err.Error())
				}
			} else if err != nil {
				t.Errorf("expected no error, got %v", err)
			}
		})
	}
}

func TestRegisterUserHandler_RejectsInvalidInput(t *testing.T) {
	if err := godotenv.Load(); err != nil {
		t.Log("Warning: .env file not found")
	}
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		t.Skip("Skipping test: DB_URL not set")
	}
	conn, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	cfg := &ApiConfig{dbQueries: database.New(conn)}

	cases := []struct {
		name       string
		body       string
		wantStatus int
	}{
		{"empty body", `{}`, http.StatusBadRequest},
		{"short password", `{"first_name":"A","last_name":"B","username":"u","email":"a@b.co","password":"short"}`, http.StatusBadRequest},
		{"bad email", `{"first_name":"A","last_name":"B","username":"u","email":"nope","password":"password123"}`, http.StatusBadRequest},
		{"malformed json", `{"email":`, http.StatusBadRequest},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest("POST", "/register", bytes.NewBufferString(tc.body))
			rr := httptest.NewRecorder()
			http.HandlerFunc(cfg.registerUserHandler).ServeHTTP(rr, req)
			if rr.Code != tc.wantStatus {
				t.Errorf("got status %d, want %d, body=%s", rr.Code, tc.wantStatus, rr.Body.String())
			}
		})
	}
}

func TestRegisterUserHandler_HappyPath(t *testing.T) {
	if err := godotenv.Load(); err != nil {
		t.Log("Warning: .env file not found")
	}
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" {
		t.Skip("Skipping test: DB_URL not set")
	}
	conn, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	queries := database.New(conn)
	cfg := &ApiConfig{dbQueries: queries}

	suffix := uuid.New().String()[:8]
	payload := map[string]string{
		"first_name": "Test",
		"last_name":  "User",
		"username":   "test_" + suffix,
		"email":      "test_" + suffix + "@example.com",
		"password":   "password123",
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "/register", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()
	http.HandlerFunc(cfg.registerUserHandler).ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("got status %d, want %d, body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	var resp struct {
		ID uuid.UUID `json:"id"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	t.Cleanup(func() {
		if err := queries.DeleteUser(context.Background(), resp.ID); err != nil {
			t.Logf("cleanup user: %v", err)
		}
	})
}
