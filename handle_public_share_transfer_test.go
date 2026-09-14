package main

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func publicTransferFixture(t *testing.T, limit int32) (*ApiConfig, database.PublicShareLink, []byte) {
	t.Helper()
	if os.Getenv("DB_URL") == "" {
		t.Skip("DB_URL must explicitly select an isolated test database")
	}
	db, err := sql.Open("postgres", os.Getenv("DB_URL"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	q := database.New(db)
	id := uuid.NewString()
	user, err := q.CreateUser(context.Background(), database.CreateUserParams{
		FirstName: "Transfer", LastName: "Fixture", Username: id, Email: id + "@example.test",
		PasswordHash: "fixture", PublicKey: "fixture", PrivateKeyEncrypted: "fixture", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = db.Exec("DELETE FROM users WHERE id=$1", user.ID) })
	dir := t.TempDir()
	t.Setenv("UPLOAD_DIR", dir)
	body := []byte("synthetic ciphertext bytes for delivery accounting")
	if err := os.WriteFile(filepath.Join(dir, "cipher.bin"), body, 0600); err != nil {
		t.Fatal(err)
	}
	file, err := q.CreateFile(context.Background(), database.CreateFileParams{
		OwnerID: nullUUID(user.ID), Filename: "fixture.txt", FilePath: "cipher.bin", FileSize: int64(len(body)),
		CurrentKeyVersion: sql.NullInt32{Int32: 1, Valid: true}, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	})
	if err != nil {
		t.Fatal(err)
	}
	link, err := q.CreatePublicShareLink(context.Background(), database.CreatePublicShareLinkParams{
		FileID: file.ID, OwnerID: user.ID, Token: uuid.NewString(), MaxDownloads: limit,
	})
	if err != nil {
		t.Fatal(err)
	}
	return &ApiConfig{db: db, dbQueries: q}, link, body
}

type interruptedResponse struct {
	*httptest.ResponseRecorder
	limit     int
	short     bool
	interrupt func()
}

func (w *interruptedResponse) Write(p []byte) (int, error) {
	if w.interrupt != nil {
		w.interrupt()
	}
	n := min(w.limit, len(p))
	_, _ = w.ResponseRecorder.Write(p[:n])
	if w.short {
		return n, nil
	}
	return n, errors.New("synthetic client disconnected")
}

func TestPublicTransferRecordsActualStreamOutcome(t *testing.T) {
	for _, tc := range []struct {
		name          string
		limit         int
		short, cancel bool
	}{
		{"before bytes", 0, false, false}, {"midstream", 7, false, false},
		{"short write", 3, true, false}, {"cancelled request", 2, false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg, link, _ := publicTransferFixture(t, 1)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			req := httptest.NewRequest(http.MethodGet, "/api/share/fixture", nil).WithContext(ctx)
			req.SetPathValue("token", link.Token)
			out := &interruptedResponse{ResponseRecorder: httptest.NewRecorder(), limit: tc.limit, short: tc.short}
			if tc.cancel {
				out.interrupt = cancel
			}
			cfg.handlerGetPublicShareLinkFile(out, req)
			var completed, interrupted int
			err := cfg.db.QueryRow(`SELECT count(*) FILTER (WHERE action='file.downloaded'), count(*) FILTER (WHERE action='file.download_interrupted') FROM audit_logs WHERE resource_id=$1`, link.FileID).Scan(&completed, &interrupted)
			if err != nil {
				t.Fatal(err)
			}
			if completed != 0 || interrupted != 1 {
				t.Fatalf("completed=%d interrupted=%d; failed stream must not claim completion", completed, interrupted)
			}
			if out.Body.Len() != tc.limit {
				t.Fatalf("response appended non-ciphertext data: %q", out.Body.String())
			}
			updated, err := cfg.dbQueries.GetPublicShareLinkByToken(context.Background(), link.Token)
			if err != nil {
				t.Fatal(err)
			}
			if updated.AccessCount != 1 || updated.IsActive {
				t.Fatal("authorized fetch must consume the configured use even if interrupted")
			}
		})
	}
}

func TestPublicTransferCompletedBytesAndExhaustedRetry(t *testing.T) {
	cfg, link, body := publicTransferFixture(t, 1)
	req := httptest.NewRequest(http.MethodGet, "/api/share/fixture", nil)
	req.SetPathValue("token", link.Token)
	out := httptest.NewRecorder()
	cfg.handlerGetPublicShareLinkFile(out, req)
	if out.Code != http.StatusOK || out.Body.String() != string(body) {
		t.Fatalf("unexpected stream: %d %q", out.Code, out.Body.String())
	}
	var completed int
	if err := cfg.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE resource_id=$1 AND action='file.downloaded'`, link.FileID).Scan(&completed); err != nil {
		t.Fatal(err)
	}
	if completed != 1 {
		t.Fatalf("completed events=%d", completed)
	}
	retry := httptest.NewRecorder()
	cfg.handlerGetPublicShareLinkFile(retry, req)
	if retry.Code != http.StatusGone {
		t.Fatalf("consumed retry status=%d", retry.Code)
	}
}

func TestPublicTransferPreservesLegacyUnlimitedLimit(t *testing.T) {
	cfg, link, body := publicTransferFixture(t, -1)
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/share/fixture", nil)
		req.SetPathValue("token", link.Token)
		out := httptest.NewRecorder()
		cfg.handlerGetPublicShareLinkFile(out, req)
		if out.Code != http.StatusOK || out.Body.String() != string(body) {
			t.Fatalf("legacy nonpositive limit was unlimited: %d %s", out.Code, out.Body.String())
		}
	}
}

func TestPublicTransferConcurrentFetchesRespectOneUse(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 1)
	tx, err := cfg.db.Begin()
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`SELECT id FROM public_share_links WHERE id=$1 FOR UPDATE`, link.ID); err != nil {
		t.Fatal(err)
	}
	const requests = 8
	var wg sync.WaitGroup
	statuses := make(chan int, requests)
	for i := 0; i < requests; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodGet, "/api/share/fixture", nil)
			req.SetPathValue("token", link.Token)
			out := httptest.NewRecorder()
			cfg.handlerGetPublicShareLinkFile(out, req)
			statuses <- out.Code
		}()
	}
	// Hold the row until every contender has read the active link and reached
	// its consumption UPDATE. This proves the race, without a timing-only sleep.
	deadline := time.Now().Add(5 * time.Second)
	blocked := 0
	for time.Now().Before(deadline) {
		if err := cfg.db.QueryRow(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%UPDATE public_share_links%'`).Scan(&blocked); err != nil {
			t.Fatal(err)
		}
		if blocked >= requests {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	wg.Wait()
	close(statuses)
	if blocked < requests {
		t.Fatalf("could not establish concurrent update barrier: %d", blocked)
	}
	successes := 0
	for status := range statuses {
		if status == http.StatusOK {
			successes++
		} else if status != http.StatusGone {
			t.Errorf("unexpected competing status %d", status)
		}
	}
	updated, err := cfg.dbQueries.GetPublicShareLinkByToken(context.Background(), link.Token)
	if err != nil {
		t.Fatal(err)
	}
	if successes != 1 || updated.AccessCount != 1 {
		t.Fatalf("one-use link delivered %d successes with access_count=%d", successes, updated.AccessCount)
	}
}

func TestShareInventoryFailureIsNotEmptySuccess(t *testing.T) {
	db, err := sql.Open("postgres", "")
	if err != nil {
		t.Fatal(err)
	}
	_ = db.Close()
	cfg := &ApiConfig{db: db}
	out := httptest.NewRecorder()
	cfg.handlerListShares(out, httptest.NewRequest(http.MethodGet, "/api/v1/shares", nil), database.User{})
	if out.Code != http.StatusServiceUnavailable {
		t.Fatalf("unavailable source returned %d: %s", out.Code, out.Body.String())
	}
}

func TestInactiveShareStatusDoesNotInventClosureReason(t *testing.T) {
	if got := shareStatus(false, nil, nil, 1); got != "closed" {
		t.Fatalf("inactive reason unknown, got %q", got)
	}
}

func TestPublicShareRevokeAuthorizesAndKeepsOwnerFile(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	req := httptest.NewRequest(http.MethodDelete, "/api/share-links/fixture", nil)
	req.SetPathValue("linkId", link.ID.String())
	unowned := httptest.NewRecorder()
	cfg.handlerRevokePublicShareLink(unowned, req, database.User{ID: uuid.New()})
	if unowned.Code != http.StatusNotFound {
		t.Fatalf("unauthorized revoke falsely confirmed: %d %s", unowned.Code, unowned.Body.String())
	}
	for i := 0; i < 2; i++ {
		out := httptest.NewRecorder()
		cfg.handlerRevokePublicShareLink(out, req, database.User{ID: link.OwnerID})
		if out.Code != http.StatusOK {
			t.Fatalf("owner revoke failed: %d %s", out.Code, out.Body.String())
		}
	}
	updated, err := cfg.dbQueries.GetPublicShareLinkByToken(context.Background(), link.Token)
	if err != nil {
		t.Fatal(err)
	}
	if updated.IsActive {
		t.Fatal("link is still active")
	}
	if _, err := cfg.dbQueries.GetFileByID(context.Background(), link.FileID); err != nil {
		t.Fatalf("revoke must preserve owner file: %v", err)
	}
	var events int
	if err := cfg.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE resource_id=$1 AND action='public_share_link.revoked'`, link.ID).Scan(&events); err != nil {
		t.Fatal(err)
	}
	if events != 1 {
		t.Fatalf("repeated revoke must not invent another transition: %d events", events)
	}
}

func TestFolderShareRevokeAuthorizesAndRecordsOneTransition(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	var folderID, linkID uuid.UUID
	if err := cfg.db.QueryRow(`INSERT INTO folders (owner_id,name,created_at,updated_at) VALUES ($1,'fixture',NOW(),NOW()) RETURNING id`, link.OwnerID).Scan(&folderID); err != nil {
		t.Fatal(err)
	}
	if err := cfg.db.QueryRow(`INSERT INTO folder_share_links (folder_id,owner_id,token) VALUES ($1,$2,$3) RETURNING id`, folderID, link.OwnerID, uuid.NewString()).Scan(&linkID); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodDelete, "/api/folder-share-links/fixture", nil)
	req.SetPathValue("linkId", linkID.String())
	unowned := httptest.NewRecorder()
	cfg.handlerRevokeFolderShareLink(unowned, req, database.User{ID: uuid.New()})
	if unowned.Code != http.StatusNotFound {
		t.Fatalf("unauthorized folder revoke falsely confirmed: %d %s", unowned.Code, unowned.Body.String())
	}
	for i := 0; i < 2; i++ {
		out := httptest.NewRecorder()
		cfg.handlerRevokeFolderShareLink(out, req, database.User{ID: link.OwnerID})
		if out.Code != http.StatusOK {
			t.Fatalf("owner folder revoke failed: %d %s", out.Code, out.Body.String())
		}
	}
	var active bool
	if err := cfg.db.QueryRow(`SELECT is_active FROM folder_share_links WHERE id=$1`, linkID).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if active {
		t.Fatal("folder link is still active")
	}
	var events int
	if err := cfg.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE resource_id=$1 AND action='folder_share_link.revoked'`, linkID).Scan(&events); err != nil {
		t.Fatal(err)
	}
	if events != 1 {
		t.Fatalf("repeated folder revoke invented %d transitions", events)
	}
}
