package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type groupAuthorizationFixture struct {
	cfg                     *ApiConfig
	owner, member, outsider database.User
	target                  database.User
	group                   database.Group
	ownerFile, memberFile   database.File
}

func newGroupAuthorizationFixture(t *testing.T) groupAuthorizationFixture {
	t.Helper()
	dbURL := os.Getenv("DB_URL")
	if dbURL == "" || !strings.Contains(dbURL, "dbname=abrn_coherence_test") {
		t.Skip("DB_URL must explicitly select abrn_coherence_test")
	}
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	q := database.New(db)
	createUser := func(label string) database.User {
		id := strings.ReplaceAll(uuid.NewString(), "-", "")
		user, err := q.CreateUser(context.Background(), database.CreateUserParams{
			FirstName: label, LastName: "GroupFixture", Username: label + "_" + id,
			Email: label + "_" + id + "@example.test", PasswordHash: "fixture",
			PublicKey: "fixture", PrivateKeyEncrypted: "fixture", CreatedAt: time.Now(), UpdatedAt: time.Now(),
		})
		if err != nil {
			t.Fatal(err)
		}
		return user
	}
	owner := createUser("owner")
	member := createUser("member")
	outsider := createUser("outsider")
	target := createUser("target")
	t.Cleanup(func() {
		for _, user := range []database.User{target, outsider, member, owner} {
			_, _ = db.Exec("DELETE FROM users WHERE id=$1", user.ID)
		}
	})
	group, err := q.CreateGroup(context.Background(), database.CreateGroupParams{
		UserID: owner.ID, Name: "group_" + uuid.NewString(), Description: sql.NullString{String: "fixture", Valid: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, item := range []struct {
		user uuid.UUID
		role string
	}{{owner.ID, "owner"}, {member.ID, "member"}} {
		if _, err := q.AddGroupMember(context.Background(), database.AddGroupMemberParams{
			GroupID: group.ID, UserID: item.user, Role: sql.NullString{String: item.role, Valid: true},
		}); err != nil {
			t.Fatal(err)
		}
	}
	createFile := func(ownerID uuid.UUID, name string) database.File {
		file, err := q.CreateFile(context.Background(), database.CreateFileParams{
			OwnerID: nullUUID(ownerID), Filename: name, FilePath: name + ".cipher", FileSize: 7,
			EncryptedMetadata: sql.NullString{String: `{}`, Valid: true}, CurrentKeyVersion: sql.NullInt32{Int32: 1, Valid: true},
			CreatedAt: time.Now(), UpdatedAt: time.Now(),
		})
		if err != nil {
			t.Fatal(err)
		}
		return file
	}
	return groupAuthorizationFixture{
		cfg: &ApiConfig{db: db, dbQueries: q}, owner: owner, member: member, outsider: outsider, target: target,
		group: group, ownerFile: createFile(owner.ID, "owner.txt"), memberFile: createFile(member.ID, "member.txt"),
	}
}

func groupHandlerRequest(t *testing.T, method, path string, body any, values map[string]string, user database.User, handler func(http.ResponseWriter, *http.Request, database.User)) *httptest.ResponseRecorder {
	t.Helper()
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	for key, value := range values {
		req.SetPathValue(key, value)
	}
	out := httptest.NewRecorder()
	handler(out, req, user)
	return out
}

func groupHandlerRawRequest(t *testing.T, method, raw string, values map[string]string, user database.User, handler func(http.ResponseWriter, *http.Request, database.User)) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, "/fixture", strings.NewReader(raw))
	for key, value := range values {
		req.SetPathValue(key, value)
	}
	out := httptest.NewRecorder()
	handler(out, req, user)
	return out
}

func failGroupFixtureAudit(t *testing.T, cfg *ApiConfig, resource uuid.UUID) {
	t.Helper()
	name := "groupaudit_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	_, err := cfg.db.Exec(`CREATE FUNCTION ` + name + `() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.resource_id = '` + resource.String() + `'::uuid THEN RAISE EXCEPTION 'synthetic group audit outage'; END IF; RETURN NEW; END $$; CREATE TRIGGER ` + name + ` BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION ` + name + `()`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = cfg.db.Exec(`DROP TRIGGER ` + name + ` ON audit_logs; DROP FUNCTION ` + name + `()`) })
}

func TestGroupInventoryRejectsOutsiderWithKnownID(t *testing.T) {
	fx := newGroupAuthorizationFixture(t)
	values := map[string]string{"id": fx.group.ID.String()}
	for name, handler := range map[string]func(http.ResponseWriter, *http.Request, database.User){
		"members": fx.cfg.getGroupMembersHandler,
		"files":   fx.cfg.getGroupFilesHandler,
	} {
		t.Run(name, func(t *testing.T) {
			out := groupHandlerRequest(t, http.MethodGet, "/fixture", nil, values, fx.outsider, handler)
			if out.Code != http.StatusForbidden {
				t.Fatalf("known group ID exposed to outsider: status=%d body=%s", out.Code, out.Body.String())
			}
		})
	}
}

func TestGroupMutationsEnforceOwnerMemberAndFileOwnerBoundaries(t *testing.T) {
	fx := newGroupAuthorizationFixture(t)
	groupValues := map[string]string{"id": fx.group.ID.String()}
	add := groupHandlerRequest(t, http.MethodPost, "/fixture", map[string]string{"user_id": fx.target.ID.String(), "role": "member"}, groupValues, fx.member, fx.cfg.addGroupMemberHandler)
	if add.Code != http.StatusForbidden {
		t.Fatalf("ordinary member added another member: status=%d body=%s", add.Code, add.Body.String())
	}
	removeMember := groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, map[string]string{
		"id": fx.group.ID.String(), "userId": fx.target.ID.String(),
	}, fx.member, fx.cfg.removeGroupMemberHandler)
	if removeMember.Code != http.StatusForbidden {
		t.Fatalf("ordinary member removed another member: status=%d body=%s", removeMember.Code, removeMember.Body.String())
	}
	update := groupHandlerRequest(t, http.MethodPut, "/fixture", map[string]string{"name": "renamed"}, groupValues, fx.member, fx.cfg.updateGroupHandler)
	if update.Code != http.StatusForbidden {
		t.Fatalf("ordinary member updated group: status=%d body=%s", update.Code, update.Body.String())
	}
	deleted := groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, groupValues, fx.outsider, fx.cfg.deleteGroupHandler)
	if deleted.Code != http.StatusForbidden {
		t.Fatalf("outsider deleted known group: status=%d body=%s", deleted.Code, deleted.Body.String())
	}
	shareOwnerFile := map[string]string{"file_id": fx.ownerFile.ID.String(), "wrapped_key": "wrapped"}
	for name, actor := range map[string]database.User{"outsider": fx.outsider, "non_owner_member": fx.member} {
		t.Run(name, func(t *testing.T) {
			out := groupHandlerRequest(t, http.MethodPost, "/fixture", shareOwnerFile, groupValues, actor, fx.cfg.shareFileToGroupHandler)
			if out.Code != http.StatusForbidden {
				t.Fatalf("unauthorized file association succeeded: status=%d body=%s", out.Code, out.Body.String())
			}
		})
	}
	memberShare := groupHandlerRequest(t, http.MethodPost, "/fixture", map[string]string{"file_id": fx.memberFile.ID.String(), "wrapped_key": "wrapped"}, groupValues, fx.member, fx.cfg.shareFileToGroupHandler)
	if memberShare.Code != http.StatusCreated {
		t.Fatalf("member could not associate own file: status=%d body=%s", memberShare.Code, memberShare.Body.String())
	}
	removeOtherFile := groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, map[string]string{
		"id": fx.group.ID.String(), "fileId": fx.memberFile.ID.String(),
	}, fx.outsider, fx.cfg.removeFileFromGroupHandler)
	if removeOtherFile.Code != http.StatusForbidden {
		t.Fatalf("outsider removed known group file association: status=%d body=%s", removeOtherFile.Code, removeOtherFile.Body.String())
	}
}

