package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

func TestRevokeCancellationRollsBackMutationAndEvidence(t *testing.T) {
	cfg, link, _ := publicTransferFixture(t, 0)
	name := "cancel_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	// Pause the evidence insert only for this synthetic link. Cancellation is
	// injected after the closure UPDATE, at the formerly lossy transaction seam.
	_, err := cfg.db.Exec(`CREATE FUNCTION ` + name + `() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id='` + link.ID.String() + `'::uuid THEN PERFORM pg_sleep(10); END IF; RETURN NEW; END $$; CREATE TRIGGER ` + name + ` BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ` + name + `()`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = cfg.db.Exec(`DROP TRIGGER ` + name + ` ON audit_logs; DROP FUNCTION ` + name + `()`) })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req := httptest.NewRequest(http.MethodDelete, "/fixture", nil).WithContext(ctx)
	req.SetPathValue("linkId", link.ID.String())
	done := make(chan struct{})
	go func() {
		defer close(done)
		cfg.handlerRevokePublicShareLink(httptest.NewRecorder(), req, database.User{ID: link.OwnerID})
	}()
	sleeping := 0
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if err := cfg.db.QueryRow(`SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event='PgSleep' AND query LIKE '%INSERT INTO audit_logs%'`).Scan(&sleeping); err != nil {
			t.Fatal(err)
		}
		if sleeping > 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("cancelled mutation did not finish")
	}
	if sleeping == 0 {
		t.Fatal("did not establish cancellation after mutation and before evidence commit")
	}
	var active bool
	if err := cfg.db.QueryRow(`SELECT is_active FROM public_share_links WHERE id=$1`, link.ID).Scan(&active); err != nil {
		t.Fatal(err)
	}
	var audit, activity int
	if err := cfg.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE resource_id=$1`, link.ID).Scan(&audit); err != nil {
		t.Fatal(err)
	}
	if err := cfg.db.QueryRow(`SELECT count(*) FROM activity_log WHERE user_id=$1 AND payload->>'share_link_id'=$2`, link.OwnerID, link.ID.String()).Scan(&activity); err != nil {
		t.Fatal(err)
	}
	if !active || audit != 0 || activity != 0 {
		t.Fatalf("partial cancellation escaped transaction: active=%v audit=%d activity=%d", active, audit, activity)
	}
}
