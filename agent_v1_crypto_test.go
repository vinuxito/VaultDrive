package main

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func openV1CryptoTestCfg(t *testing.T) *ApiConfig {
	t.Helper()
	t.Setenv("UPLOAD_DIR", t.TempDir())
	_, cfg := openCredentialTestDB(t)
	cfg.Product = LoadProductConfig()
	cfg.Product.AgentKeyPrefix = "abrnak"
	cfg.Product.BasePath = "/abrn/"
	return cfg
}

func insertRSAUser(t *testing.T, cfg *ApiConfig, label string) (database.User, *rsa.PrivateKey) {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	spkiBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	pubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: spkiBytes}))
	id := uuid.New()
	hash, err := auth.HashPassword("password-" + label)
	if err != nil {
		t.Fatal(err)
	}
	username := label + "_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:8]
	email := username + "@example.test"
	_, err = cfg.db.Exec(
		`INSERT INTO users(id, first_name, last_name, username, email, password_hash, public_key, private_key_encrypted, created_at, updated_at, kek_envelope_version)
		 VALUES($1, 'Test', 'Bot', $2, $3, $4, $5, 'enc-priv', NOW(), NOW(), 2)`,
		id, username, email, hash, pubPEM,
	)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = cfg.db.Exec(`DELETE FROM users WHERE id = $1`, id)
	})
	user, err := cfg.dbQueries.GetUserByID(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	return user, priv
}

func mintRawAgentKey(t *testing.T, cfg *ApiConfig, userID uuid.UUID, name string, scopes []string) (string, database.AgentApiKey) {
	t.Helper()
	raw, prefix, hash, err := generateAgentAPIKeyToken(cfg.Product.AgentKeyPrefix)
	if err != nil {
		t.Fatal(err)
	}
	scopesJSON, _ := json.Marshal(normalizeAgentScopes(scopes))
	rec, err := cfg.dbQueries.CreateAgentAPIKey(context.Background(), database.CreateAgentAPIKeyParams{
		UserID:              userID,
		Name:                name,
		KeyPrefix:           prefix,
		KeyHash:             hash,
		ScopesJson:          scopesJSON,
		Status:              "active",
		LastSeenContextJson: json.RawMessage(`{}`),
		KeyKind:             agentKeyKindStandard,
		RateLimitRpm:        60,
	})
	if err != nil {
		t.Fatal(err)
	}
	return raw, rec
}

func buildEncryptedUploadRequest(t *testing.T, url, bearer string, filename string, ciphertext []byte, fields map[string]string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(ciphertext); err != nil {
		t.Fatal(err)
	}
	for k, v := range fields {
		if err := mw.WriteField(k, v); err != nil {
			t.Fatal(err)
		}
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, url, &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+bearer)
	return req
}

