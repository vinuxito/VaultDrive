package main

import (
	"database/sql"
	"net/http"

	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerGetPublicKey(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		respondWithError(w, http.StatusBadRequest, "Email is required", nil)
		return
	}

	user, err := cfg.dbQueries.GetUserByEmail(r.Context(), email)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "User not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving user", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"public_key": user.PublicKey,
		"user_id":    user.ID.String(),
	})
}

func (cfg *ApiConfig) handlerGetPublicKeyByID(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.PathValue("userId")
	if userIDStr == "" {
		respondWithError(w, http.StatusBadRequest, "userId is required", nil)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid userId format", err)
		return
	}

	row, err := cfg.dbQueries.GetUserPublicKeyByID(r.Context(), userID)
	if err != nil {
		if err == sql.ErrNoRows {
			respondWithError(w, http.StatusNotFound, "User not found", err)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Error retrieving user", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"public_key": row.PublicKey,
		"user_id":    row.ID.String(),
	})
}
