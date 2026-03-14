package main

import (
	"net/http"

	"github.com/Pranay0205/VaultDrive/internal/database"
)

type safeUserLookupResponse struct {
	ID        string `json:"id"`
	Username  string `json:"username"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func toSafeUserLookupResponse(user database.User) safeUserLookupResponse {
	return safeUserLookupResponse{
		ID:        user.ID.String(),
		Username:  user.Username,
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
	}
}

func (cfg *ApiConfig) getUserByUsernameHandler(w http.ResponseWriter, r *http.Request, _ database.User) {
	username := r.URL.Query().Get("username")

	if username == "" {
		respondWithError(w, http.StatusBadRequest, "Username is required", nil)
		return
	}

	user, err := cfg.dbQueries.GetUserByUsername(r.Context(), username)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "User not found", err)
		return
	}

	respondWithJSON(w, http.StatusOK, []safeUserLookupResponse{toSafeUserLookupResponse(user)})
}

func (cfg *ApiConfig) getUserByEmailHandler(w http.ResponseWriter, r *http.Request, _ database.User) {
	email := r.URL.Query().Get("email")

	if email == "" {
		respondWithError(w, http.StatusBadRequest, "Email is required", nil)
		return
	}
	user, err := cfg.dbQueries.GetUserByEmail(r.Context(), email)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "User not found", err)
		return
	}

	respondWithJSON(w, http.StatusOK, []safeUserLookupResponse{toSafeUserLookupResponse(user)})
}
