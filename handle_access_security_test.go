package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type accessSecurityFixture struct {
	cfg          *ApiConfig
	owner        database.User
	recipient    database.User
	fileID       uuid.UUID
	fileLink     database.PublicShareLink
	rootID       uuid.UUID
	childID      uuid.UUID
	folderLinkID uuid.UUID
}

func newAccessSecurityFixture(t *testing.T) accessSecurityFixture {
	t.Helper()
	cfg, fileLink, _ := publicTransferFixture(t, 0)
	owner, err := cfg.dbQueries.GetUserByID(context.Background(), fileLink.OwnerID)
	if err != nil {
		t.Fatal(err)
	}
	stamp := uuid.NewString()
	recipient, err := cfg.dbQueries.CreateUser(context.Background(), database.CreateUserParams{
		FirstName: "Access", LastName: "Recipient", Username: stamp, Email: stamp + "@example.test",
		PasswordHash: "fixture", PublicKey: "fixture", PrivateKeyEncrypted: "fixture", CreatedAt: time.Now(), UpdatedAt: time.Now(),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = cfg.db.Exec("DELETE FROM users WHERE id=$1", recipient.ID) })

	var rootID, childID uuid.UUID
	if err := cfg.db.QueryRow(`INSERT INTO folders (owner_id,name,created_at,updated_at) VALUES ($1,'root',NOW(),NOW()) RETURNING id`, owner.ID).Scan(&rootID); err != nil {
		t.Fatal(err)
	}
	if err := cfg.db.QueryRow(`INSERT INTO folders (owner_id,name,parent_id,created_at,updated_at) VALUES ($1,'child',$2,NOW(),NOW()) RETURNING id`, owner.ID, rootID).Scan(&childID); err != nil {
		t.Fatal(err)
	}
	if _, err := cfg.db.Exec(`UPDATE files SET folder_id=$1 WHERE id=$2`, childID, fileLink.FileID); err != nil {
		t.Fatal(err)
	}
	if _, err := cfg.db.Exec(`INSERT INTO folder_shares (folder_id,user_id,wrapped_key,shared_by) VALUES ($1,$2,'wrapped',$3)`, childID, recipient.ID, owner.ID); err != nil {
		t.Fatal(err)
	}
	var folderLinkID uuid.UUID
	if err := cfg.db.QueryRow(`INSERT INTO folder_share_links (folder_id,owner_id,token) VALUES ($1,$2,$3) RETURNING id`, rootID, owner.ID, uuid.NewString()).Scan(&folderLinkID); err != nil {
		t.Fatal(err)
	}
	if _, err := cfg.db.Exec(`INSERT INTO folder_share_file_keys (folder_share_link_id,file_id,wrapped_file_key) VALUES ($1,$2,'wrapped')`, folderLinkID, fileLink.FileID); err != nil {
		t.Fatal(err)
	}

	return accessSecurityFixture{cfg: cfg, owner: owner, recipient: recipient, fileID: fileLink.FileID, fileLink: fileLink, rootID: rootID, childID: childID, folderLinkID: folderLinkID}
}

func accessRequest(method string, fileID uuid.UUID) *http.Request {
	req := httptest.NewRequest(method, "/api/v1/files/"+fileID.String(), nil)
	req.SetPathValue("id", fileID.String())
	return req
}

