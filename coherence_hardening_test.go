package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

// Inject only into this fixture's resource, never another test or customer data.
func failFixtureAudit(t *testing.T, cfg *ApiConfig, resource uuid.UUID) {
	t.Helper()
	name := "coherence_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	_, err := cfg.db.Exec(`CREATE FUNCTION ` + name + `() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id = '` + resource.String() + `'::uuid THEN RAISE EXCEPTION 'synthetic audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER ` + name + ` BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ` + name + `()`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = cfg.db.Exec(`DROP TRIGGER ` + name + ` ON audit_logs; DROP FUNCTION ` + name + `()`) })
}

func TestRevokeRollsBackWhenAuditCannotCommit(t *testing.T) {
	for _, folder := range []bool{false, true} {
		t.Run(map[bool]string{false: "file", true: "folder"}[folder], func(t *testing.T) {
			cfg, link, _ := publicTransferFixture(t, 0)
			id := link.ID
			table := "public_share_links"
			if folder {
				table = "folder_share_links"
				var folderID uuid.UUID
				if err := cfg.db.QueryRow(`INSERT INTO folders (owner_id,name,created_at,updated_at) VALUES ($1,'fixture',NOW(),NOW()) RETURNING id`, link.OwnerID).Scan(&folderID); err != nil {
					t.Fatal(err)
				}
				if err := cfg.db.QueryRow(`INSERT INTO folder_share_links (folder_id,owner_id,token) VALUES ($1,$2,$3) RETURNING id`, folderID, link.OwnerID, uuid.NewString()).Scan(&id); err != nil {
					t.Fatal(err)
				}
			}
			failFixtureAudit(t, cfg, id)
			req := httptest.NewRequest(http.MethodDelete, "/fixture", nil)
			req.SetPathValue("linkId", id.String())
			out := httptest.NewRecorder()
			if folder {
				cfg.handlerRevokeFolderShareLink(out, req, database.User{ID: link.OwnerID})
			} else {
				cfg.handlerRevokePublicShareLink(out, req, database.User{ID: link.OwnerID})
			}
			var active bool
			if err := cfg.db.QueryRow(`SELECT is_active FROM `+table+` WHERE id=$1`, id).Scan(&active); err != nil {
				t.Fatal(err)
			}
			if out.Code < 500 || !active {
				t.Fatalf("audit failure must roll back closure: status=%d active=%v", out.Code, active)
			}
		})
	}
}

func TestUnavailablePublicInfoIsRetryable(t *testing.T) {
	db, err := sql.Open("postgres", "")
	if err != nil {
		t.Fatal(err)
	}
	_ = db.Close()
	cfg := &ApiConfig{db: db, dbQueries: database.New(db)}
	for _, handler := range []http.HandlerFunc{cfg.handlerGetPublicShareLinkInfo, cfg.handlerGetFolderShareInfo} {
		req := httptest.NewRequest(http.MethodGet, "/fixture", nil)
		req.SetPathValue("token", "fixture")
		out := httptest.NewRecorder()
		handler(out, req)
		if out.Code != http.StatusServiceUnavailable {
			t.Fatalf("database outage must not report missing link: %d", out.Code)
		}
	}
}

func syncRequest(t *testing.T, cfg *ApiConfig, owner uuid.UUID, actions []map[string]any) map[string]any {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"actions": actions})
	out := httptest.NewRecorder()
	cfg.handlerFilesSync(out, httptest.NewRequest(http.MethodPost, "/api/files/sync", bytes.NewReader(body)), database.User{ID: owner})
	if out.Code != 200 {
		t.Fatalf("sync HTTP %d: %s", out.Code, out.Body.String())
	}
	var result struct {
		Results []map[string]any `json:"results"`
	}
	if err := json.Unmarshal(out.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	return result.Results[0]
}

