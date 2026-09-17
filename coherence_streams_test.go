package main

import (
	"bytes"
	"context"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func TestEveryDownloadRouteRecordsInterruptedDelivery(t *testing.T) {
	for _, route := range []string{"legacy", "v1", "folder"} {
		for _, mode := range []string{"complete", "error", "short", "cancel"} {
			t.Run(route+"/"+mode, func(t *testing.T) {
				cfg, link, body := publicTransferFixture(t, 0)
				req := httptest.NewRequest(http.MethodGet, "/synthetic", nil)
				req.SetPathValue("id", link.FileID.String())
				cfg.jwtSecret = "synthetic-stream-secret"
				token, err := auth.MakeJWT(link.OwnerID, cfg.jwtSecret, time.Hour)
				if err != nil {
					t.Fatal(err)
				}
				req.Header.Set("Authorization", "Bearer "+token)
				if route == "folder" {
					var folderID, folderLinkID uuid.UUID
					if err := cfg.db.QueryRow(`INSERT INTO folders (owner_id,name,created_at,updated_at) VALUES ($1,'fixture',NOW(),NOW()) RETURNING id`, link.OwnerID).Scan(&folderID); err != nil {
						t.Fatal(err)
					}
					if err := cfg.db.QueryRow(`INSERT INTO folder_share_links (folder_id,owner_id,token) VALUES ($1,$2,$3) RETURNING id`, folderID, link.OwnerID, token).Scan(&folderLinkID); err != nil {
						t.Fatal(err)
					}
					if _, err := cfg.db.Exec(`INSERT INTO folder_share_file_keys (folder_share_link_id,file_id,wrapped_file_key) VALUES ($1,$2,'fixture')`, folderLinkID, link.FileID); err != nil {
						t.Fatal(err)
					}
					req.SetPathValue("token", token)
					req.SetPathValue("fileId", link.FileID.String())
				}
				ctx, cancel := context.WithCancel(req.Context())
				defer cancel()
				req = req.WithContext(ctx)
				recorder := httptest.NewRecorder()
				var out http.ResponseWriter = recorder
				if mode != "complete" {
					interrupted := &interruptedResponse{ResponseRecorder: recorder, limit: 3, short: mode == "short"}
					if mode == "cancel" {
						interrupted.interrupt = cancel
					}
					out = interrupted
				}
				switch route {
				case "legacy":
					cfg.handlerDownloadFile(out, req)
				case "v1":
					cfg.handlerV1DownloadFile(out, req, database.User{ID: link.OwnerID})
				case "folder":
					cfg.handlerGetFolderShareFile(out, req)
				}
				if _, err := uuid.Parse(recorder.Result().Header.Get("X-Request-Id")); err != nil {
					t.Fatal("stream has no safe correlation ID")
				}
				var complete, interrupted int
				if err := cfg.db.QueryRow(`SELECT count(*) FILTER (WHERE action='file.downloaded'),count(*) FILTER (WHERE action='file.download_interrupted') FROM audit_logs WHERE resource_id=$1`, link.FileID).Scan(&complete, &interrupted); err != nil {
					t.Fatal(err)
				}
				if mode == "complete" {
					if complete != 1 || interrupted != 0 || recorder.Body.String() != string(body) {
						t.Fatalf("complete=%d interrupted=%d body=%q", complete, interrupted, recorder.Body.String())
					}
				} else if complete != 0 || interrupted != 1 || recorder.Body.String() != string(body[:3]) {
					t.Fatalf("complete=%d interrupted=%d; failed delivery must have one honest event, body=%q", complete, interrupted, recorder.Body.String())
				}
			})
		}
	}
}

func TestStreamAuditFailureIsVisibleWithoutCorruptingCiphertext(t *testing.T) {
	cfg, link, body := publicTransferFixture(t, 0)
	trigger := "test_stream_" + strings.ReplaceAll(link.FileID.String(), "-", "")
	_, err := cfg.db.Exec(`CREATE FUNCTION ` + trigger + `() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id='` + link.FileID.String() + `' THEN RAISE EXCEPTION 'synthetic secret database failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER ` + trigger + ` BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ` + trigger + `()`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = cfg.db.Exec(`DROP TRIGGER IF EXISTS ` + trigger + ` ON audit_logs; DROP FUNCTION IF EXISTS ` + trigger + `()`)
	})
	var output bytes.Buffer
	old := log.Writer()
	log.SetOutput(&output)
	t.Cleanup(func() { log.SetOutput(old) })
	req := httptest.NewRequest(http.MethodGet, "/synthetic", nil)
	req.SetPathValue("id", link.FileID.String())
	out := httptest.NewRecorder()
	cfg.handlerV1DownloadFile(out, req, database.User{ID: link.OwnerID})
	if out.Code != 200 || out.Body.String() != string(body) {
		t.Fatal("audit failure corrupted ciphertext response")
	}
	if !strings.Contains(output.String(), "event=audit_write_failed") || strings.Contains(output.String(), "synthetic secret database failure") {
		t.Fatalf("unsafe/missing failure classification: %s", output.String())
	}
}
