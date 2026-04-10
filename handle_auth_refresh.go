package main

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

// handlerRefreshToken exchanges a valid refresh token for a new short-lived
// access JWT. The refresh token is sent in the Authorization header as
// "Bearer <refresh_token>" to avoid URL exposure.
func (cfg *ApiConfig) handlerRefreshToken(w http.ResponseWriter, r *http.Request) {
	rawToken, err := auth.GetBearerToken(r.Header)
	if err != nil || rawToken == "" {
		respondWithError(w, http.StatusUnauthorized, "Missing refresh token", nil)
		return
	}

	rt, err := cfg.dbQueries.GetRefreshToken(r.Context(), rawToken)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid refresh token", err)
		return
	}

	if rt.RevokedAt.Valid {
		respondWithError(w, http.StatusUnauthorized, "Refresh token has been revoked", nil)
		return
	}

	if rt.ExpiresAt.Before(time.Now().UTC()) {
		respondWithError(w, http.StatusUnauthorized, "Refresh token has expired", nil)
		return
	}

	user, err := cfg.dbQueries.GetUserByID(r.Context(), rt.UserID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "User not found", err)
		return
	}

	accessToken, err := auth.MakeJWT(user.ID, cfg.jwtSecret, time.Minute*30)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not create access token", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"token": accessToken,
	})
}

// handlerRevokeRefreshToken invalidates a refresh token (used on logout).
func (cfg *ApiConfig) handlerRevokeRefreshToken(w http.ResponseWriter, r *http.Request) {
	rawToken, err := auth.GetBearerToken(r.Header)
	if err != nil || rawToken == "" {
		respondWithError(w, http.StatusUnauthorized, "Missing refresh token", nil)
		return
	}

	now := sql.NullTime{Time: time.Now().UTC(), Valid: true}
	err = cfg.dbQueries.RevokeRefreshToken(r.Context(), database.RevokeRefreshTokenParams{
		Token:     rawToken,
		RevokedAt: now,
		UpdatedAt: now,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not revoke token", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "revoked"})
}
