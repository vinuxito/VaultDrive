package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func assertV1Envelope(t *testing.T, body []byte, wantSuccess bool) map[string]interface{} {
	t.Helper()
	var env map[string]interface{}
	if err := json.Unmarshal(body, &env); err != nil {
		t.Fatalf("expected valid JSON v1 envelope, got error=%v body=%s", err, string(body))
	}
	gotSuccess, ok := env["success"].(bool)
	if !ok || gotSuccess != wantSuccess {
		t.Fatalf("expected success=%v, got %#v (body=%s)", wantSuccess, env["success"], string(body))
	}
	meta, ok := env["meta"].(map[string]interface{})
	if !ok || strings.TrimSpace(meta["request_id"].(string)) == "" {
		t.Fatalf("missing meta.request_id in v1 envelope: %s", string(body))
	}
	if !wantSuccess {
		errObj, ok := env["error"].(map[string]interface{})
		if !ok || strings.TrimSpace(errObj["code"].(string)) == "" || strings.TrimSpace(errObj["message"].(string)) == "" {
			t.Fatalf("expected structured error{code,message}, got %#v", env["error"])
		}
	}
	return env
}

func TestV1WireEnvelopeAdapterAndErrorCodes(t *testing.T) {
	cfg := openV1CryptoTestCfg(t)
	owner, _ := insertRSAUser(t, cfg, "wire_owner")
	readKey, _ := mintRawAgentKey(t, cfg, owner.ID, "wire-reader", []string{
		"activity:read",
		"shares:list",
		"shares:create",
		"shares:revoke",
		"requests:list",
		"requests:create",
		"requests:revoke",
		"trust:read",
	})
	tinyKey, _ := mintRawAgentKey(t, cfg, owner.ID, "wire-minimal", []string{"files:list"})

	// 1. Insufficient scope returns structured error.code = insufficient_scope
	denyReq := httptest.NewRequest(http.MethodGet, "/api/v1/activity", nil)
	denyReq.Header.Set("Authorization", "Bearer "+tinyKey)
	denyRec := httptest.NewRecorder()
	cfg.middlewareActor("activity:read")(cfg.wrapV1JSON(cfg.handlerGetActivity)).ServeHTTP(denyRec, denyReq)
	if denyRec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", denyRec.Code)
	}
	denyEnv := assertV1Envelope(t, denyRec.Body.Bytes(), false)
	if denyEnv["error"].(map[string]interface{})["code"] != "insufficient_scope" {
		t.Fatalf("expected insufficient_scope error code, got %#v", denyEnv["error"])
	}

	// 2. Wrapped /api/v1/activity returns V1Response envelope while legacy /api/activity remains raw
	actReq := httptest.NewRequest(http.MethodGet, "/api/v1/activity", nil)
	actReq.Header.Set("Authorization", "Bearer "+readKey)
	actRec := httptest.NewRecorder()
	cfg.middlewareActor("activity:read")(cfg.wrapV1JSON(cfg.handlerGetActivity)).ServeHTTP(actRec, actReq)
	if actRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on v1 activity, got %d body=%s", actRec.Code, actRec.Body.String())
	}
	assertV1Envelope(t, actRec.Body.Bytes(), true)

	// 3. Wrapped /api/v1/file-requests create + list + delete all return V1Response envelopes
	frCreateReq := httptest.NewRequest(http.MethodPost, "/api/v1/file-requests", bytes.NewReader([]byte(`{"description":"Bot docs"}`)))
	frCreateReq.Header.Set("Content-Type", "application/json")
	frCreateReq.Header.Set("Authorization", "Bearer "+readKey)
	frCreateRec := httptest.NewRecorder()
	cfg.middlewareActor("requests:create")(cfg.wrapV1JSON(cfg.handlerCreateFileRequest)).ServeHTTP(frCreateRec, frCreateReq)
	if frCreateRec.Code != http.StatusCreated && frCreateRec.Code != http.StatusOK {
		t.Fatalf("expected created on file-request, got %d body=%s", frCreateRec.Code, frCreateRec.Body.String())
	}
	createdEnv := assertV1Envelope(t, frCreateRec.Body.Bytes(), true)
	reqData, _ := createdEnv["data"].(map[string]interface{})
	createdReqID, _ := reqData["id"].(string)
	if createdReqID == "" {
		t.Fatalf("expected created request id, got %#v", createdEnv)
	}

	frListReq := httptest.NewRequest(http.MethodGet, "/api/v1/file-requests", nil)
	frListReq.Header.Set("Authorization", "Bearer "+readKey)
	frListRec := httptest.NewRecorder()
	cfg.middlewareActor("requests:list")(cfg.wrapV1JSON(cfg.handlerListFileRequests)).ServeHTTP(frListRec, frListReq)
	if frListRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on list file-requests, got %d", frListRec.Code)
	}
	assertV1Envelope(t, frListRec.Body.Bytes(), true)

	frDelReq := httptest.NewRequest(http.MethodDelete, "/api/v1/file-requests/"+createdReqID, nil)
	frDelReq.SetPathValue("id", createdReqID)
	frDelReq.Header.Set("Authorization", "Bearer "+readKey)
	frDelRec := httptest.NewRecorder()
	cfg.middlewareActor("requests:revoke")(cfg.wrapV1JSON(cfg.handlerRevokeFileRequest)).ServeHTTP(frDelRec, frDelReq)
	if frDelRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on delete file-request, got %d body=%s", frDelRec.Code, frDelRec.Body.String())
	}
	assertV1Envelope(t, frDelRec.Body.Bytes(), true)

	// 4. Wrapped missing file trust / access-summary returns structured V1 error
	missID := uuid.NewString()
	sumReq := httptest.NewRequest(http.MethodGet, "/api/v1/files/"+missID+"/access-summary", nil)
	sumReq.SetPathValue("id", missID)
	sumReq.Header.Set("Authorization", "Bearer "+readKey)
	sumRec := httptest.NewRecorder()
	cfg.middlewareActor("trust:read")(cfg.wrapV1JSON(cfg.handlerGetFileAccessSummary)).ServeHTTP(sumRec, sumReq)
	if sumRec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 on missing file access-summary, got %d body=%s", sumRec.Code, sumRec.Body.String())
	}
	sumEnv := assertV1Envelope(t, sumRec.Body.Bytes(), false)
	if sumEnv["error"].(map[string]interface{})["code"] != "not_found" {
		t.Fatalf("expected not_found error code, got %#v", sumEnv["error"])
	}
}

