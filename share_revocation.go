package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

// The closure and its evidence commit together. Cancellation or an audit outage
// rolls back the closure, so a retry can still perform and record the transition.
func (cfg *ApiConfig) closeOwnedShareLink(r *http.Request, ownerID, linkID uuid.UUID, kind string) (owned, changed bool, err error) {
	var query, activity string
	switch kind {
	case "public_share_link":
		query = `UPDATE public_share_links SET is_active=FALSE WHERE id=$1 AND owner_id=$2 AND is_active=TRUE RETURNING id`
		activity = "public_share_link_revoked"
	case "folder_share_link":
		query = `UPDATE folder_share_links SET is_active=FALSE WHERE id=$1 AND owner_id=$2 AND is_active=TRUE RETURNING id`
		activity = "folder_share_link_revoked"
	default:
		return false, false, fmt.Errorf("unsupported share kind")
	}
	tx, err := cfg.db.BeginTx(r.Context(), nil)
	if err != nil {
		return false, false, err
	}
	defer tx.Rollback()
	var id uuid.UUID
	err = tx.QueryRowContext(r.Context(), query, linkID, ownerID).Scan(&id)
	if err == sql.ErrNoRows {
		lookup := `SELECT EXISTS(SELECT 1 FROM public_share_links WHERE id=$1 AND owner_id=$2)`
		if kind == "folder_share_link" {
			lookup = `SELECT EXISTS(SELECT 1 FROM folder_share_links WHERE id=$1 AND owner_id=$2)`
		}
		err = tx.QueryRowContext(r.Context(), lookup, linkID, ownerID).Scan(&owned)
		return owned, false, err
	}
	if err != nil {
		return false, false, err
	}
	queries := cfg.dbQueries.WithTx(tx)
	err = queries.InsertActivity(r.Context(), database.InsertActivityParams{UserID: ownerID, EventType: activity, Payload: marshalJSONB(map[string]string{"share_link_id": linkID.String()})})
	if err != nil {
		return true, false, err
	}
	_, err = queries.CreateAuditLog(r.Context(), database.CreateAuditLogParams{UserID: nullUUID(ownerID), Action: kind + ".revoked", ResourceType: kind, ResourceID: nullUUID(linkID), IpAddress: requestInet(r), CreatedAt: time.Now().UTC()})
	if err != nil {
		return true, false, err
	}
	err = tx.Commit()
	return true, err == nil, err
}
