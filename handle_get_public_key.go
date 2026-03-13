package main

import (
	"database/sql"
	"net/http"
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
