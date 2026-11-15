package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/vinuxito/VaultDrive/auth"
)

func doCustomJSONReq(
	t *testing.T,
	handler http.Handler,
	method string,
	path string,
	bearer string,
	remoteAddr string,
	headers map[string]string,
	payload interface{},
) *httptest.ResponseRecorder {
	t.Helper()
	var bodyReader *bytes.Reader
	if payload != nil {
		raw, err := json.Marshal(payload)
		if err != nil {
			t.Fatalf("marshal payload: %v", err)
		}
		bodyReader = bytes.NewReader(raw)
	} else {
		bodyReader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, bodyReader)
	if remoteAddr != "" {
		req.RemoteAddr = remoteAddr
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	return rr
}

func assertV1ErrorCode(t *testing.T, rr *httptest.ResponseRecorder, expectedStatus int, expectedCode string) {
	t.Helper()
	if rr.Code != expectedStatus {
		t.Fatalf("expected HTTP %d, got %d body=%s", expectedStatus, rr.Code, rr.Body.String())
	}
	var env struct {
		Success bool `json:"success"`
		Error   struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode v1 error envelope: %v body=%s", err, rr.Body.String())
	}
	if env.Error.Code != expectedCode {
		t.Fatalf("expected error.code=%q, got %q (body=%s)", expectedCode, env.Error.Code, rr.Body.String())
	}
}

func TestFolderJailingIsolationAndSubtreeInheritance(t *testing.T) {
	cfg := openV1CryptoTestCfg(t)
	mux := buildV1TestMux(cfg)

	user, priv := insertRSAUser(t, cfg, "v28_jail")
	humanJWT, err := auth.MakeJWT(user.ID, cfg.jwtSecret, time.Hour)
	if err != nil {
		t.Fatalf("MakeJWT: %v", err)
	}

	// Create 3 folders via Human JWT:
	// - RootAllowed
	//   - SubAllowed
	// - SiblingSecret
	makeFolder := func(bearer, name, parentID string) string {
		payload := map[string]interface{}{"name": name}
		if parentID != "" {
			payload["parentId"] = parentID
		}
		rr := doJSONReq(t, mux, http.MethodPost, "/api/v1/folders", bearer, payload)
		if rr.Code != http.StatusCreated {
			t.Fatalf("create folder %s status=%d body=%s", name, rr.Code, rr.Body.String())
		}
		var resp struct {
			Data struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
			t.Fatalf("decode folder resp: %v", err)
		}
		return resp.Data.ID
	}

	rootAllowedID := makeFolder(humanJWT, "RootAllowed", "")
	subAllowedID := makeFolder(humanJWT, "SubAllowed", rootAllowedID)
	siblingSecretID := makeFolder(humanJWT, "SiblingSecret", "")

	// Upload files into root, RootAllowed, SubAllowed, and SiblingSecret using human JWT.
	rootFileID := uploadRSAFileViaV1(t, cfg, mux, humanJWT, &priv.PublicKey, "", "root.bin", []byte("root-secret"))
	allowedFileID := uploadRSAFileViaV1(t, cfg, mux, humanJWT, &priv.PublicKey, rootAllowedID, "allowed.bin", []byte("allowed-secret"))
	nestedFileID := uploadRSAFileViaV1(t, cfg, mux, humanJWT, &priv.PublicKey, subAllowedID, "nested.bin", []byte("nested-secret"))
	secretFileID := uploadRSAFileViaV1(t, cfg, mux, humanJWT, &priv.PublicKey, siblingSecretID, "secret.bin", []byte("sibling-secret"))

	// Mint folder-jailed standard agent key scoped to RootAllowed.
	createJailedKeyRR := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", humanJWT, map[string]interface{}{
		"name": "Jailed Worker",
		"scopes": []string{
			"files:list",
			"files:read_metadata",
			"files:upload_ciphertext",
			"files:download_ciphertext",
			"folders:read",
			"folders:write",
			"shares:create",
			"shares:list",
			"requests:create",
		},
		"allowed_folder_ids": []string{rootAllowedID},
	})
	if createJailedKeyRR.Code != http.StatusCreated {
		t.Fatalf("mint jailed key status=%d body=%s", createJailedKeyRR.Code, createJailedKeyRR.Body.String())
	}
	var jailedKeyResp struct {
		Data struct {
			PlaintextKey     string   `json:"plaintext_key"`
			AllowedFolderIDs []string `json:"allowed_folder_ids"`
			RateLimitRPM     int32    `json:"rate_limit_rpm"`
		} `json:"data"`
	}
	if err := json.Unmarshal(createJailedKeyRR.Body.Bytes(), &jailedKeyResp); err != nil {
		t.Fatalf("decode jailed key resp: %v", err)
	}
	jailedKey := jailedKeyResp.Data.PlaintextKey
	if len(jailedKeyResp.Data.AllowedFolderIDs) != 1 || jailedKeyResp.Data.AllowedFolderIDs[0] != rootAllowedID {
		t.Fatalf("expected allowed_folder_ids=[%s], got %+v", rootAllowedID, jailedKeyResp.Data.AllowedFolderIDs)
	}
	if jailedKeyResp.Data.RateLimitRPM != 60 {
		t.Fatalf("expected default rate_limit_rpm=60, got %d", jailedKeyResp.Data.RateLimitRPM)
	}

	// Mint folder-jailed Special Delete-Only key scoped to RootAllowed.
	delKeyRR := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", humanJWT, map[string]interface{}{
		"name":               "Jailed Cleaner",
		"key_kind":           "delete_only",
		"allowed_folder_ids": []string{rootAllowedID},
	})
	if delKeyRR.Code != http.StatusCreated {
		t.Fatalf("mint jailed delete key status=%d body=%s", delKeyRR.Code, delKeyRR.Body.String())
	}
	var delKeyResp struct {
		Data struct {
			PlaintextKey string `json:"plaintext_key"`
		} `json:"data"`
	}
	_ = json.Unmarshal(delKeyRR.Body.Bytes(), &delKeyResp)
	jailedDelKey := delKeyResp.Data.PlaintextKey

	// 1. Introspect surfaces allowed_folder_ids & rate_limit_rpm.
	introRR := doJSONReq(t, mux, http.MethodGet, "/api/v1/auth/introspect", jailedKey, nil)
	if introRR.Code != http.StatusOK {
		t.Fatalf("introspect status=%d body=%s", introRR.Code, introRR.Body.String())
	}
	var introResp struct {
		Data struct {
			AllowedFolderIDs []string `json:"allowed_folder_ids"`
			RateLimitRPM     int32    `json:"rate_limit_rpm"`
		} `json:"data"`
	}
	_ = json.Unmarshal(introRR.Body.Bytes(), &introResp)
	if len(introResp.Data.AllowedFolderIDs) != 1 || introResp.Data.AllowedFolderIDs[0] != rootAllowedID {
		t.Fatalf("introspect allowed_folder_ids mismatch: %+v", introResp.Data.AllowedFolderIDs)
	}

	// 2. GET /api/v1/folders only sees RootAllowed + SubAllowed, NEVER SiblingSecret.
	listFoldersRR := doJSONReq(t, mux, http.MethodGet, "/api/v1/folders", jailedKey, nil)
	if listFoldersRR.Code != http.StatusOK {
		t.Fatalf("list folders status=%d body=%s", listFoldersRR.Code, listFoldersRR.Body.String())
	}
	var listFoldersResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(listFoldersRR.Body.Bytes(), &listFoldersResp)
	seenFolders := map[string]bool{}
	for _, f := range listFoldersResp.Data {
		seenFolders[f.ID] = true
	}
	if !seenFolders[rootAllowedID] || !seenFolders[subAllowedID] || seenFolders[siblingSecretID] {
		t.Fatalf("folder list leaked or missed folders: %+v", seenFolders)
	}

	// 3. GET /api/v1/files only sees allowedFile + nestedFile, NEVER rootFile or secretFile.
	listFilesRR := doJSONReq(t, mux, http.MethodGet, "/api/v1/files", jailedKey, nil)
	if listFilesRR.Code != http.StatusOK {
		t.Fatalf("list files status=%d body=%s", listFilesRR.Code, listFilesRR.Body.String())
	}
	var listFilesResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(listFilesRR.Body.Bytes(), &listFilesResp)
	seenFiles := map[string]bool{}
	for _, f := range listFilesResp.Data {
		seenFiles[f.ID] = true
	}
	if !seenFiles[allowedFileID] || !seenFiles[nestedFileID] || seenFiles[rootFileID] || seenFiles[secretFileID] {
		t.Fatalf("file list violated folder jail: %+v", seenFiles)
	}

	// 4. Explicit out-of-jail folder filters -> 403 folder_scope_denied.
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/files?folder_id="+siblingSecretID, jailedKey, nil), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/files?folder_id=root", jailedKey, nil), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/folders/"+siblingSecretID+"/files", jailedKey, nil), http.StatusForbidden, "folder_scope_denied")

	// 5. Out-of-jail metadata/download -> 403 folder_scope_denied; nestedFile -> 200 OK.
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/files/"+secretFileID, jailedKey, nil), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/files/"+rootFileID, jailedKey, nil), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodGet, "/api/v1/files/"+secretFileID+"/download", jailedKey, nil), http.StatusForbidden, "folder_scope_denied")
	if rr := doJSONReq(t, mux, http.MethodGet, "/api/v1/files/"+nestedFileID, jailedKey, nil); rr.Code != http.StatusOK {
		t.Fatalf("expected nested file metadata 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	if rr := doJSONReq(t, mux, http.MethodGet, "/api/v1/files/"+nestedFileID+"/download", jailedKey, nil); rr.Code != http.StatusOK {
		t.Fatalf("expected nested file download 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	// 6. Folder create/update inside vs outside jail (including dynamic SubSubFolder inheritance & escape-to-root prevention).
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPost, "/api/v1/folders", jailedKey, map[string]string{"name": "EscapeRoot"}), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPost, "/api/v1/folders", jailedKey, map[string]string{"name": "InSibling", "parentId": siblingSecretID}), http.StatusForbidden, "folder_scope_denied")

	subSubID := makeFolder(jailedKey, "SubSubAllowed", subAllowedID)
	dynamicFileID := uploadRSAFileViaV1(t, cfg, mux, jailedKey, &priv.PublicKey, subSubID, "dynamic.bin", []byte("dynamic-subtree"))
	if dynamicFileID == "" {
		t.Fatal("expected dynamic subtree upload to succeed")
	}

	// Attempting to move SubAllowed to root (omitting parentId) or to SiblingSecret must fail with 403 folder_scope_denied.
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPut, "/api/v1/folders/"+subAllowedID, jailedKey, map[string]string{"name": "DetachAttempt"}), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPut, "/api/v1/folders/"+subAllowedID, jailedKey, map[string]string{"name": "ReparentEscape", "parentId": siblingSecretID}), http.StatusForbidden, "folder_scope_denied")
	// Renaming RootAllowed in-place (root stays root) must succeed.
	if rr := doJSONReq(t, mux, http.MethodPut, "/api/v1/folders/"+rootAllowedID, jailedKey, map[string]string{"name": "RootAllowedRenamed"}); rr.Code != http.StatusOK {
		t.Fatalf("expected renaming RootAllowed in-place to succeed, got %d body=%s", rr.Code, rr.Body.String())
	}

	// 7. Root upload or out-of-jail upload rejected at HTTP layer.
	rootUpReq := buildEncryptedUploadRequest(t, "/api/v1/files/upload", jailedKey, "badroot.bin", []byte("x"), map[string]string{
		"wrapped_key":       "d2hhdGV2ZXI=",
		"iv":                "aXY=",
		"algorithm":         "AES-GCM",
		"credential_scheme": "rsa",
	})
	rootUpRR := httptest.NewRecorder()
	mux.ServeHTTP(rootUpRR, rootUpReq)
	assertV1ErrorCode(t, rootUpRR, http.StatusForbidden, "folder_scope_denied")

	// 8. Move file out of jail or to root -> 403 folder_scope_denied; move within jail -> 200.
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPut, "/api/v1/files/"+allowedFileID+"/folder", jailedKey, map[string]string{"folder_id": siblingSecretID}), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPut, "/api/v1/files/"+allowedFileID+"/folder", jailedKey, map[string]string{"folder_id": "root"}), http.StatusForbidden, "folder_scope_denied")
	if rr := doJSONReq(t, mux, http.MethodPut, "/api/v1/files/"+allowedFileID+"/folder", jailedKey, map[string]string{"folder_id": subAllowedID}); rr.Code != http.StatusOK {
		t.Fatalf("expected move within jail to succeed, got %d body=%s", rr.Code, rr.Body.String())
	}

	// 9. Drop & Share-Link creation outside vs inside jail.
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPost, "/api/v1/drop/create", jailedKey, map[string]string{"target_folder_id": siblingSecretID, "link_name": "Bad Drop"}), http.StatusForbidden, "folder_scope_denied")
	if rr := doJSONReq(t, mux, http.MethodPost, "/api/v1/drop/create", jailedKey, map[string]string{"target_folder_id": rootAllowedID, "link_name": "Ok Drop"}); rr.Code != http.StatusCreated && rr.Code != http.StatusOK {
		t.Fatalf("expected in-jail drop create 200/201, got %d body=%s", rr.Code, rr.Body.String())
	}
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPost, "/api/v1/files/"+secretFileID+"/share-link", jailedKey, map[string]string{}), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPost, "/api/v1/folders/"+siblingSecretID+"/share-link", jailedKey, map[string]interface{}{
		"owner_wrapped_folder_key": "dGVzdA==",
		"wrapped_keys":             map[string]string{secretFileID: "dGVzdA=="},
	}), http.StatusForbidden, "folder_scope_denied")

	// 10. Jailed Special Delete-Only key cannot soft-delete outside jail, CAN soft-delete inside jail (even nested subtree).
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodDelete, "/api/v1/files/"+secretFileID, jailedDelKey, nil), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodDelete, "/api/v1/folders/"+siblingSecretID, jailedDelKey, nil), http.StatusForbidden, "folder_scope_denied")
	assertV1ErrorCode(t, doJSONReq(t, mux, http.MethodPost, "/api/v1/files/sync", jailedDelKey, map[string]interface{}{
		"actions": []map[string]string{{"type": "delete", "file_id": secretFileID}},
	}), http.StatusForbidden, "folder_scope_denied")

	if rr := doJSONReq(t, mux, http.MethodDelete, "/api/v1/files/"+nestedFileID, jailedDelKey, nil); rr.Code != http.StatusOK {
		t.Fatalf("expected jailed delete-only key to soft-delete in-subtree file, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestChildKeyGuardrailAttenuation(t *testing.T) {
	cfg := openV1CryptoTestCfg(t)
	mux := buildV1TestMux(cfg)

	user, _ := insertRSAUser(t, cfg, "v28_attenuate")
	humanJWT, err := auth.MakeJWT(user.ID, cfg.jwtSecret, time.Hour)
	if err != nil {
		t.Fatalf("MakeJWT: %v", err)
	}

	makeFolder := func(name, parentID string) string {
		payload := map[string]string{"name": name}
		if parentID != "" {
			payload["parentId"] = parentID
		}
		rr := doJSONReq(t, mux, http.MethodPost, "/api/v1/folders", humanJWT, payload)
		if rr.Code != http.StatusCreated {
			t.Fatalf("create folder status=%d body=%s", rr.Code, rr.Body.String())
		}
		var resp struct {
			Data struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		_ = json.Unmarshal(rr.Body.Bytes(), &resp)
		return resp.Data.ID
	}

	parentFolderID := makeFolder("ParentBox", "")
	subFolderID := makeFolder("SubBox", parentFolderID)
	outsideFolderID := makeFolder("OutsideBox", "")

	// Mint constrained Parent Agent Key with api_keys:write, folder jail, CIDR IP allowlist, and RPM=40.
	parentKeyRR := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", humanJWT, map[string]interface{}{
		"name":               "Parent Delegator",
		"scopes":             []string{"api_keys:write", "files:list", "folders:read"},
		"allowed_folder_ids": []string{parentFolderID},
		"allowed_ips":        []string{"10.20.0.0/16"},
		"rate_limit_rpm":     40,
	})
	if parentKeyRR.Code != http.StatusCreated {
		t.Fatalf("create parent key status=%d body=%s", parentKeyRR.Code, parentKeyRR.Body.String())
	}
	var parentResp struct {
		Data struct {
			PlaintextKey string `json:"plaintext_key"`
		} `json:"data"`
	}
	_ = json.Unmarshal(parentKeyRR.Body.Bytes(), &parentResp)
	parentKey := parentResp.Data.PlaintextKey

	// Attempting to mint a child key outside parent's folder jail -> 403 folder_scope_denied.
	badFolderChildRR := doCustomJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", parentKey, "10.20.1.9:5000", nil, map[string]interface{}{
		"name":               "Bad Folder Child",
		"scopes":             []string{"files:list"},
		"allowed_folder_ids": []string{outsideFolderID},
	})
	assertV1ErrorCode(t, badFolderChildRR, http.StatusForbidden, "folder_scope_denied")

	// Attempting to mint a child key with an IP outside parent's CIDR -> 403 ip_not_allowed.
	badIPChildRR := doCustomJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", parentKey, "10.20.1.9:5000", nil, map[string]interface{}{
		"name":        "Bad IP Child",
		"scopes":      []string{"files:list"},
		"allowed_ips": []string{"192.168.1.0/24"},
	})
	assertV1ErrorCode(t, badIPChildRR, http.StatusForbidden, "ip_not_allowed")

	// Attempting to escalate scopes beyond parent's scopes -> 403.
	badScopeChildRR := doCustomJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", parentKey, "10.20.1.9:5000", nil, map[string]interface{}{
		"name":   "Bad Scope Child",
		"scopes": []string{"files:list", "shares:create"},
	})
	if badScopeChildRR.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for escalated scope, got %d body=%s", badScopeChildRR.Code, badScopeChildRR.Body.String())
	}

	// Inheriting parent guardrails cleanly when child omits folder/IP and asks for higher RPM=100 -> clamped to 40 & inherits folder/IP!
	inheritedRR := doCustomJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", parentKey, "10.20.1.9:5000", nil, map[string]interface{}{
		"name":           "Inherited Attenuated Child",
		"scopes":         []string{"files:list"},
		"rate_limit_rpm": 100,
	})
	if inheritedRR.Code != http.StatusCreated {
		t.Fatalf("expected 201 for attenuated inherited child, got %d body=%s", inheritedRR.Code, inheritedRR.Body.String())
	}
	var inhResp struct {
		Data struct {
			AllowedFolderIDs []string `json:"allowed_folder_ids"`
			AllowedIPs       []string `json:"allowed_ips"`
			RateLimitRPM     int32    `json:"rate_limit_rpm"`
		} `json:"data"`
	}
	_ = json.Unmarshal(inheritedRR.Body.Bytes(), &inhResp)
	if len(inhResp.Data.AllowedFolderIDs) != 1 || inhResp.Data.AllowedFolderIDs[0] != parentFolderID {
		t.Fatalf("expected child to inherit parent folder jail [%s], got %+v", parentFolderID, inhResp.Data.AllowedFolderIDs)
	}
	if len(inhResp.Data.AllowedIPs) != 1 || inhResp.Data.AllowedIPs[0] != "10.20.0.0/16" {
		t.Fatalf("expected child to inherit parent IPs, got %+v", inhResp.Data.AllowedIPs)
	}
	if inhResp.Data.RateLimitRPM != 40 {
		t.Fatalf("expected child rate_limit_rpm clamped to parent's 40, got %d", inhResp.Data.RateLimitRPM)
	}

	// Narrowing folder jail to descendant SubBox & narrowing IP CIDR to 10.20.5.0/24 succeeds!
	narrowedRR := doCustomJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", parentKey, "10.20.1.9:5000", nil, map[string]interface{}{
		"name":               "Narrowed Child",
		"scopes":             []string{"files:list"},
		"allowed_folder_ids": []string{subFolderID},
		"allowed_ips":        []string{"10.20.5.0/24"},
		"rate_limit_rpm":     15,
	})
	if narrowedRR.Code != http.StatusCreated {
		t.Fatalf("expected 201 for narrowed descendant child, got %d body=%s", narrowedRR.Code, narrowedRR.Body.String())
	}
}

