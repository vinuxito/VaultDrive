package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func buildV1TestMux(cfg *ApiConfig) *http.ServeMux {
	mux := http.NewServeMux()
	mux.Handle("GET /api/v1/auth/introspect", cfg.middlewareActor()(cfg.handlerAgentAuthIntrospect))
	mux.Handle("GET /api/v1/agent-keys", cfg.middlewareActor("api_keys:read")(cfg.handlerListAgentAPIKeys))
	mux.Handle("POST /api/v1/agent-keys", cfg.middlewareActor("api_keys:write")(cfg.withV1Idempotency(cfg.handlerCreateAgentAPIKey)))
	mux.Handle("DELETE /api/v1/agent-keys/{id}", cfg.middlewareActor("api_keys:write")(cfg.handlerRevokeAgentAPIKey))

	mux.Handle("GET /api/v1/folders", cfg.middlewareActor("folders:read")(cfg.handlerV1ListFolders))
	mux.Handle("POST /api/v1/folders", cfg.middlewareActor("folders:write")(cfg.withV1Idempotency(cfg.handlerV1CreateFolder)))
	mux.Handle("PUT /api/v1/folders/{id}", cfg.middlewareActor("folders:write")(cfg.withV1Idempotency(cfg.handlerV1UpdateFolder)))
	mux.Handle("DELETE /api/v1/folders/{id}", cfg.middlewareActor(scopeFilesSoftDelete)(cfg.handlerV1DeleteFolder))
	mux.Handle("GET /api/v1/folders/shared", cfg.middlewareActor("folders:read")(cfg.wrapV1JSON(cfg.handleListSharedFolders)))
	mux.Handle("GET /api/v1/folders/{id}/files", cfg.middlewareActor("files:list")(cfg.wrapV1JSON(cfg.handleListFolderFiles)))
	mux.Handle("POST /api/folders/{id}/shares", cfg.middlewareAuth(cfg.handleCreateFolderShare))
	mux.Handle("POST /api/v1/folders/{folderId}/share-link", cfg.middlewareActor("shares:create")(cfg.withV1Idempotency(cfg.wrapV1JSON(cfg.handlerCreateFolderShareLink))))
	mux.Handle("GET /api/v1/folders/{folderId}/share-links", cfg.middlewareActor("shares:list")(cfg.wrapV1JSON(cfg.handlerListFolderShareLinks)))
	mux.Handle("DELETE /api/v1/folder-share-links/{linkId}", cfg.middlewareActor("shares:revoke")(cfg.wrapV1JSON(cfg.handlerRevokeFolderShareLink)))

	mux.Handle("POST /api/v1/files/upload", cfg.middlewareActor("files:upload_ciphertext")(cfg.handlerV1CreateFile))
	mux.Handle("GET /api/v1/files", cfg.middlewareActor("files:list")(cfg.handlerV1ListFiles))
	mux.Handle("GET /api/v1/files/shared", cfg.middlewareActor("files:list")(cfg.handlerV1ListSharedFiles))
	mux.Handle("GET /api/v1/files/{id}", cfg.middlewareActor("files:read_metadata")(cfg.handlerV1GetFileMetadata))
	mux.Handle("GET /api/v1/files/{id}/download", cfg.middlewareActor("files:download_ciphertext")(cfg.handlerV1DownloadFile))
	mux.Handle("DELETE /api/v1/files/{id}", cfg.middlewareActor(scopeFilesSoftDelete)(cfg.handlerV1DeleteFile))
	mux.Handle("PUT /api/v1/files/{id}/folder", cfg.middlewareActor("folders:write")(cfg.withV1Idempotency(cfg.wrapV1JSON(cfg.handlerMoveFileToFolder))))
	mux.Handle("POST /api/v1/files/{id}/move", cfg.middlewareActor("folders:write")(cfg.withV1Idempotency(cfg.wrapV1JSON(cfg.handlerMoveFileToFolder))))
	mux.Handle("POST /api/v1/files/sync", cfg.middlewareActor()(cfg.withV1Idempotency(cfg.wrapV1ForAgentKey(cfg.handlerV1FilesSync))))

	mux.Handle("GET /api/v1/files/{id}/shares", cfg.middlewareActor("shares:list")(cfg.wrapV1JSON(cfg.handlerListFileSharesWithUser)))
	mux.Handle("DELETE /api/v1/files/{id}/revoke/{user_id}", cfg.middlewareActor("shares:revoke")(cfg.wrapV1JSON(cfg.handlerRevokeFileAccessWithUser)))
	mux.Handle("GET /api/v1/shares", cfg.middlewareActor("shares:list")(cfg.wrapV1ForAgentKey(cfg.handlerListShares)))
	mux.Handle("POST /api/v1/files/{fileId}/share-link", cfg.middlewareActor("shares:create")(cfg.withV1Idempotency(cfg.wrapV1JSON(cfg.handlerCreatePublicShareLink))))
	mux.HandleFunc("GET /api/public-share/{token}", cfg.handlerGetPublicShareLinkInfo)

	mux.Handle("POST /api/v1/drop/create", cfg.middlewareActor("requests:create")(cfg.withV1Idempotency(cfg.wrapV1JSON(cfg.handlerCreateDropTokenWithUser))))
	mux.Handle("GET /api/v1/drop/tokens", cfg.middlewareActor("requests:list")(cfg.wrapV1JSON(cfg.handlerListDropTokensWithUser)))
	mux.Handle("GET /api/v1/collection-templates", cfg.middlewareActor("requests:list")(cfg.wrapV1ForAgentKey(cfg.handlerListCollectionTemplates)))

	mux.Handle("GET /api/v1/governance/settings", cfg.middlewareAuth(cfg.handlerGetGovernanceSettings))
	mux.Handle("PUT /api/v1/governance/settings", cfg.middlewareAuth(cfg.handlerUpdateGovernanceSettings))

	mux.Handle("GET /api/trash", cfg.middlewareAuth(cfg.handlerListTrash))
	mux.Handle("POST /api/trash/files/{id}/restore", cfg.middlewareAuth(cfg.handlerRestoreTrashedFile))
	mux.Handle("POST /api/trash/folders/{id}/restore", cfg.middlewareAuth(cfg.handlerRestoreTrashedFolder))
	mux.Handle("DELETE /api/trash/files/{id}", cfg.middlewareAuth(cfg.handlerPurgeTrashedFile))
	mux.Handle("DELETE /api/trash/folders/{id}", cfg.middlewareAuth(cfg.handlerPurgeTrashedFolder))
	return mux
}

