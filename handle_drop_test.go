package main

import (
	"bytes"
	"context"
	"database/sql"
	"mime/multipart"
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

func TestHandlerDropUploadAcceptsPinWrappedTokenWithoutClientKeyMaterial(t *testing.T) {
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
	cfg := &ApiConfig{
		dbQueries: queries,
		db:        conn,
		jwtSecret: os.Getenv("JWT_SECRET"),
	}

	pin := "2468"
	pinHash, err := auth.HashPassword(pin)
	if err != nil {
		t.Fatalf("failed to hash pin: %v", err)
	}

	user, err := queries.CreateUser(context.Background(), database.CreateUserParams{
		FirstName:           "Drop",
		LastName:            "Owner",
		Username:            "dropowner_" + uuid.New().String()[:8],
		Email:               "dropowner_" + uuid.New().String()[:8] + "@example.com",
		PasswordHash:        "password-hash",
		PublicKey:           "pubkey",
		PrivateKeyEncrypted: "privkey",
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	})
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	_, err = conn.ExecContext(context.Background(), "UPDATE users SET pin_hash = $1 WHERE id = $2", pinHash, user.ID)
	if err != nil {
		t.Fatalf("failed to set user pin hash: %v", err)
	}

	folder, err := queries.CreateFolder(context.Background(), database.CreateFolderParams{
		OwnerID:   user.ID,
		Name:      "Drop Uploads",
		ParentID:  uuid.NullUUID{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})
	if err != nil {
		t.Fatalf("failed to create folder: %v", err)
	}

	pinWrappedKey, err := auth.WrapKey(pin, "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff")
	if err != nil {
		t.Fatalf("failed to wrap key: %v", err)
	}

	uploadToken, err := queries.CreateUploadToken(context.Background(), database.CreateUploadTokenParams{
		Token:          "drop_test_" + uuid.New().String()[:12],
		OwnerUserID:    user.ID,
		TargetFolderID: folder.ID,
		ExpiresAt:      sql.NullTime{Valid: true, Time: time.Now().Add(1 * time.Hour)},
		MaxFiles:       sql.NullInt32{},
		PasswordHash:   sql.NullString{},
		LinkName:       sql.NullString{String: "Smoke Drop", Valid: true},
		PinWrappedKey:  sql.NullString{String: pinWrappedKey, Valid: true},
		Description:    sql.NullString{String: "upload test", Valid: true},
	})
	if err != nil {
		t.Fatalf("failed to create upload token: %v", err)
	}

	defer func() {
		files, listErr := queries.GetFilesByOwnerID(context.Background(), uuid.NullUUID{UUID: user.ID, Valid: true})
		if listErr == nil {
			for _, file := range files {
				_ = os.Remove(file.FilePath)
				_ = queries.DeleteFile(context.Background(), file.ID)
			}
		}
		_, _ = conn.ExecContext(context.Background(), "DELETE FROM upload_tokens WHERE id = $1", uploadToken.ID)
		_, _ = conn.ExecContext(context.Background(), "DELETE FROM folders WHERE id = $1", folder.ID)
		_ = queries.DeleteUser(context.Background(), user.ID)
	}()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	writer.WriteField("iv", "iv-placeholder")
	writer.WriteField("salt", "")
	writer.WriteField("algorithm", "AES-256-GCM")
	part, err := writer.CreateFormFile("files[]", "hello.txt")
	if err != nil {
		t.Fatalf("failed to create multipart file: %v", err)
	}
	_, err = part.Write([]byte("ciphertext-placeholder"))
	if err != nil {
		t.Fatalf("failed to write multipart payload: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("failed to close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/drop/"+uploadToken.Token+"/upload", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rr := httptest.NewRecorder()

	http.HandlerFunc(cfg.handlerDropUpload).ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("handler returned wrong status code: got %v want %v body=%s", rr.Code, http.StatusCreated, rr.Body.String())
	}

	files, err := queries.GetFilesByOwnerID(context.Background(), uuid.NullUUID{UUID: user.ID, Valid: true})
	if err != nil {
		t.Fatalf("failed to list created files: %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("expected one uploaded file, got %d", len(files))
	}
}