func TestV1PublicKeyDiscoveryAndRSAOwnerUploadRoundtrip(t *testing.T) {
	cfg := openV1CryptoTestCfg(t)
	owner, ownerPriv := insertRSAUser(t, cfg, "owner")
	other, _ := insertRSAUser(t, cfg, "peer")
	agentKey, _ := mintRawAgentKey(t, cfg, owner.ID, "zk-uploader", []string{
		"files:upload_ciphertext",
		"files:download_ciphertext",
		"files:read_metadata",
	})

	// 1. Introspect exposes owner's public_key
	introReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/introspect", nil)
	introReq.Header.Set("Authorization", "Bearer "+agentKey)
	introRec := httptest.NewRecorder()
	cfg.middlewareActor()(cfg.handlerAgentAuthIntrospect).ServeHTTP(introRec, introReq)
	if introRec.Code != http.StatusOK {
		t.Fatalf("introspect status=%d body=%s", introRec.Code, introRec.Body.String())
	}
	var introPayload struct {
		Success bool           `json:"success"`
		Data    map[string]any `json:"data"`
	}
	if err := json.Unmarshal(introRec.Body.Bytes(), &introPayload); err != nil {
		t.Fatal(err)
	}
	if introPayload.Data["owner_public_key"] != owner.PublicKey {
		t.Fatalf("expected introspect owner_public_key to match owner public key")
	}
	if introPayload.Data["public_key"] != owner.PublicKey {
		t.Fatalf("expected introspect public_key to match owner public key")
	}

	// 2. GET /api/v1/users/me/public-key & GET /api/v1/users/{id}/public-key
	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/public-key", nil)
	meReq.Header.Set("Authorization", "Bearer "+agentKey)
	meRec := httptest.NewRecorder()
	cfg.middlewareActor()(cfg.handlerV1GetMyPublicKey).ServeHTTP(meRec, meReq)
	if meRec.Code != http.StatusOK {
		t.Fatalf("me public-key status=%d body=%s", meRec.Code, meRec.Body.String())
	}
	var meBody struct {
		Data struct {
			PublicKey string `json:"public_key"`
		} `json:"data"`
	}
	if err := json.Unmarshal(meRec.Body.Bytes(), &meBody); err != nil {
		t.Fatal(err)
	}
	if meBody.Data.PublicKey != owner.PublicKey {
		t.Fatalf("public key mismatch")
	}

	peerReq := httptest.NewRequest(http.MethodGet, "/api/v1/users/"+other.ID.String()+"/public-key", nil)
	peerReq.SetPathValue("id", other.ID.String())
	peerReq.Header.Set("Authorization", "Bearer "+agentKey)
	peerRec := httptest.NewRecorder()
	cfg.middlewareActor()(cfg.handlerV1GetPublicKeyByID).ServeHTTP(peerRec, peerReq)
	if peerRec.Code != http.StatusOK {
		t.Fatalf("peer public-key status=%d body=%s", peerRec.Code, peerRec.Body.String())
	}

	// 3. Create owned folder and perform client-side AES-256-GCM + RSA-OAEP encryption
	folder, err := cfg.dbQueries.CreateFolder(context.Background(), database.CreateFolderParams{
		OwnerID:   owner.ID,
		Name:      "Facturas Bot",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatal(err)
	}

	plaintext := []byte(`{"cfdi":"4.0","total":1250.50,"currency":"MXN"}`)
	dek := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, dek); err != nil {
		t.Fatal(err)
	}
	iv := make([]byte, 12)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		t.Fatal(err)
	}
	block, err := aes.NewCipher(dek)
	if err != nil {
		t.Fatal(err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}
	ciphertext := gcm.Seal(nil, iv, plaintext, nil)

	pubBlock, _ := pem.Decode([]byte(meBody.Data.PublicKey))
	pubAny, err := x509.ParsePKIXPublicKey(pubBlock.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	wrappedDEK, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, pubAny.(*rsa.PublicKey), dek, nil)
	if err != nil {
		t.Fatal(err)
	}

	// Reject incomplete RSA metadata cleanly before writing file
	badReq := buildEncryptedUploadRequest(t, "/api/v1/files/upload", agentKey, "cfdi.xml", ciphertext, map[string]string{
		"credential_scheme": "rsa",
		"wrapped_key":       base64.StdEncoding.EncodeToString(wrappedDEK),
	})
	badRec := httptest.NewRecorder()
	cfg.middlewareActor("files:upload_ciphertext")(cfg.handlerV1CreateFile).ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing iv in rsa scheme, got %d body=%s", badRec.Code, badRec.Body.String())
	}

	upReq := buildEncryptedUploadRequest(t, "/api/v1/files/upload", agentKey, "cfdi-bot.json", ciphertext, map[string]string{
		"folder_id":         folder.ID.String(),
		"credential_scheme": "rsa",
		"iv":                base64.StdEncoding.EncodeToString(iv),
		"algorithm":         "AES-GCM",
		"wrapped_key":       base64.StdEncoding.EncodeToString(wrappedDEK),
	})
	upRec := httptest.NewRecorder()
	cfg.middlewareActor("files:upload_ciphertext")(cfg.handlerV1CreateFile).ServeHTTP(upRec, upReq)
	if upRec.Code != http.StatusCreated {
		t.Fatalf("upload failed status=%d body=%s", upRec.Code, upRec.Body.String())
	}
	var upResp struct {
		Data struct {
			ID               string  `json:"id"`
			FolderID         *string `json:"folder_id"`
			CredentialScheme string  `json:"credential_scheme"`
		} `json:"data"`
	}
	if err := json.Unmarshal(upRec.Body.Bytes(), &upResp); err != nil {
		t.Fatal(err)
	}
	if upResp.Data.FolderID == nil || *upResp.Data.FolderID != folder.ID.String() {
		t.Fatalf("expected folder_id=%s, got %+v", folder.ID, upResp.Data.FolderID)
	}
	if upResp.Data.CredentialScheme != "rsa" {
		t.Fatalf("expected credential_scheme=rsa, got %q", upResp.Data.CredentialScheme)
	}

	// 4. Download ciphertext + headers and decrypt end-to-end with owner's RSA private key
	dlReq := httptest.NewRequest(http.MethodGet, "/api/v1/files/"+upResp.Data.ID+"/download", nil)
	dlReq.SetPathValue("id", upResp.Data.ID)
	dlReq.Header.Set("Authorization", "Bearer "+agentKey)
	dlRec := httptest.NewRecorder()
	cfg.middlewareActor("files:download_ciphertext")(cfg.handlerV1DownloadFile).ServeHTTP(dlRec, dlReq)
	if dlRec.Code != http.StatusOK {
		t.Fatalf("download status=%d body=%s", dlRec.Code, dlRec.Body.String())
	}
	if dlRec.Header().Get("X-Credential-Scheme") != "rsa" {
		t.Fatalf("expected X-Credential-Scheme=rsa, got %q", dlRec.Header().Get("X-Credential-Scheme"))
	}
	wrappedHdr := dlRec.Header().Get("X-Wrapped-Key")
	if wrappedHdr == "" {
		t.Fatalf("missing X-Wrapped-Key header")
	}
	wrappedBytes, err := base64.StdEncoding.DecodeString(wrappedHdr)
	if err != nil {
		t.Fatal(err)
	}
	recoveredDEK, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, ownerPriv, wrappedBytes, nil)
	if err != nil {
		t.Fatalf("rsa unwrap failed: %v", err)
	}
	var metaMap map[string]string
	if err := json.Unmarshal([]byte(dlRec.Header().Get("X-File-Metadata")), &metaMap); err != nil {
		t.Fatal(err)
	}
	recoveredIV, err := base64.StdEncoding.DecodeString(metaMap["iv"])
	if err != nil {
		t.Fatal(err)
	}
	blk2, _ := aes.NewCipher(recoveredDEK)
	gcm2, _ := cipher.NewGCM(blk2)
	recoveredPlaintext, err := gcm2.Open(nil, recoveredIV, dlRec.Body.Bytes(), nil)
	if err != nil {
		t.Fatalf("gcm decrypt failed: %v", err)
	}
	if !bytes.Equal(recoveredPlaintext, plaintext) {
		t.Fatalf("plaintext mismatch: got %q want %q", recoveredPlaintext, plaintext)
	}
}