func doJSONReq(t *testing.T, handler http.Handler, method, path, bearer string, payload interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var bodyReader *bytes.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		bodyReader = bytes.NewReader(raw)
	} else {
		bodyReader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestSpecialDeleteOnlyKeyAndHumanOnlyTrashLifecycle(t *testing.T) {
	cfg := openV1CryptoTestCfg(t)
	owner, priv := insertRSAUser(t, cfg, "trash_owner")
	jwtToken, err := auth.MakeJWT(owner.ID, cfg.jwtSecret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	mux := buildV1TestMux(cfg)

	stdKey, _ := mintRawAgentKey(t, cfg, owner.ID, "std-automation", []string{
		"api_keys:read", "api_keys:write",
		"files:list", "files:read_metadata", "files:upload_ciphertext", "files:download_ciphertext", "files:write",
		"folders:read", "folders:write", "shares:create", "shares:list", "shares:revoke",
	})

	// 1. Standard key CANNOT carry files:soft_delete, delete_only CANNOT carry other scopes
	badStd := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", jwtToken, map[string]interface{}{
		"name":   "sneaky-std",
		"scopes": []string{"files:list", "files:soft_delete"},
	})
	if badStd.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 rejecting files:soft_delete on standard key, got %d body=%s", badStd.Code, badStd.Body.String())
	}
	badDel := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", jwtToken, map[string]interface{}{
		"name":     "bloated-del",
		"key_kind": "delete_only",
		"scopes":   []string{"files:soft_delete", "files:list"},
	})
	if badDel.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 rejecting extra scopes on delete_only key, got %d body=%s", badDel.Code, badDel.Body.String())
	}

	// 2. Standard agent key CANNOT mint a Special Delete-Only key
	agentMintDel := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", stdKey, map[string]interface{}{
		"name":     "escalated-del",
		"key_kind": "delete_only",
	})
	if agentMintDel.Code != http.StatusForbidden {
		t.Fatalf("expected 403 preventing agent from minting delete_only key, got %d", agentMintDel.Code)
	}

	// 3. Human JWT mints a Special Delete-Only key
	delResp := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", jwtToken, map[string]interface{}{
		"name":     "cfdi-cleaner",
		"key_kind": "delete_only",
	})
	if delResp.Code != http.StatusCreated {
		t.Fatalf("mint delete_only failed: %d %s", delResp.Code, delResp.Body.String())
	}
	delEnv := assertV1Envelope(t, delResp.Body.Bytes(), true)
	delData := delEnv["data"].(map[string]interface{})
	delKeyID := delData["id"].(string)
	delPlaintext := delData["plaintext_key"].(string)
	if !bytes.HasPrefix([]byte(delPlaintext), []byte("abrnak_del_")) || delData["key_kind"] != "delete_only" {
		t.Fatalf("unexpected delete_only response: %#v", delData)
	}

	// Standard agent key CANNOT revoke the Special Delete-Only key either
	agentRevokeDel := doJSONReq(t, mux, http.MethodDelete, "/api/v1/agent-keys/"+delKeyID, stdKey, nil)
	if agentRevokeDel.Code != http.StatusForbidden {
		t.Fatalf("expected 403 preventing agent from revoking delete_only key, got %d", agentRevokeDel.Code)
	}

	// 4. Create FolderA -> SubfolderB and upload files + public link
	folderARec := doJSONReq(t, mux, http.MethodPost, "/api/v1/folders", stdKey, map[string]string{"name": "FolderA"})
	folderAID := assertV1Envelope(t, folderARec.Body.Bytes(), true)["data"].(map[string]interface{})["id"].(string)
	folderBRec := doJSONReq(t, mux, http.MethodPost, "/api/v1/folders", stdKey, map[string]string{"name": "SubB", "parentId": folderAID})
	folderBID := assertV1Envelope(t, folderBRec.Body.Bytes(), true)["data"].(map[string]interface{})["id"].(string)

	rootCipher := []byte("ciphertext-root-doc-bytes-12345")
	rootFileID := uploadRSAFileViaV1(t, cfg, mux, stdKey, &priv.PublicKey, "", "root-doc.pdf", rootCipher)
	nestedCipher := []byte("ciphertext-nested-doc-bytes-999")
	nestedFileID := uploadRSAFileViaV1(t, cfg, mux, stdKey, &priv.PublicKey, folderBID, "nested-invoice.xml", nestedCipher)

	shareCreateRec := doJSONReq(t, mux, http.MethodPost, "/api/v1/files/"+rootFileID+"/share-link", stdKey, map[string]interface{}{})
	if shareCreateRec.Code != http.StatusCreated && shareCreateRec.Code != http.StatusOK {
		t.Fatalf("create share link failed: %d %s", shareCreateRec.Code, shareCreateRec.Body.String())
	}
	shareToken := assertV1Envelope(t, shareCreateRec.Body.Bytes(), true)["data"].(map[string]interface{})["token"].(string)

	// 5. Standard key is STRICTLY DENIED on all delete vectors
	if r := doJSONReq(t, mux, http.MethodDelete, "/api/v1/files/"+rootFileID, stdKey, nil); r.Code != http.StatusForbidden ||
		assertV1Envelope(t, r.Body.Bytes(), false)["error"].(map[string]interface{})["code"] != "delete_key_required" {
		t.Fatalf("expected 403 delete_key_required on DELETE file with standard key, got %d %s", r.Code, r.Body.String())
	}
	if r := doJSONReq(t, mux, http.MethodDelete, "/api/v1/folders/"+folderAID, stdKey, nil); r.Code != http.StatusForbidden ||
		assertV1Envelope(t, r.Body.Bytes(), false)["error"].(map[string]interface{})["code"] != "delete_key_required" {
		t.Fatalf("expected 403 delete_key_required on DELETE folder with standard key, got %d %s", r.Code, r.Body.String())
	}
	syncDelStd := doJSONReq(t, mux, http.MethodPost, "/api/v1/files/sync", stdKey, map[string]interface{}{
		"actions": []map[string]interface{}{{"action_id": uuid.NewString(), "type": "delete", "file_id": rootFileID, "parent_hash": ""}},
	})
	if syncDelStd.Code != http.StatusForbidden {
		t.Fatalf("expected 403 delete_key_required on sync delete with standard key, got %d %s", syncDelStd.Code, syncDelStd.Body.String())
	}

	// 6. Delete-only key is STRICTLY ISOLATED (introspect allowed; read/list/upload/download/sync-rename/trash forbidden)
	introRec := doJSONReq(t, mux, http.MethodGet, "/api/v1/auth/introspect", delPlaintext, nil)
	if introRec.Code != http.StatusOK || assertV1Envelope(t, introRec.Body.Bytes(), true)["data"].(map[string]interface{})["key_kind"] != "delete_only" {
		t.Fatalf("delete_only introspect failed: %d %s", introRec.Code, introRec.Body.String())
	}
	for _, blocked := range []struct{ method, path string }{
		{http.MethodGet, "/api/v1/files"},
		{http.MethodGet, "/api/v1/files/" + rootFileID},
		{http.MethodGet, "/api/v1/files/" + rootFileID + "/download"},
		{http.MethodGet, "/api/v1/folders"},
		{http.MethodGet, "/api/trash"},
		{http.MethodPost, "/api/v1/agent-keys"},
	} {
		rec := doJSONReq(t, mux, blocked.method, blocked.path, delPlaintext, nil)
		if rec.Code != http.StatusForbidden {
			t.Fatalf("delete_only should be 403 on %s %s, got %d %s", blocked.method, blocked.path, rec.Code, rec.Body.String())
		}
	}
	delSyncRename := doJSONReq(t, mux, http.MethodPost, "/api/v1/files/sync", delPlaintext, map[string]interface{}{
		"actions": []map[string]interface{}{{"action_id": uuid.NewString(), "type": "rename", "file_id": rootFileID, "filename": "x.pdf", "new_hash": "h2"}},
	})
	if delSyncRename.Code != http.StatusForbidden {
		t.Fatalf("delete_only must fail on sync rename, got %d", delSyncRename.Code)
	}

	// Grab exact file paths on disk before soft-delete to prove ZERO disk purge happens!
	rootDBFile, err := cfg.dbQueries.GetFileByID(context.Background(), uuid.MustParse(rootFileID))
	if err != nil {
		t.Fatal(err)
	}
	nestedDBFile, err := cfg.dbQueries.GetFileByID(context.Background(), uuid.MustParse(nestedFileID))
	if err != nil {
		t.Fatal(err)
	}
	rootDiskPath, _ := resolveStoredFilePath(rootDBFile.FilePath)
	nestedDiskPath, _ := resolveStoredFilePath(nestedDBFile.FilePath)

	// 7. Special Delete-Only key soft-deletes rootFile and FolderA subtree
	softFileRec := doJSONReq(t, mux, http.MethodDelete, "/api/v1/files/"+rootFileID, delPlaintext, map[string]string{
		"reason": "Limpieza CFDI duplicado",
	})
	if softFileRec.Code != http.StatusOK {
		t.Fatalf("soft-delete file failed: %d %s", softFileRec.Code, softFileRec.Body.String())
	}
	softFolderRec := doJSONReq(t, mux, http.MethodDelete, "/api/v1/folders/"+folderAID+"?reason=Archivado%20trimestral", delPlaintext, nil)
	if softFolderRec.Code != http.StatusOK {
		t.Fatalf("soft-delete folder failed: %d %s", softFolderRec.Code, softFolderRec.Body.String())
	}

	// Disk ciphertext MUST still exist intact!
	if _, err := os.Stat(rootDiskPath); err != nil {
		t.Fatalf("soft-delete must NEVER unlink ciphertext on disk: %v", err)
	}
	if _, err := os.Stat(nestedDiskPath); err != nil {
		t.Fatalf("folder soft-delete must NEVER unlink ciphertext on disk: %v", err)
	}

	// Active endpoints MUST exclude trashed files & folders, and public share links return 404
	activeFiles := assertV1Envelope(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/files", stdKey, nil).Body.Bytes(), true)["data"].([]interface{})
	if len(activeFiles) != 0 {
		t.Fatalf("expected 0 active files after soft-delete, got %d", len(activeFiles))
	}
	activeFolders := assertV1Envelope(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/folders", stdKey, nil).Body.Bytes(), true)["data"].([]interface{})
	if len(activeFolders) != 0 {
		t.Fatalf("expected 0 active folders after soft-delete, got %d", len(activeFolders))
	}
	if pub := doJSONReq(t, mux, http.MethodGet, "/api/public-share/"+shareToken, "", nil); pub.Code != http.StatusNotFound {
		t.Fatalf("expected 404 on public share link of trashed file, got %d %s", pub.Code, pub.Body.String())
	}

	// 8. Human JWT lists Trash and sees key name + reason attribution
	trashRec := doJSONReq(t, mux, http.MethodGet, "/api/trash", jwtToken, nil)
	if trashRec.Code != http.StatusOK {
		t.Fatalf("GET /api/trash failed: %d %s", trashRec.Code, trashRec.Body.String())
	}
	var trashPayload struct {
		Files []struct {
			ID                 string `json:"id"`
			DeletedByKeyName   string `json:"deleted_by_key_name"`
			DeletedByActorType string `json:"deleted_by_actor_type"`
			DeletedReason      string `json:"deleted_reason"`
		} `json:"files"`
		Folders []struct {
			ID            string `json:"id"`
			DeletedReason string `json:"deleted_reason"`
		} `json:"folders"`
	}
	if err := json.Unmarshal(trashRec.Body.Bytes(), &trashPayload); err != nil {
		t.Fatal(err)
	}
	if len(trashPayload.Files) != 2 || len(trashPayload.Folders) != 2 {
		t.Fatalf("expected 2 trashed files & 2 trashed folders, got %+v", trashPayload)
	}
	if trashPayload.Files[0].DeletedByKeyName != "cfdi-cleaner" {
		t.Fatalf("expected deleted_by_key_name cfdi-cleaner, got %+v", trashPayload.Files)
	}

	// 9. Human JWT restores root file (public share link revives!) & tests orphan-safe single file restore from trashed FolderB
	if r := doJSONReq(t, mux, http.MethodPost, "/api/trash/files/"+rootFileID+"/restore", jwtToken, nil); r.Code != http.StatusOK {
		t.Fatalf("restore root file failed: %d %s", r.Code, r.Body.String())
	}
	if pub := doJSONReq(t, mux, http.MethodGet, "/api/public-share/"+shareToken, "", nil); pub.Code != http.StatusOK {
		t.Fatalf("expected restored file's public share link to return 200, got %d", pub.Code)
	}
	// Restore nested file while FolderB is still trashed -> should cleanly unparent to folder_id = null!
	restNested := doJSONReq(t, mux, http.MethodPost, "/api/trash/files/"+nestedFileID+"/restore", jwtToken, nil)
	if restNested.Code != http.StatusOK {
		t.Fatalf("restore nested file failed: %d %s", restNested.Code, restNested.Body.String())
	}
	var restNestedBody map[string]interface{}
	_ = json.Unmarshal(restNested.Body.Bytes(), &restNestedBody)
	if restNestedBody["folder_id"] != nil {
		t.Fatalf("expected orphan-safe restore to root (folder_id nil), got %#v", restNestedBody["folder_id"])
	}

	// Download restored nested file and verify full ciphertext roundtrip is intact!
	dlRec := doJSONReq(t, mux, http.MethodGet, "/api/v1/files/"+nestedFileID+"/download", stdKey, nil)
	if dlRec.Code != http.StatusOK {
		t.Fatalf("download restored file failed: %d %s", dlRec.Code, dlRec.Body.String())
	}
	if dlRec.Header().Get("X-Wrapped-Key") == "" || !bytes.Equal(dlRec.Body.Bytes(), nestedCipher) {
		t.Fatalf("restored ciphertext mismatch: len=%d", dlRec.Body.Len())
	}
	_, _ = rsa.DecryptOAEP(sha256.New(), rand.Reader, priv, func() []byte {
		b, _ := base64.StdEncoding.DecodeString(dlRec.Header().Get("X-Wrapped-Key"))
		return b
	}(), nil)

	// 10. Restore FolderA tree, soft-delete again via sync delete using abrnak_del_, then Human Permanent Purge removes disk blob!
	if r := doJSONReq(t, mux, http.MethodPost, "/api/trash/folders/"+folderAID+"/restore", jwtToken, nil); r.Code != http.StatusOK {
		t.Fatalf("restore folder subtree failed: %d %s", r.Code, r.Body.String())
	}
	activeFoldersAfter := assertV1Envelope(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/folders", stdKey, nil).Body.Bytes(), true)["data"].([]interface{})
	if len(activeFoldersAfter) != 2 {
		t.Fatalf("expected 2 restored folders, got %d", len(activeFoldersAfter))
	}

	syncDelGood := doJSONReq(t, mux, http.MethodPost, "/api/v1/files/sync", delPlaintext, map[string]interface{}{
		"actions": []map[string]interface{}{{"action_id": uuid.NewString(), "type": "delete", "file_id": rootFileID, "parent_hash": ""}},
	})
	if syncDelGood.Code != http.StatusOK {
		t.Fatalf("expected delete_only sync delete to succeed recoverably, got %d %s", syncDelGood.Code, syncDelGood.Body.String())
	}
	if _, err := os.Stat(rootDiskPath); err != nil {
		t.Fatalf("sync delete must stay recoverable in Trash (disk intact): %v", err)
	}

	// Permanent human purge on rootFileID and FolderA removes DB row & disk ciphertext!
	if r := doJSONReq(t, mux, http.MethodDelete, "/api/trash/files/"+rootFileID, jwtToken, nil); r.Code != http.StatusOK {
		t.Fatalf("permanent purge file failed: %d %s", r.Code, r.Body.String())
	}
	if _, err := os.Stat(rootDiskPath); !os.IsNotExist(err) {
		t.Fatalf("expected disk ciphertext to be permanently unlinked after human purge, err=%v", err)
	}
	// Trash delete FolderA after soft-deleting it again
	_ = doJSONReq(t, mux, http.MethodDelete, "/api/v1/folders/"+folderAID, delPlaintext, nil)
	if r := doJSONReq(t, mux, http.MethodDelete, "/api/trash/folders/"+folderAID, jwtToken, nil); r.Code != http.StatusOK {
		t.Fatalf("permanent purge folder failed: %d %s", r.Code, r.Body.String())
	}
}

func TestGovernanceJWTOnlyAndDataPlaneV1Routes(t *testing.T) {
	cfg := openV1CryptoTestCfg(t)
	owner, ownerPriv := insertRSAUser(t, cfg, "dp_owner")
	collab, _ := insertRSAUser(t, cfg, "dp_collab")
	ownerJWT, _ := auth.MakeJWT(owner.ID, cfg.jwtSecret, time.Hour)
	collabJWT, _ := auth.MakeJWT(collab.ID, cfg.jwtSecret, time.Hour)
	mux := buildV1TestMux(cfg)

	ownerKey, _ := mintRawAgentKey(t, cfg, owner.ID, "dp-agent", []string{
		"files:list", "files:read_metadata", "files:upload_ciphertext", "files:download_ciphertext", "files:write",
		"folders:read", "folders:write", "shares:create", "shares:list", "shares:revoke",
		"requests:create", "requests:list",
	})
	collabKey, _ := mintRawAgentKey(t, cfg, collab.ID, "collab-agent", []string{"folders:read", "files:list"})
	delKeyResp := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", ownerJWT, map[string]interface{}{
		"name":     "dp-del",
		"key_kind": "delete_only",
	})
	delPlaintext := assertV1Envelope(t, delKeyResp.Body.Bytes(), true)["data"].(map[string]interface{})["plaintext_key"].(string)

	// 1. Governance strictly JWT-only
	if r := doJSONReq(t, mux, http.MethodGet, "/api/v1/governance/settings", ownerKey, nil); r.Code != http.StatusForbidden {
		t.Fatalf("governance must reject standard agent key with 403, got %d %s", r.Code, r.Body.String())
	}
	if r := doJSONReq(t, mux, http.MethodPut, "/api/v1/governance/settings", delPlaintext, map[string]interface{}{}); r.Code != http.StatusForbidden {
		t.Fatalf("governance PUT must reject delete_only key with 403, got %d", r.Code)
	}
	if r := doJSONReq(t, mux, http.MethodGet, "/api/v1/governance/settings", ownerJWT, nil); r.Code != http.StatusOK {
		t.Fatalf("governance GET must allow human JWT, got %d %s", r.Code, r.Body.String())
	}

	// 2. Folder creation + shared folder collaboration
	f1Rec := doJSONReq(t, mux, http.MethodPost, "/api/v1/folders", ownerKey, map[string]string{"name": "Clientes"})
	f1ID := assertV1Envelope(t, f1Rec.Body.Bytes(), true)["data"].(map[string]interface{})["id"].(string)
	f2Rec := doJSONReq(t, mux, http.MethodPost, "/api/v1/folders", ownerKey, map[string]string{"name": "Archivo"})
	f2ID := assertV1Envelope(t, f2Rec.Body.Bytes(), true)["data"].(map[string]interface{})["id"].(string)

	_ = doJSONReq(t, mux, http.MethodPost, "/api/folders/"+f1ID+"/shares", ownerJWT, map[string]interface{}{
		"user_id":     collab.ID.String(),
		"wrapped_key": "collab-wrapped-folder-key",
	})
	sharedFoldersRec := doJSONReq(t, mux, http.MethodGet, "/api/v1/folders/shared", collabKey, nil)
	if sharedFoldersRec.Code != http.StatusOK || len(assertV1Envelope(t, sharedFoldersRec.Body.Bytes(), true)["data"].([]interface{})) != 1 {
		t.Fatalf("GET /api/v1/folders/shared failed: %d %s", sharedFoldersRec.Code, sharedFoldersRec.Body.String())
	}

	// 3. Upload 2 files (one in Clientes, one in root), filter /v1/files, move between folders, list folder files
	fileID1 := uploadRSAFileViaV1(t, cfg, mux, ownerKey, &ownerPriv.PublicKey, f1ID, "alpha-report.pdf", []byte("alpha"))
	_ = uploadRSAFileViaV1(t, cfg, mux, ownerKey, &ownerPriv.PublicKey, "", "beta-root.txt", []byte("beta"))

	listFiltered := doJSONReq(t, mux, http.MethodGet, "/api/v1/files?folder_id="+f1ID+"&search=alpha&limit=10&offset=0", ownerKey, nil)
	listEnv := assertV1Envelope(t, listFiltered.Body.Bytes(), true)
	items := listEnv["data"].([]interface{})
	if len(items) != 1 || items[0].(map[string]interface{})["folder_id"] != f1ID {
		t.Fatalf("filtered /api/v1/files mismatch: %s", listFiltered.Body.String())
	}

	collabFolderFiles := doJSONReq(t, mux, http.MethodGet, "/api/v1/folders/"+f1ID+"/files", collabKey, nil)
	if collabFolderFiles.Code != http.StatusOK || len(assertV1Envelope(t, collabFolderFiles.Body.Bytes(), true)["data"].([]interface{})) != 1 {
		t.Fatalf("collab folder files failed: %d %s", collabFolderFiles.Code, collabFolderFiles.Body.String())
	}

	moveRec := doJSONReq(t, mux, http.MethodPost, "/api/v1/files/"+fileID1+"/move", ownerKey, map[string]string{
		"folder_id":       f2ID,
		"new_wrapped_key": base64.StdEncoding.EncodeToString([]byte("rewrapped-for-f2")),
	})
	if moveRec.Code != http.StatusOK || assertV1Envelope(t, moveRec.Body.Bytes(), true)["data"].(map[string]interface{})["folder_id"] != f2ID {
		t.Fatalf("move failed: %d %s", moveRec.Code, moveRec.Body.String())
	}

	// 4. Folder share links + unified /api/v1/shares + file shares/revoke + drop tokens + collection templates + sync rename
	fLinkCreate := doJSONReq(t, mux, http.MethodPost, "/api/v1/folders/"+f2ID+"/share-link", ownerKey, map[string]interface{}{
		"wrapped_keys":             map[string]string{fileID1: "link-wrapped-dek"},
		"owner_wrapped_folder_key": "owner-wrapped-folder-key",
	})
	if fLinkCreate.Code != http.StatusCreated && fLinkCreate.Code != http.StatusOK {
		t.Fatalf("create folder share-link failed: %d %s", fLinkCreate.Code, fLinkCreate.Body.String())
	}
	fLinkID := assertV1Envelope(t, fLinkCreate.Body.Bytes(), true)["data"].(map[string]interface{})["id"].(string)
	if r := doJSONReq(t, mux, http.MethodGet, "/api/v1/folders/"+f2ID+"/share-links", ownerKey, nil); r.Code != http.StatusOK {
		t.Fatalf("list folder share-links failed: %d", r.Code)
	}
	if r := doJSONReq(t, mux, http.MethodDelete, "/api/v1/folder-share-links/"+fLinkID, ownerKey, nil); r.Code != http.StatusOK {
		t.Fatalf("revoke folder share-link failed: %d %s", r.Code, r.Body.String())
	}

	// Shares adapter: array for JWT, V1Response for agent key
	sharesJWT := doJSONReq(t, mux, http.MethodGet, "/api/v1/shares", ownerJWT, nil)
	if sharesJWT.Code != http.StatusOK || !bytes.HasPrefix(bytes.TrimSpace(sharesJWT.Body.Bytes()), []byte("[")) {
		t.Fatalf("expected raw array on /api/v1/shares for JWT, got %s", sharesJWT.Body.String())
	}
	sharesAgent := doJSONReq(t, mux, http.MethodGet, "/api/v1/shares", ownerKey, nil)
	assertV1Envelope(t, sharesAgent.Body.Bytes(), true)

	// Share file row in DB -> check list & revoke via v1
	_, _ = cfg.dbQueries.CreateShare(context.Background(), database.CreateShareParams{
		FileID:           uuid.NullUUID{UUID: uuid.MustParse(fileID1), Valid: true},
		SharedWithUserID: uuid.NullUUID{UUID: collab.ID, Valid: true},
		WrappedKey:       "collab-file-key",
		CreatedAt:        time.Now().UTC(),
	})
	_ = collabJWT
	fileSharesRec := doJSONReq(t, mux, http.MethodGet, "/api/v1/files/"+fileID1+"/shares", ownerKey, nil)
	if fileSharesRec.Code != http.StatusOK {
		t.Fatalf("GET /api/v1/files/{id}/shares failed: %d %s", fileSharesRec.Code, fileSharesRec.Body.String())
	}
	revokeFileRec := doJSONReq(t, mux, http.MethodDelete, "/api/v1/files/"+fileID1+"/revoke/"+collab.ID.String(), ownerKey, nil)
	if revokeFileRec.Code != http.StatusOK {
		t.Fatalf("DELETE /api/v1/files/{id}/revoke/{user_id} failed: %d %s", revokeFileRec.Code, revokeFileRec.Body.String())
	}

	// Drop token create without PIN as agent + list
	dropCreate := doJSONReq(t, mux, http.MethodPost, "/api/v1/drop/create", ownerKey, map[string]interface{}{
		"target_folder_id": f2ID,
		"link_name":        "Agente SAT Inbox",
	})
	if dropCreate.Code != http.StatusCreated {
		t.Fatalf("POST /api/v1/drop/create failed: %d %s", dropCreate.Code, dropCreate.Body.String())
	}
	assertV1Envelope(t, dropCreate.Body.Bytes(), true)
	if r := doJSONReq(t, mux, http.MethodGet, "/api/v1/drop/tokens", ownerKey, nil); r.Code != http.StatusOK {
		t.Fatalf("GET /api/v1/drop/tokens failed: %d", r.Code)
	} else {
		assertV1Envelope(t, r.Body.Bytes(), true)
	}

	// Collection templates list
	tmplRec := doJSONReq(t, mux, http.MethodGet, "/api/v1/collection-templates", ownerKey, nil)
	if tmplRec.Code != http.StatusOK {
		t.Fatalf("GET /api/v1/collection-templates failed: %d", tmplRec.Code)
	}
	assertV1Envelope(t, tmplRec.Body.Bytes(), true)

	// Sync rename with agent files:write
	syncRename := doJSONReq(t, mux, http.MethodPost, "/api/v1/files/sync", ownerKey, map[string]interface{}{
		"actions": []map[string]interface{}{{"action_id": uuid.NewString(), "type": "rename", "file_id": fileID1, "filename": "alpha-v2.pdf", "new_hash": "hash-v2"}},
	})
	if syncRename.Code != http.StatusOK {
		t.Fatalf("sync rename with agent files:write failed: %d %s", syncRename.Code, syncRename.Body.String())
	}
	assertV1Envelope(t, syncRename.Body.Bytes(), true)
}

func uploadRSAFileViaV1(t *testing.T, cfg *ApiConfig, mux *http.ServeMux, key string, pub *rsa.PublicKey, folderID, filename string, ciphertext []byte) string {
	t.Helper()
	rawDEK := make([]byte, 32)
	_, _ = rand.Read(rawDEK)
	wrapped, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, pub, rawDEK, nil)
	if err != nil {
		t.Fatal(err)
	}
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	_ = mw.WriteField("wrapped_key", base64.StdEncoding.EncodeToString(wrapped))
	_ = mw.WriteField("iv", base64.StdEncoding.EncodeToString(make([]byte, 12)))
	_ = mw.WriteField("algorithm", "AES-GCM")
	_ = mw.WriteField("credential_scheme", "rsa")
	if folderID != "" {
		_ = mw.WriteField("folder_id", folderID)
	}
	part, err := mw.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(ciphertext); err != nil {
		t.Fatal(err)
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/files/upload", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+key)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("upload %s failed: %d %s", filename, rec.Code, rec.Body.String())
	}
	return assertV1Envelope(t, rec.Body.Bytes(), true)["data"].(map[string]interface{})["id"].(string)
}