func TestGroupRemovalPreservesIndependentDirectGrantAndRecordsEvidence(t *testing.T) {
	fx := newGroupAuthorizationFixture(t)
	if _, err := fx.cfg.dbQueries.CreateFileAccessKey(context.Background(), database.CreateFileAccessKeyParams{
		FileID: nullUUID(fx.ownerFile.ID), UserID: nullUUID(fx.target.ID), WrappedKey: "independent-direct-grant",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := fx.cfg.dbQueries.ShareFileToGroup(context.Background(), database.ShareFileToGroupParams{
		GroupID: fx.group.ID, FileID: fx.ownerFile.ID, WrappedKey: "group-association", CreatedBy: fx.owner.ID,
	}); err != nil {
		t.Fatal(err)
	}
	memberOut := groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, map[string]string{
		"id": fx.group.ID.String(), "userId": fx.target.ID.String(),
	}, fx.owner, fx.cfg.removeGroupMemberHandler)
	if memberOut.Code != http.StatusNotFound {
		t.Fatalf("removing a nonmember must not claim success: status=%d body=%s", memberOut.Code, memberOut.Body.String())
	}
	if _, err := fx.cfg.dbQueries.AddGroupMember(context.Background(), database.AddGroupMemberParams{GroupID: fx.group.ID, UserID: fx.target.ID, Role: sql.NullString{String: "member", Valid: true}}); err != nil {
		t.Fatal(err)
	}
	memberOut = groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, map[string]string{
		"id": fx.group.ID.String(), "userId": fx.target.ID.String(),
	}, fx.owner, fx.cfg.removeGroupMemberHandler)
	if memberOut.Code != http.StatusOK {
		t.Fatalf("owner removal failed: status=%d body=%s", memberOut.Code, memberOut.Body.String())
	}
	fileOut := groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, map[string]string{
		"id": fx.group.ID.String(), "fileId": fx.ownerFile.ID.String(),
	}, fx.owner, fx.cfg.removeFileFromGroupHandler)
	if fileOut.Code != http.StatusOK {
		t.Fatalf("owner file-association removal failed: status=%d body=%s", fileOut.Code, fileOut.Body.String())
	}
	var direct, audits, activities int
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM file_access_keys WHERE file_id=$1 AND user_id=$2 AND wrapped_key='independent-direct-grant'`, fx.ownerFile.ID, fx.target.ID).Scan(&direct); err != nil {
		t.Fatal(err)
	}
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM audit_logs WHERE user_id=$1 AND ((action='group.member_removed' AND resource_id=$2) OR (action='group.file_removed' AND resource_id=$3))`, fx.owner.ID, fx.group.ID, fx.ownerFile.ID).Scan(&audits); err != nil {
		t.Fatal(err)
	}
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM activity_log WHERE user_id=$1 AND event_type IN ('group_member_removed','group_file_removed')`, fx.owner.ID).Scan(&activities); err != nil {
		t.Fatal(err)
	}
	if direct != 1 || audits != 2 || activities != 2 {
		t.Fatalf("removal scope/evidence mismatch: direct=%d audits=%d activities=%d", direct, audits, activities)
	}
}

func TestGroupAuditFailureRollsBackMutation(t *testing.T) {
	fx := newGroupAuthorizationFixture(t)
	if _, err := fx.cfg.dbQueries.AddGroupMember(context.Background(), database.AddGroupMemberParams{GroupID: fx.group.ID, UserID: fx.target.ID, Role: sql.NullString{String: "member", Valid: true}}); err != nil {
		t.Fatal(err)
	}
	failGroupFixtureAudit(t, fx.cfg, fx.group.ID)
	out := groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, map[string]string{
		"id": fx.group.ID.String(), "userId": fx.target.ID.String(),
	}, fx.owner, fx.cfg.removeGroupMemberHandler)
	if out.Code < 500 {
		t.Fatalf("audit outage returned false success: status=%d body=%s", out.Code, out.Body.String())
	}
	if _, err := fx.cfg.dbQueries.IsUserInGroup(context.Background(), database.IsUserInGroupParams{GroupID: fx.group.ID, UserID: fx.target.ID}); err != nil {
		t.Fatalf("audit outage did not roll back membership removal: %v", err)
	}
	if _, err := fx.cfg.dbQueries.ShareFileToGroup(context.Background(), database.ShareFileToGroupParams{
		GroupID: fx.group.ID, FileID: fx.ownerFile.ID, WrappedKey: "group-association", CreatedBy: fx.owner.ID,
	}); err != nil {
		t.Fatal(err)
	}
	failGroupFixtureAudit(t, fx.cfg, fx.ownerFile.ID)
	fileOut := groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, map[string]string{
		"id": fx.group.ID.String(), "fileId": fx.ownerFile.ID.String(),
	}, fx.owner, fx.cfg.removeFileFromGroupHandler)
	if fileOut.Code < 500 {
		t.Fatalf("file audit outage returned false success: status=%d body=%s", fileOut.Code, fileOut.Body.String())
	}
	var association int
	if err := fx.cfg.db.QueryRow(`SELECT count(*) FROM group_file_shares WHERE group_id=$1 AND file_id=$2`, fx.group.ID, fx.ownerFile.ID).Scan(&association); err != nil {
		t.Fatal(err)
	}
	if association != 1 {
		t.Fatalf("audit outage did not roll back group file removal: associations=%d", association)
	}
}

func TestGroupDatabaseFailuresNeverReturnSuccess(t *testing.T) {
	db, err := sql.Open("postgres", "")
	if err != nil {
		t.Fatal(err)
	}
	_ = db.Close()
	cfg := &ApiConfig{db: db, dbQueries: database.New(db)}
	actor := database.User{ID: uuid.New()}
	for name, tc := range map[string]struct {
		values  map[string]string
		handler func(http.ResponseWriter, *http.Request, database.User)
	}{
		"delete group":  {map[string]string{"id": uuid.NewString()}, cfg.deleteGroupHandler},
		"remove member": {map[string]string{"id": uuid.NewString(), "userId": uuid.NewString()}, cfg.removeGroupMemberHandler},
		"remove file":   {map[string]string{"id": uuid.NewString(), "fileId": uuid.NewString()}, cfg.removeFileFromGroupHandler},
	} {
		t.Run(name, func(t *testing.T) {
			out := groupHandlerRequest(t, http.MethodDelete, "/fixture", nil, tc.values, actor, tc.handler)
			if out.Code < 500 {
				t.Fatalf("database failure returned status=%d body=%s", out.Code, out.Body.String())
			}
		})
	}
}

func TestGroupPayloadBounds(t *testing.T) {
	fx := newGroupAuthorizationFixture(t)
	groupValues := map[string]string{"id": fx.group.ID.String()}
	tests := []struct {
		name    string
		body    any
		handler func(http.ResponseWriter, *http.Request, database.User)
	}{
		{"overlong name", map[string]string{"name": strings.Repeat("n", 256)}, fx.cfg.createGroupHandler},
		{"role escalation", map[string]string{"user_id": fx.target.ID.String(), "role": "owner"}, fx.cfg.addGroupMemberHandler},
		{"oversized wrapped key", map[string]string{"file_id": fx.ownerFile.ID.String(), "wrapped_key": strings.Repeat("k", 16*1024+1)}, fx.cfg.shareFileToGroupHandler},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			out := groupHandlerRequest(t, http.MethodPost, "/fixture", tc.body, groupValues, fx.owner, tc.handler)
			if out.Code != http.StatusBadRequest {
				t.Fatalf("invalid payload returned status=%d body=%s", out.Code, out.Body.String())
			}
		})
	}
	for name, raw := range map[string]string{
		"unknown field":     `{"name":"valid","unexpected":true}`,
		"trailing object":   `{"name":"valid"}{"name":"second"}`,
		"request too large": `{"name":"valid","description":"` + strings.Repeat("x", maxGroupRequestBytes) + `"}`,
	} {
		t.Run(name, func(t *testing.T) {
			out := groupHandlerRawRequest(t, http.MethodPost, raw, nil, fx.owner, fx.cfg.createGroupHandler)
			if out.Code != http.StatusBadRequest {
				t.Fatalf("malformed payload returned status=%d body=%s", out.Code, out.Body.String())
			}
		})
	}
}
