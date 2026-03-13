package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func TestHandlerLogin(t *testing.T) {
	// Load .env
	err := godotenv.Load()
	if err != nil {
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

	// Setup ApiConfig
	cfg := &ApiConfig{
		dbQueries: queries,
		jwtSecret: os.Getenv("JWT_SECRET"),
	}

	// 1. Create a test user
	password := "password123"
	hashedPassword, err := auth.HashPassword(password)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	userParams := database.CreateUserParams{
		FirstName:           "Test",
		LastName:            "User",
		Username:            "testuser_" + uuid.New().String()[:8],
		Email:               "test_" + uuid.New().String()[:8] + "@example.com",
		PasswordHash:        hashedPassword,
		PublicKey:           "pubkey",
		PrivateKeyEncrypted: "privkey",
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}

	user, err := queries.CreateUser(context.Background(), userParams)
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	// Clean up user after test
	defer func() {
		err := queries.DeleteUser(context.Background(), user.ID)
		if err != nil {
			t.Logf("Failed to delete test user: %v", err)
		}
	}()

	// 2. Prepare Login Request
	loginPayload := map[string]string{
		"email":    userParams.Email,
		"password": password,
	}
	body, _ := json.Marshal(loginPayload)
	req, _ := http.NewRequest("POST", "/login", bytes.NewBuffer(body))
	rr := httptest.NewRecorder()

	// 3. Call Handler
	handler := http.HandlerFunc(cfg.handlerLogin)
	handler.ServeHTTP(rr, req)

	// 4. Check Response
	if rr.Code != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", rr.Code, http.StatusOK)
		t.Logf("Response body: %s", rr.Body.String())
	}

	var response struct {
		Token        string `json:"token"`
		RefreshToken string `json:"refresh_token"`
	}
	err = json.NewDecoder(rr.Body).Decode(&response)
	if err != nil {
		t.Errorf("Failed to decode response: %v", err)
	}

	if response.Token == "" {
		t.Error("Expected token in response, got empty string")
	}
	if response.RefreshToken == "" {
		t.Error("Expected refresh_token in response, got empty string")
	}
}