func TestAccessSummaryIncludesExactCollaboratorAndAncestorFolderLink(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	out := httptest.NewRecorder()
	fx.cfg.handlerGetFileAccessSummary(out, accessRequest(http.MethodGet, fx.fileID), fx.owner)
	if out.Code != http.StatusOK {
		t.Fatalf("access summary HTTP %d: %s", out.Code, out.Body.String())
	}
	var payload struct {
		Summary string        `json:"summary"`
		Entries []accessEntry `json:"entries"`
	}
	if err := json.Unmarshal(out.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	kinds := map[string]int{}
	for _, entry := range payload.Entries {
		kinds[entry.Kind]++
	}
	if kinds["folder_share"] != 1 || kinds["folder_link"] != 1 {
		t.Fatalf("folder routes missing from summary: %#v", payload.Entries)
	}
	if payload.Summary == "Only you" {
		t.Fatalf("external folder routes reported as private: %#v", payload)
	}
}

func TestAccessOwnerLookupOutageIsUnavailableNotForbidden(t *testing.T) {
	db, err := sql.Open("postgres", "")
	if err != nil {
		t.Fatal(err)
	}
	_ = db.Close()
	cfg := &ApiConfig{db: db, dbQueries: database.New(db)}
	out := httptest.NewRecorder()
	cfg.handlerGetFileAccessSummary(out, accessRequest(http.MethodGet, uuid.New()), database.User{ID: uuid.New()})
	if out.Code != http.StatusServiceUnavailable {
		t.Fatalf("database outage became HTTP %d: %s", out.Code, out.Body.String())
	}
}

func TestAccessMetadataOwnerLookupOutageIsUnavailableNotForbidden(t *testing.T) {
	db, err := sql.Open("postgres", "")
	if err != nil {
		t.Fatal(err)
	}
	_ = db.Close()
	cfg := &ApiConfig{db: db, dbQueries: database.New(db)}
	out := httptest.NewRecorder()
	cfg.handlerV1GetFileMetadata(out, accessRequest(http.MethodGet, uuid.New()), database.User{ID: uuid.New()})
	if out.Code != http.StatusServiceUnavailable {
		t.Fatalf("metadata database outage became HTTP %d: %s", out.Code, out.Body.String())
	}
}

func addDirectAccess(t *testing.T, fx accessSecurityFixture) {
	t.Helper()
	if _, err := fx.cfg.db.Exec(`INSERT INTO file_access_keys (file_id,user_id,wrapped_key) VALUES ($1,$2,'wrapped')`, fx.fileID, fx.recipient.ID); err != nil {
		t.Fatal(err)
	}
}

func failFixtureFileLinkUpdate(t *testing.T, fx accessSecurityFixture) {
	t.Helper()
	name := "access_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	_, err := fx.cfg.db.Exec(`CREATE FUNCTION ` + name + `() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.file_id='` + fx.fileID.String() + `'::uuid THEN RAISE EXCEPTION 'synthetic link outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER ` + name + ` BEFORE UPDATE ON public_share_links FOR EACH ROW EXECUTE FUNCTION ` + name + `()`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = fx.cfg.db.Exec(`DROP TRIGGER ` + name + ` ON public_share_links; DROP FUNCTION ` + name + `()`)
	})
}

func revokeExternal(t *testing.T, fx accessSecurityFixture, ctx context.Context, user database.User) *httptest.ResponseRecorder {
	t.Helper()
	req := accessRequest(http.MethodDelete, fx.fileID).WithContext(ctx)
	out := httptest.NewRecorder()
	fx.cfg.handlerRevokeAllExternalAccess(out, req, user)
	return out
}

