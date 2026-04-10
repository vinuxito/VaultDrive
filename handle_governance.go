package main

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/vinuxito/VaultDrive/internal/database"
)

type governanceSettings struct {
	AuditRetentionDays   int  `json:"audit_retention_days"`
	AutoExpireStaleDays  *int `json:"auto_expire_stale_days"` // nil = disabled
	FailureAlertThreshold int  `json:"failure_alert_threshold"`
}

func (cfg *ApiConfig) handlerGetGovernanceSettings(w http.ResponseWriter, r *http.Request, user database.User) {
	var s governanceSettings
	var staleDays sql.NullInt32
	err := cfg.db.QueryRowContext(r.Context(),
		`SELECT
		    COALESCE(audit_retention_days, 365),
		    auto_expire_stale_days,
		    COALESCE(failure_alert_threshold, 3)
		 FROM users WHERE id = $1`, user.ID,
	).Scan(&s.AuditRetentionDays, &staleDays, &s.FailureAlertThreshold)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not load settings", err)
		return
	}
	if staleDays.Valid {
		v := int(staleDays.Int32)
		s.AutoExpireStaleDays = &v
	}
	respondWithJSON(w, http.StatusOK, s)
}

func (cfg *ApiConfig) handlerUpdateGovernanceSettings(w http.ResponseWriter, r *http.Request, user database.User) {
	var body struct {
		AuditRetentionDays    *int `json:"audit_retention_days"`
		AutoExpireStaleDays   *int `json:"auto_expire_stale_days"` // nil = disable
		FailureAlertThreshold *int `json:"failure_alert_threshold"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate ranges.
	if body.AuditRetentionDays != nil && (*body.AuditRetentionDays < 30 || *body.AuditRetentionDays > 3650) {
		respondWithError(w, http.StatusBadRequest, "audit_retention_days must be between 30 and 3650", nil)
		return
	}
	if body.FailureAlertThreshold != nil && (*body.FailureAlertThreshold < 1 || *body.FailureAlertThreshold > 100) {
		respondWithError(w, http.StatusBadRequest, "failure_alert_threshold must be between 1 and 100", nil)
		return
	}

	var staleDays sql.NullInt32
	if body.AutoExpireStaleDays != nil {
		staleDays = sql.NullInt32{Int32: int32(*body.AutoExpireStaleDays), Valid: true}
	}

	_, _ = cfg.db.ExecContext(r.Context(),
		`UPDATE users
		 SET
		     audit_retention_days    = COALESCE($2, audit_retention_days),
		     auto_expire_stale_days  = CASE WHEN $3::boolean THEN $4::integer ELSE NULL END,
		     failure_alert_threshold = COALESCE($5, failure_alert_threshold)
		 WHERE id = $1`,
		user.ID,
		body.AuditRetentionDays,
		body.AutoExpireStaleDays != nil, staleDays.Int32,
		body.FailureAlertThreshold,
	)

	// Re-read the saved row for a clean response.
	var s governanceSettings
	var savedStale sql.NullInt32
	cfg.db.QueryRowContext(r.Context(),
		`SELECT COALESCE(audit_retention_days,365), auto_expire_stale_days, COALESCE(failure_alert_threshold,3)
		 FROM users WHERE id = $1`, user.ID,
	).Scan(&s.AuditRetentionDays, &savedStale, &s.FailureAlertThreshold)
	if savedStale.Valid {
		v := int(savedStale.Int32)
		s.AutoExpireStaleDays = &v
	}

	respondWithJSON(w, http.StatusOK, s)
}