func TestOpenAPISpecMatchesRegisteredV1Routes(t *testing.T) {
	mainSrc, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`mux\.Handle(?:Func)?\("(GET|POST|PUT|DELETE|PATCH)\s+(/api/v1/[^"]+)"`)
	matches := re.FindAllStringSubmatch(string(mainSrc), -1)
	if len(matches) < 25 {
		t.Fatalf("expected at least 25 registered /api/v1/ routes in main.go, found %d", len(matches))
	}

	paths := buildOpenAPIV1Paths()
	registered := make(map[string]map[string]bool)
	for _, m := range matches {
		method := strings.ToLower(m[1])
		path := m[2]
		if _, ok := registered[path]; !ok {
			registered[path] = map[string]bool{}
		}
		registered[path][method] = true

		docPathRaw, ok := paths[path]
		if !ok {
			t.Errorf("registered route %s %s is missing from buildOpenAPIV1Paths()", strings.ToUpper(method), path)
			continue
		}
		docPath := docPathRaw.(map[string]interface{})
		if _, hasMethod := docPath[method]; !hasMethod {
			t.Errorf("registered method %s %s is missing in OpenAPI path item", strings.ToUpper(method), path)
		}
	}

	// Ensure OpenAPI doesn't document unregistered ghost /api/v1/ paths
	for docPath, methodsRaw := range paths {
		regMethods, ok := registered[docPath]
		if !ok {
			t.Errorf("OpenAPI documents unregistered path %s", docPath)
			continue
		}
		for method := range methodsRaw.(map[string]interface{}) {
			if !regMethods[method] {
				t.Errorf("OpenAPI documents unregistered method %s %s", strings.ToUpper(method), docPath)
			}
		}
	}

	// Also verify HTTP /docs/openapi.json handler emits valid JSON with ABRN branding
	specReq := httptest.NewRequest(http.MethodGet, "/docs/openapi.json", nil)
	specRec := httptest.NewRecorder()
	handleOpenAPISpec(specRec, specReq)
	if specRec.Code != http.StatusOK {
		t.Fatalf("openapi.json status=%d", specRec.Code)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(specRec.Body.Bytes(), &decoded); err != nil {
		t.Fatalf("invalid openapi json: %v", err)
	}
	if decoded["openapi"] != "3.0.3" {
		t.Fatalf("unexpected openapi version: %v", decoded["openapi"])
	}
}