func assertDirectAndLinkState(t *testing.T, fx accessSecurityFixture, direct int, active bool) {
	t.Helper()
	var directCount int
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM file_access_keys WHERE file_id=$1 AND user_id=$2`, fx.fileID, fx.recipient.ID).Scan(&directCount); err != nil {
		t.Fatal(err)
	}
	var linkActive bool
	if err := fx.cfg.db.QueryRow(`SELECT is_active FROM public_share_links WHERE id=$1`, fx.fileLink.ID).Scan(&linkActive); err != nil {
		t.Fatal(err)
	}
	if directCount != direct || linkActive != active {
		t.Fatalf("direct=%d active=%v, want direct=%d active=%v", directCount, linkActive, direct, active)
	}
}

func TestRevokeExternalRollsBackWhenLinkMutationFails(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	addDirectAccess(t, fx)
	failFixtureFileLinkUpdate(t, fx)
	out := revokeExternal(t, fx, context.Background(), fx.owner)
	if out.Code < 500 {
		t.Fatalf("link failure falsely succeeded: %d %s", out.Code, out.Body.String())
	}
	assertDirectAndLinkState(t, fx, 1, true)
}

func TestRevokeExternalRollsBackWhenAuditFails(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	addDirectAccess(t, fx)
	failFixtureAudit(t, fx.cfg, fx.fileID)
	out := revokeExternal(t, fx, context.Background(), fx.owner)
	if out.Code < 500 {
		t.Fatalf("audit failure falsely succeeded: %d %s", out.Code, out.Body.String())
	}
	assertDirectAndLinkState(t, fx, 1, true)
}

func TestRevokeExternalIsScopedAtomicAndIdempotent(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	addDirectAccess(t, fx)
	var groupID uuid.UUID
	if err := fx.cfg.db.QueryRow(`INSERT INTO groups (user_id,name) VALUES ($1,$2) RETURNING id`, fx.owner.ID, "access-"+uuid.NewString()).Scan(&groupID); err != nil {
		t.Fatal(err)
	}
	if _, err := fx.cfg.db.Exec(`INSERT INTO group_file_shares (group_id,file_id,wrapped_key,created_by) VALUES ($1,$2,'wrapped',$3)`, groupID, fx.fileID, fx.owner.ID); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		out := revokeExternal(t, fx, context.Background(), fx.owner)
		if out.Code != http.StatusOK {
			t.Fatalf("revoke %d HTTP %d: %s", i+1, out.Code, out.Body.String())
		}
	}
	assertDirectAndLinkState(t, fx, 0, false)
	var groupRoutes, folderShares int
	var folderLinkActive bool
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM group_file_shares WHERE group_id=$1 AND file_id=$2`, groupID, fx.fileID).Scan(&groupRoutes); err != nil {
		t.Fatal(err)
	}
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM folder_shares WHERE folder_id=$1 AND user_id=$2`, fx.childID, fx.recipient.ID).Scan(&folderShares); err != nil {
		t.Fatal(err)
	}
	if err := fx.cfg.db.QueryRow(`SELECT is_active FROM folder_share_links WHERE id=$1`, fx.folderLinkID).Scan(&folderLinkActive); err != nil {
		t.Fatal(err)
	}
	if groupRoutes != 1 || folderShares != 1 || !folderLinkActive {
		t.Fatalf("unrelated routes changed: group=%d folder_share=%d folder_link_active=%v", groupRoutes, folderShares, folderLinkActive)
	}
	var audits, activities int
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE resource_id=$1 AND action='file.external_access_revoked'`, fx.fileID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM activity_log WHERE user_id=$1 AND event_type='external_access_revoked' AND payload->>'file_id'=$2`, fx.owner.ID, fx.fileID.String()).Scan(&activities); err != nil {
		t.Fatal(err)
	}
	if audits != 1 || activities != 1 {
		t.Fatalf("repeated revoke invented evidence: audits=%d activities=%d", audits, activities)
	}
	var metadata struct {
		DirectCount int    `json:"direct_count"`
		LinkCount   int    `json:"link_count"`
		Scope       string `json:"scope"`
	}
	var metadataJSON []byte
	if err := fx.cfg.db.QueryRow(`SELECT metadata FROM audit_logs WHERE resource_id=$1 AND action='file.external_access_revoked'`, fx.fileID).Scan(&metadataJSON); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(metadataJSON, &metadata); err != nil {
		t.Fatal(err)
	}
	if metadata.DirectCount != 1 || metadata.LinkCount != 1 || metadata.Scope != "direct_and_file_links" {
		t.Fatalf("audit lacks exact scope/counts: %#v", metadata)
	}
}

func TestRevokeExternalOutsiderAndCancelledRequestDoNotMutate(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	addDirectAccess(t, fx)
	if out := revokeExternal(t, fx, context.Background(), database.User{ID: uuid.New()}); out.Code != http.StatusForbidden {
		t.Fatalf("outsider status=%d: %s", out.Code, out.Body.String())
	}
	assertDirectAndLinkState(t, fx, 1, true)
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	if out := revokeExternal(t, fx, cancelled, fx.owner); out.Code < 500 {
		t.Fatalf("cancelled revoke falsely succeeded: %d %s", out.Code, out.Body.String())
	}
	assertDirectAndLinkState(t, fx, 1, true)
}

func TestTimelineUsesDurableAuditHistoryAndActualRevokeTime(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	createdAt := time.Now().UTC().Add(-2 * time.Hour).Truncate(time.Microsecond)
	revokedAt := createdAt.Add(75 * time.Minute)
	aggregateAt := revokedAt.Add(5 * time.Minute)
	if _, err := fx.cfg.db.Exec(`UPDATE public_share_links SET created_at=$1,is_active=FALSE WHERE id=$2`, createdAt, fx.fileLink.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := fx.cfg.db.Exec(`INSERT INTO audit_logs (user_id,action,resource_type,resource_id,metadata,created_at) VALUES
		($1,'file.shared','file',$2,$3,$4),
		($1,'public_share_link.created','public_share_link',$5,$6,$4),
		($1,'public_share_link.revoked','public_share_link',$5,'{}',$7),
		($1,'file.external_access_revoked','file',$2,$8,$9)`,
		fx.owner.ID, fx.fileID, mustJSON(map[string]string{"recipient_id": fx.recipient.ID.String()}), createdAt,
		fx.fileLink.ID, mustJSON(map[string]string{"file_id": fx.fileID.String()}), revokedAt,
		mustJSON(map[string]interface{}{"direct_count": 1, "link_count": 1, "scope": "direct_and_file_links"}), aggregateAt); err != nil {
		t.Fatal(err)
	}
	// Direct access rows are intentionally absent: historical sharing must survive revocation.
	out := httptest.NewRecorder()
	fx.cfg.handlerGetFileSecurityTimeline(out, accessRequest(http.MethodGet, fx.fileID), fx.owner)
	if out.Code != http.StatusOK {
		t.Fatalf("timeline HTTP %d: %s", out.Code, out.Body.String())
	}
	var payload struct {
		Data []fileTimelineEvent `json:"data"`
	}
	if err := json.Unmarshal(out.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	byType := map[string][]fileTimelineEvent{}
	for _, event := range payload.Data {
		byType[event.EventType] = append(byType[event.EventType], event)
	}
	if len(byType["shared"]) == 0 || len(byType["external_access_revoked"]) != 1 || len(byType["revoked"]) != 1 {
		t.Fatalf("durable events missing: %#v", payload.Data)
	}
	if got := byType["revoked"][0].At; got != revokedAt.Format(time.RFC3339) {
		t.Fatalf("revocation time=%s want %s (created=%s)", got, revokedAt.Format(time.RFC3339), createdAt.Format(time.RFC3339))
	}
	if payload.Data[0].At < payload.Data[len(payload.Data)-1].At {
		t.Fatalf("timeline not newest first: %#v", payload.Data)
	}
}

func TestAccessBuildersPropagateSourceFailure(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	db, err := sql.Open("postgres", "")
	if err != nil {
		t.Fatal(err)
	}
	_ = db.Close()
	dbFile, err := fx.cfg.dbQueries.GetFileByID(context.Background(), fx.fileID)
	if err != nil {
		t.Fatal(err)
	}
	req := accessRequest(http.MethodGet, fx.fileID)
	if _, err := buildFileAccessEntries(req.Context(), db, fx.fileID, dbFile, fx.owner); err == nil {
		t.Fatal("access source outage returned a usable snapshot")
	}
	if _, err := buildFileTimeline(req.Context(), db, fx.fileID, dbFile); err == nil {
		t.Fatal("audit source outage returned partial history")
	}
}

func TestAccessQueriesRepresentativePrivateTiming(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	dbFile, err := fx.cfg.dbQueries.GetFileByID(context.Background(), fx.fileID)
	if err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	entries, err := buildFileAccessEntries(context.Background(), fx.cfg.db, fx.fileID, dbFile, fx.owner)
	if err != nil {
		t.Fatal(err)
	}
	accessDuration := time.Since(started)
	started = time.Now()
	events, err := buildFileTimeline(context.Background(), fx.cfg.db, fx.fileID, dbFile)
	if err != nil {
		t.Fatal(err)
	}
	timelineDuration := time.Since(started)
	if len(entries) == 0 || len(events) == 0 {
		t.Fatalf("representative queries returned entries=%d events=%d", len(entries), len(events))
	}
	t.Logf("representative private fixture: access=%s (%d entries), timeline=%s (%d events, max=%d)", accessDuration, len(entries), timelineDuration, len(events), maxFileTimelineEvents)
}

func TestRevokeResponseReportsExactScopedCounts(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	addDirectAccess(t, fx)
	out := revokeExternal(t, fx, context.Background(), fx.owner)
	if out.Code != http.StatusOK {
		t.Fatalf("revoke HTTP %d: %s", out.Code, out.Body.String())
	}
	var payload struct {
		Success     bool `json:"success"`
		DirectCount int  `json:"direct_count"`
		LinkCount   int  `json:"link_count"`
	}
	decoder := json.NewDecoder(bytes.NewReader(out.Body.Bytes()))
	if err := decoder.Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if !payload.Success || payload.DirectCount != 1 || payload.LinkCount != 1 {
		t.Fatalf("unexpected revoke receipt: %#v", payload)
	}
}

func failFixtureAuditAction(t *testing.T, fx accessSecurityFixture, action string) {
	t.Helper()
	name := "access_action_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	_, err := fx.cfg.db.Exec(`CREATE FUNCTION ` + name + `() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.user_id='` + fx.owner.ID.String() + `'::uuid AND NEW.action='` + action + `' THEN RAISE EXCEPTION 'synthetic producer audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER ` + name + ` BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ` + name + `()`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = fx.cfg.db.Exec(`DROP TRIGGER ` + name + ` ON audit_logs; DROP FUNCTION ` + name + `()`)
	})
}

