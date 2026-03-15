package main

import (
	"context"
	"net/http"

	"github.com/Pranay0205/VaultDrive/internal/database"
)

func (cfg *ApiConfig) getUserByUsernameHandler(w http.ResponseWriter, r *http.Request, _ database.User) {
	username := r.URL.Query().Get("username")

	if username == "" {
		respondWithError(w, http.StatusBadRequest, "Username is required", nil)
		return
	}

	user, err := cfg.dbQueries.GetUserByUsername(context.Background(), username)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "User not found", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"id":         user.ID,
		"username":   user.Username,
		"email":      user.Email,
		"first_name": user.FirstName,
		"last_name":  user.LastName,
		"public_key": user.PublicKey,
	})
}

func (cfg *ApiConfig) getUserByEmailHandler(w http.ResponseWriter, r *http.Request, _ database.User) {
	email := r.URL.Query().Get("email")

	if email == "" {
		respondWithError(w, http.StatusBadRequest, "Email is required", nil)
		return
	}
	user, err := cfg.dbQueries.GetUserByEmail(context.Background(), email)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "User not found", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"id":         user.ID,
		"username":   user.Username,
		"email":      user.Email,
		"first_name": user.FirstName,
		"last_name":  user.LastName,
		"public_key": user.PublicKey,
	})
}