func TestV1FolderKeyOwnerAndCollaboratorDownloadAndSharedList(t *testing.T) {
	cfg := openV1CryptoTestCfg(t)
	owner, _ := insertRSAUser(t, cfg, "folder_owner")
	collab, _ := insertRSAUser(t, cfg, "collab_bot")

	ownerKey, _ := mintRawAgentKey(t, cfg, owner.ID, "owner-agent", []string{"files:upload_ciphertext", "files:download_ciphertext"})
	collabKey, _ := mintRawAgentKey(t, cfg, collab.ID, "collab-agent", []string{"files:list", "files:download_ciphertext"})

	folder, err := cfg.dbQueries.CreateFolder(context.Background(), database.CreateFolderParams{
		OwnerID:   owner.ID,
		Name:      "Shared Desk",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatal(err)
	}

	cipherBytes := []byte("ciphertext-folder-payload")
	upReq := buildEncryptedUploadRequest(t, "/api/v1/files/upload", ownerKey, "ledger.xlsx", cipherBytes, map[string]string{
		"folder_id":         folder.ID.String(),
		"credential_scheme": "folder",
		"iv":                base64.StdEncoding.EncodeToString([]byte("123456789012")),
		"wrapped_key":       "folder-wrapped-file-key-b64",
	})
	upRec := httptest.NewRecorder()
	cfg.middlewareActor("files:upload_ciphertext")(cfg.handlerV1CreateFile).ServeHTTP(upRec, upReq)
	if upRec.Code != http.StatusCreated {
		t.Fatalf("folder upload status=%d body=%s", upRec.Code, upRec.Body.String())
	}
	var upResp struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(upRec.Body.Bytes(), &upResp)

	// 1. Owner downloads folder-scheme file and receives folder-wrapped key in X-Wrapped-Key
	ownerDlReq := httptest.NewRequest(http.MethodGet, "/api/v1/files/"+upResp.Data.ID+"/download", nil)
	ownerDlReq.SetPathValue("id", upResp.Data.ID)
	ownerDlReq.Header.Set("Authorization", "Bearer "+ownerKey)
	ownerDlRec := httptest.NewRecorder()
	cfg.middlewareActor("files:download_ciphertext")(cfg.handlerV1DownloadFile).ServeHTTP(ownerDlRec, ownerDlReq)
	if ownerDlRec.Code != http.StatusOK {
		t.Fatalf("owner folder download status=%d body=%s", ownerDlRec.Code, ownerDlRec.Body.String())
	}
	if got := ownerDlRec.Header().Get("X-Wrapped-Key"); got != "folder-wrapped-file-key-b64" {
		t.Fatalf("owner expected folder-wrapped-file-key-b64 in X-Wrapped-Key, got %q", got)
	}

	// 2. Unshared collaborator gets 403
	unauthReq := httptest.NewRequest(http.MethodGet, "/api/v1/files/"+upResp.Data.ID+"/download", nil)
	unauthReq.SetPathValue("id", upResp.Data.ID)
	unauthReq.Header.Set("Authorization", "Bearer "+collabKey)
	unauthRec := httptest.NewRecorder()
	cfg.middlewareActor("files:download_ciphertext")(cfg.handlerV1DownloadFile).ServeHTTP(unauthRec, unauthReq)
	if unauthRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 before share, got %d", unauthRec.Code)
	}

	// 3. Share folder with collaborator -> collaborator downloads & sees in GET /api/v1/files/shared
	if _, err := cfg.dbQueries.CreateFolderShare(context.Background(), database.CreateFolderShareParams{
		FolderID:   folder.ID,
		UserID:     collab.ID,
		WrappedKey: "rsa-wrapped-folder-key-for-collab",
		SharedBy:   owner.ID,
		CreatedAt:  time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}

	collabDlReq := httptest.NewRequest(http.MethodGet, "/api/v1/files/"+upResp.Data.ID+"/download", nil)
	collabDlReq.SetPathValue("id", upResp.Data.ID)
	collabDlReq.Header.Set("Authorization", "Bearer "+collabKey)
	collabDlRec := httptest.NewRecorder()
	cfg.middlewareActor("files:download_ciphertext")(cfg.handlerV1DownloadFile).ServeHTTP(collabDlRec, collabDlReq)
	if collabDlRec.Code != http.StatusOK {
		t.Fatalf("collab download status=%d body=%s", collabDlRec.Code, collabDlRec.Body.String())
	}
	if collabDlRec.Header().Get("X-Wrapped-Key") != "folder-wrapped-file-key-b64" {
		t.Fatalf("expected X-Wrapped-Key for folder file, got %q", collabDlRec.Header().Get("X-Wrapped-Key"))
	}
	if collabDlRec.Header().Get("X-Folder-Wrapped-Key") != "rsa-wrapped-folder-key-for-collab" {
		t.Fatalf("expected X-Folder-Wrapped-Key header, got %q", collabDlRec.Header().Get("X-Folder-Wrapped-Key"))
	}

	sharedReq := httptest.NewRequest(http.MethodGet, "/api/v1/files/shared", nil)
	sharedReq.Header.Set("Authorization", "Bearer "+collabKey)
	sharedRec := httptest.NewRecorder()
	cfg.middlewareActor("files:list")(cfg.handlerV1ListSharedFiles).ServeHTTP(sharedRec, sharedReq)
	if sharedRec.Code != http.StatusOK {
		t.Fatalf("shared list status=%d body=%s", sharedRec.Code, sharedRec.Body.String())
	}
	var sharedBody struct {
		Success bool `json:"success"`
		Data    []struct {
			ID               string `json:"id"`
			SharedVia        string `json:"shared_via"`
			FolderWrappedKey string `json:"folder_wrapped_key"`
		} `json:"data"`
	}
	if err := json.Unmarshal(sharedRec.Body.Bytes(), &sharedBody); err != nil {
		t.Fatal(err)
	}
	if !sharedBody.Success || len(sharedBody.Data) != 1 || sharedBody.Data[0].ID != upResp.Data.ID || sharedBody.Data[0].SharedVia != "folder" {
		t.Fatalf("unexpected shared list response: %+v", sharedBody)
	}
}