func TestOfflineActionReplayIsIdempotentAndPayloadBound(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	action := map[string]any{"action_id": uuid.NewString(), "type": "rename", "file_id": link.FileID.String(), "filename": "renamed.txt", "parent_hash": "", "new_hash": "version1"}
	for i := 0; i < 2; i++ {
		result := syncRequest(t, cfg, link.OwnerID, []map[string]any{action})
		if result["success"] != true || result["action_id"] != action["action_id"] {
			t.Fatalf("exact replay should confirm once with identity: %v", result)
		}
	}
	action["filename"] = "changed-payload.txt"
	if result := syncRequest(t, cfg, link.OwnerID, []map[string]any{action}); result["success"] == true {
		t.Fatalf("reused action id changed payload: %v", result)
	}
	action = map[string]any{"action_id": uuid.NewString(), "type": "delete", "file_id": link.FileID.String(), "parent_hash": "version1"}
	for i := 0; i < 2; i++ {
		if result := syncRequest(t, cfg, link.OwnerID, []map[string]any{action}); result["success"] != true {
			t.Fatalf("lost delete response must reconcile exact action: %v", result)
		}
	}
	var count int
	if err := cfg.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE resource_id=$1 AND action IN ('file.renamed','file.deleted')`, link.FileID).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Fatalf("expected two real mutations, got %d", count)
	}
}

func TestOfflineConcurrentRenamesHaveOneWinner(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	var wg sync.WaitGroup
	results := make(chan *httptest.ResponseRecorder, 2)
	for _, name := range []string{"a.txt", "b.txt"} {
		wg.Add(1)
		go func(name string) {
			defer wg.Done()
			body, _ := json.Marshal(map[string]any{"actions": []map[string]any{{"action_id": uuid.NewString(), "type": "rename", "file_id": link.FileID.String(), "filename": name, "parent_hash": "", "new_hash": name}}})
			out := httptest.NewRecorder()
			cfg.handlerFilesSync(out, httptest.NewRequest(http.MethodPost, "/api/files/sync", bytes.NewReader(body)), database.User{ID: link.OwnerID})
			results <- out
		}(name)
	}
	wg.Wait()
	close(results)
	successes, conflicts := 0, 0
	for out := range results {
		var payload struct {
			Results []map[string]any `json:"results"`
		}
		if out.Code != http.StatusOK {
			t.Fatalf("sync HTTP %d: %s", out.Code, out.Body.String())
		}
		if err := json.Unmarshal(out.Body.Bytes(), &payload); err != nil || len(payload.Results) != 1 {
			t.Fatalf("invalid sync outcome: %s", out.Body.String())
		}
		r := payload.Results[0]
		if r["success"] == true {
			successes++
		}
		if r["conflict"] == true {
			conflicts++
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("successes=%d conflicts=%d", successes, conflicts)
	}
}

func TestOfflineRenameAuditFailurePreservesFile(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	before, err := cfg.dbQueries.GetFileByID(context.Background(), link.FileID)
	if err != nil {
		t.Fatal(err)
	}
	failFixtureAudit(t, cfg, link.FileID)
	result := syncRequest(t, cfg, link.OwnerID, []map[string]any{{"action_id": uuid.NewString(), "type": "rename", "file_id": link.FileID.String(), "filename": "renamed.txt", "new_hash": "version1"}})
	after, err := cfg.dbQueries.GetFileByID(context.Background(), link.FileID)
	if err != nil {
		t.Fatal(err)
	}
	if result["success"] == true || before.Filename != after.Filename || before.ParentHash != after.ParentHash {
		t.Fatalf("partial mutation leaked after audit failure: %v", result)
	}
}

func TestOfflineOwnerAndInputBoundaries(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	action := map[string]any{"action_id": uuid.NewString(), "type": "rename", "file_id": link.FileID.String(), "filename": "private.txt", "new_hash": "next"}
	if result := syncRequest(t, cfg, uuid.New(), []map[string]any{action}); result["success"] == true || result["filename"] != nil {
		t.Fatalf("unowned action leaked or mutated file: %v", result)
	}
	action["filename"] = strings.Repeat("x", 256)
	if result := syncRequest(t, cfg, link.OwnerID, []map[string]any{action}); result["success"] == true {
		t.Fatal("oversize filename accepted")
	}
	for _, body := range []string{`{"actions":[]}`, `{"actions":null}`, `{"actions":[]} {}`, strings.Repeat("x", 1<<20+1)} {
		out := httptest.NewRecorder()
		cfg.handlerFilesSync(out, httptest.NewRequest(http.MethodPost, "/api/files/sync", strings.NewReader(body)), database.User{ID: link.OwnerID})
		if out.Code != http.StatusBadRequest {
			t.Fatalf("invalid body status=%d", out.Code)
		}
	}
}

func TestPublicShareExpiryIsRecheckedAfterLockWait(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	expires := time.Now().Add(time.Second)
	if _, err := cfg.db.Exec(`UPDATE public_share_links SET expires_at=$1 WHERE id=$2`, expires, link.ID); err != nil {
		t.Fatal(err)
	}
	tx, err := cfg.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`SELECT id FROM public_share_links WHERE id=$1 FOR UPDATE`, link.ID); err != nil {
		t.Fatal(err)
	}
	result := make(chan int, 1)
	go func() {
		req := httptest.NewRequest(http.MethodGet, "/fixture", nil)
		req.SetPathValue("token", link.Token)
		out := httptest.NewRecorder()
		cfg.handlerGetPublicShareLinkFile(out, req)
		result <- out.Code
	}()
	blocked := 0
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if err := cfg.db.QueryRow(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%public_share_links%'`).Scan(&blocked); err != nil {
			t.Fatal(err)
		}
		if blocked > 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if blocked == 0 {
		t.Fatal("request did not reach the claim barrier")
	}
	time.Sleep(time.Until(expires) + 20*time.Millisecond)
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	if status := <-result; status != http.StatusGone {
		t.Fatalf("expired while waiting must not deliver: %d", status)
	}
}