func TestIPAllowlistPerKeyRateLimitAndIdempotency(t *testing.T) {
	cfg := openV1CryptoTestCfg(t)
	mux := buildV1TestMux(cfg)

	user, _ := insertRSAUser(t, cfg, "v28_ip_rpm_idem")
	humanJWT, err := auth.MakeJWT(user.ID, cfg.jwtSecret, time.Hour)
	if err != nil {
		t.Fatalf("MakeJWT: %v", err)
	}

	// 1. IP/CIDR allowlist check.
	ipKeyRR := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", humanJWT, map[string]interface{}{
		"name":        "Office CIDR Key",
		"scopes":      []string{"files:list", "folders:write"},
		"allowed_ips": []string{"10.20.0.0/16"},
	})
	if ipKeyRR.Code != http.StatusCreated {
		t.Fatalf("create ip key status=%d body=%s", ipKeyRR.Code, ipKeyRR.Body.String())
	}
	var ipKeyResp struct {
		Data struct {
			PlaintextKey string `json:"plaintext_key"`
		} `json:"data"`
	}
	_ = json.Unmarshal(ipKeyRR.Body.Bytes(), &ipKeyResp)
	ipKey := ipKeyResp.Data.PlaintextKey

	if rr := doCustomJSONReq(t, mux, http.MethodGet, "/api/v1/auth/introspect", ipKey, "10.20.99.4:4321", nil, nil); rr.Code != http.StatusOK {
		t.Fatalf("expected 10.20.99.4 to pass CIDR 10.20.0.0/16, got %d body=%s", rr.Code, rr.Body.String())
	}
	assertV1ErrorCode(t, doCustomJSONReq(t, mux, http.MethodGet, "/api/v1/auth/introspect", ipKey, "203.0.113.9:4321", nil, nil), http.StatusForbidden, "ip_not_allowed")

	// 2. Per-key rate_limit_rpm check (custom RPM=2 enforces even on loopback!).
	rpmKeyRR := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", humanJWT, map[string]interface{}{
		"name":           "Slow RPM Key",
		"scopes":         []string{"files:list", "folders:write", "folders:read"},
		"rate_limit_rpm": 2,
	})
	if rpmKeyRR.Code != http.StatusCreated {
		t.Fatalf("create rpm key status=%d body=%s", rpmKeyRR.Code, rpmKeyRR.Body.String())
	}
	var rpmKeyResp struct {
		Data struct {
			PlaintextKey string `json:"plaintext_key"`
		} `json:"data"`
	}
	_ = json.Unmarshal(rpmKeyRR.Body.Bytes(), &rpmKeyResp)
	rpmKey := rpmKeyResp.Data.PlaintextKey

	if rr := doCustomJSONReq(t, mux, http.MethodGet, "/api/v1/auth/introspect", rpmKey, "127.0.0.1:4100", nil, nil); rr.Code != http.StatusOK {
		t.Fatalf("request 1 failed: %d body=%s", rr.Code, rr.Body.String())
	}
	if rr := doCustomJSONReq(t, mux, http.MethodGet, "/api/v1/auth/introspect", rpmKey, "127.0.0.1:4100", nil, nil); rr.Code != http.StatusOK {
		t.Fatalf("request 2 failed: %d body=%s", rr.Code, rr.Body.String())
	}
	rr3 := doCustomJSONReq(t, mux, http.MethodGet, "/api/v1/auth/introspect", rpmKey, "127.0.0.1:4100", nil, nil)
	assertV1ErrorCode(t, rr3, http.StatusTooManyRequests, "rate_limited")
	if rr3.Header().Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header on 429 rate_limited response")
	}

	// 3. Idempotency-Key replay & conflict protection.
	idemKeyRR := doJSONReq(t, mux, http.MethodPost, "/api/v1/agent-keys", humanJWT, map[string]interface{}{
		"name":           "Idem Key",
		"scopes":         []string{"folders:read", "folders:write"},
		"rate_limit_rpm": 60,
	})
	if idemKeyRR.Code != http.StatusCreated {
		t.Fatalf("create idem key status=%d body=%s", idemKeyRR.Code, idemKeyRR.Body.String())
	}
	var idemKeyResp struct {
		Data struct {
			PlaintextKey string `json:"plaintext_key"`
		} `json:"data"`
	}
	_ = json.Unmarshal(idemKeyRR.Body.Bytes(), &idemKeyResp)
	idemKey := idemKeyResp.Data.PlaintextKey

	headers := map[string]string{"Idempotency-Key": "idem-folder-001"}
	firstRR := doCustomJSONReq(t, mux, http.MethodPost, "/api/v1/folders", idemKey, "10.20.1.5:5000", headers, map[string]string{"name": "Idempotent Box"})
	if firstRR.Code != http.StatusCreated {
		t.Fatalf("first idem POST status=%d body=%s", firstRR.Code, firstRR.Body.String())
	}
	var firstFolder struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(firstRR.Body.Bytes(), &firstFolder)

	replayRR := doCustomJSONReq(t, mux, http.MethodPost, "/api/v1/folders", idemKey, "10.20.1.5:5000", headers, map[string]string{"name": "Idempotent Box"})
	if replayRR.Code != http.StatusCreated {
		t.Fatalf("replay idem POST status=%d body=%s", replayRR.Code, replayRR.Body.String())
	}
	if replayRR.Header().Get("X-Idempotency-Replayed") != "true" {
		t.Fatalf("expected X-Idempotency-Replayed=true header, got %q", replayRR.Header().Get("X-Idempotency-Replayed"))
	}
	var replayFolder struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	_ = json.Unmarshal(replayRR.Body.Bytes(), &replayFolder)
	if replayFolder.Data.ID != firstFolder.Data.ID {
		t.Fatalf("expected identical folder ID %s on replay, got %s", firstFolder.Data.ID, replayFolder.Data.ID)
	}

	// Ensure only ONE "Idempotent Box" exists.
	foldersRR := doJSONReq(t, mux, http.MethodGet, "/api/v1/folders", idemKey, nil)
	var foldersList struct {
		Data []struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	_ = json.Unmarshal(foldersRR.Body.Bytes(), &foldersList)
	countIdem := 0
	for _, f := range foldersList.Data {
		if f.Name == "Idempotent Box" {
			countIdem++
		}
	}
	if countIdem != 1 {
		t.Fatalf("expected exactly 1 folder named Idempotent Box after replay, got %d", countIdem)
	}

	// Mutated payload with same Idempotency-Key -> 409 idempotency_conflict.
	conflictRR := doCustomJSONReq(t, mux, http.MethodPost, "/api/v1/folders", idemKey, "10.20.1.5:5000", headers, map[string]string{"name": "Mutated Box"})
	assertV1ErrorCode(t, conflictRR, http.StatusConflict, "idempotency_conflict")
}
