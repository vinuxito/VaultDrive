package main

import (
	"encoding/json"
	"net/http"

	"github.com/Pranay0205/VaultDrive/internal/database"
)

func (cfg *ApiConfig) handlerUpdateOrganization(w http.ResponseWriter, r *http.Request, user database.User) {
	var body struct {
		OrganizationName string `json:"organization_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	_, err := cfg.db.ExecContext(r.Context(),
		"UPDATE users SET organization_name = $1 WHERE id = $2",
		body.OrganizationName, user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to update organization", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]bool{"success": true})
}