func TestAccessDirectShareRollsBackWhenAuditFails(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	fx.cfg.jwtSecret = "access-producer-secret"
	failFixtureAuditAction(t, fx, "file.shared")
	token, err := auth.MakeJWT(fx.owner.ID, fx.cfg.jwtSecret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	body := mustJSON(map[string]string{"user_id": fx.recipient.ID.String(), "wrapped_key": "wrapped-direct"})
	req := httptest.NewRequest(http.MethodPost, "/api/files/"+fx.fileID.String()+"/share", bytes.NewReader(body))
	req.SetPathValue("id", fx.fileID.String())
	req.Header.Set("Authorization", "Bearer "+token)
	out := httptest.NewRecorder()
	fx.cfg.handlerShareFile(out, req)
	if out.Code < 500 {
		t.Fatalf("direct share audit outage falsely succeeded: %d %s", out.Code, out.Body.String())
	}
	var keys, activities int
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM file_access_keys WHERE file_id=$1 AND user_id=$2`, fx.fileID, fx.recipient.ID).Scan(&keys); err != nil {
		t.Fatal(err)
	}
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM activity_log WHERE user_id=$1 AND event_type='file_shared' AND payload->>'file_id'=$2`, fx.owner.ID, fx.fileID.String()).Scan(&activities); err != nil {
		t.Fatal(err)
	}
	if keys != 0 || activities != 0 {
		t.Fatalf("partial direct share escaped: keys=%d activities=%d", keys, activities)
	}
}