type failedQueryDB struct {
	*sql.DB
	failed       *sql.DB
	queryName    string
	after, calls int
}

func (db *failedQueryDB) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	if strings.Contains(query, "-- name: "+db.queryName+" ") {
		db.calls++
		if db.calls > db.after {
			return db.failed.QueryRowContext(ctx, "SELECT 1")
		}
	}
	return db.DB.QueryRowContext(ctx, query, args...)
}

func TestFolderShareDownstreamOutagesRemainRetryable(t *testing.T) {
	for _, tc := range []struct {
		name  string
		info  bool
		after int
	}{
		{"GetFolderShareFileKeyByFile", false, 0}, {"GetFileByID", false, 0}, {"GetFolderByID", true, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg, fileLink, _ := publicTransferFixture(t, 0)
			var folderID, linkID uuid.UUID
			token := uuid.NewString()
			if err := cfg.db.QueryRow(`INSERT INTO folders (owner_id,name,created_at,updated_at) VALUES ($1,'fixture',NOW(),NOW()) RETURNING id`, fileLink.OwnerID).Scan(&folderID); err != nil {
				t.Fatal(err)
			}
			if err := cfg.db.QueryRow(`INSERT INTO folder_share_links (folder_id,owner_id,token) VALUES ($1,$2,$3) RETURNING id`, folderID, fileLink.OwnerID, token).Scan(&linkID); err != nil {
				t.Fatal(err)
			}
			if _, err := cfg.db.Exec(`INSERT INTO folder_share_file_keys (folder_share_link_id,file_id,wrapped_file_key) VALUES ($1,$2,'fixture')`, linkID, fileLink.FileID); err != nil {
				t.Fatal(err)
			}
			closed, err := sql.Open("postgres", "")
			if err != nil {
				t.Fatal(err)
			}
			_ = closed.Close()
			cfg.dbQueries = database.New(&failedQueryDB{DB: cfg.db, failed: closed, queryName: tc.name, after: tc.after})
			req := httptest.NewRequest(http.MethodGet, "/fixture", nil)
			req.SetPathValue("token", token)
			req.SetPathValue("fileId", fileLink.FileID.String())
			out := httptest.NewRecorder()
			var diagnostic bytes.Buffer
			previous := log.Writer()
			log.SetOutput(&diagnostic)
			defer log.SetOutput(previous)
			if tc.info {
				cfg.handlerGetFolderShareInfo(out, req)
			} else {
				cfg.handlerGetFolderShareFile(out, req)
			}
			if out.Code != http.StatusServiceUnavailable {
				t.Fatalf("downstream outage became status %d: %s", out.Code, out.Body.String())
			}
			if !strings.Contains(diagnostic.String(), "database is closed") {
				t.Fatalf("root cause diagnostic was suppressed: %s", diagnostic.String())
			}
		})
	}
}

func TestOfflineHashesMatchDatabaseBoundary(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	for _, field := range []string{"parent_hash", "new_hash"} {
		action := map[string]any{"action_id": uuid.NewString(), "type": "rename", "file_id": link.FileID.String(), "filename": "renamed.txt", "parent_hash": "", "new_hash": "next"}
		action[field] = strings.Repeat("x", 65)
		result := syncRequest(t, cfg, link.OwnerID, []map[string]any{action})
		if result["code"] != "invalid_action" {
			t.Fatalf("oversize hash reached DB: %v", result)
		}
	}
}