func TestAccessPublicLinkCreateRollsBackWhenAuditFails(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	failFixtureAuditAction(t, fx, "public_share_link.created")
	var before int
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM public_share_links WHERE file_id=$1`, fx.fileID).Scan(&before); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/files/"+fx.fileID.String()+"/public-links", bytes.NewReader([]byte(`{}`)))
	req.SetPathValue("fileId", fx.fileID.String())
	out := httptest.NewRecorder()
	fx.cfg.handlerCreatePublicShareLink(out, req, fx.owner)
	if out.Code < 500 {
		t.Fatalf("public link audit outage falsely succeeded: %d %s", out.Code, out.Body.String())
	}
	var after, activities int
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM public_share_links WHERE file_id=$1`, fx.fileID).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM activity_log WHERE user_id=$1 AND event_type='public_share_link_created' AND payload->>'file_id'=$2`, fx.owner.ID, fx.fileID.String()).Scan(&activities); err != nil {
		t.Fatal(err)
	}
	if after != before || activities != 0 {
		t.Fatalf("partial public link creation escaped: before=%d after=%d activities=%d", before, after, activities)
	}
}

func TestAccessShareProducersCommitDurableHistory(t *testing.T) {
	fx := newAccessSecurityFixture(t)
	fx.cfg.jwtSecret = "access-producer-secret"
	token, err := auth.MakeJWT(fx.owner.ID, fx.cfg.jwtSecret, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	directBody := mustJSON(map[string]string{"user_id": fx.recipient.ID.String(), "wrapped_key": "wrapped-direct"})
	directReq := httptest.NewRequest(http.MethodPost, "/api/files/"+fx.fileID.String()+"/share", bytes.NewReader(directBody))
	directReq.SetPathValue("id", fx.fileID.String())
	directReq.Header.Set("Authorization", "Bearer "+token)
	directOut := httptest.NewRecorder()
	fx.cfg.handlerShareFile(directOut, directReq)
	if directOut.Code != http.StatusOK {
		t.Fatalf("direct share HTTP %d: %s", directOut.Code, directOut.Body.String())
	}

	linkReq := httptest.NewRequest(http.MethodPost, "/api/files/"+fx.fileID.String()+"/public-links", bytes.NewReader([]byte(`{}`)))
	linkReq.SetPathValue("fileId", fx.fileID.String())
	linkOut := httptest.NewRecorder()
	fx.cfg.handlerCreatePublicShareLink(linkOut, linkReq, fx.owner)
	if linkOut.Code != http.StatusCreated {
		t.Fatalf("link create HTTP %d: %s", linkOut.Code, linkOut.Body.String())
	}

	var audits, activities int
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE user_id=$1 AND action IN ('file.shared','public_share_link.created') AND (resource_id=$2 OR metadata->>'file_id'=$3)`, fx.owner.ID, fx.fileID, fx.fileID.String()).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM activity_log WHERE user_id=$1 AND event_type IN ('file_shared','public_share_link_created') AND payload->>'file_id'=$2`, fx.owner.ID, fx.fileID.String()).Scan(&activities); err != nil {
		t.Fatal(err)
	}
	if audits != 2 || activities != 2 {
		t.Fatalf("producer evidence mismatch: audits=%d activities=%d", audits, activities)
	}
	dbFile, err := fx.cfg.dbQueries.GetFileByID(context.Background(), fx.fileID)
	if err != nil {
		t.Fatal(err)
	}
	events, err := buildFileTimeline(context.Background(), fx.cfg.db, fx.fileID, dbFile)
	if err != nil {
		t.Fatal(err)
	}
	eventTypes := map[string]int{}
	for _, event := range events {
		eventTypes[event.EventType]++
	}
	if eventTypes["shared"] != 1 || eventTypes["link_created"] < 1 {
		t.Fatalf("durable producer events missing from timeline: %#v", events)
	}
}
