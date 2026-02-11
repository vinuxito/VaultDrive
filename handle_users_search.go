package main

import (
	"context"
	"net/http"

	"github.com/Pranay0205/VaultDrive/internal/database"
)

// GET /users/search - Search users by username, email, or name
func (cfg *ApiConfig) searchUsersHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	query := r.URL.Query().Get("q")

	// Default to showing all users if no query provided
	searchPattern := "%"
	if query != "" {
		searchPattern = "%" + query + "%"
	}

	// Limit to 100 results for performance
	users, err := cfg.dbQueries.SearchUsers(context.Background(), database.SearchUsersParams{
		Lower: searchPattern,
		Limit: 100,
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error searching users", err)
		return
	}

	// Transform to frontend-friendly format (exclude sensitive fields)
	response := make([]map[string]interface{}, len(users))
	for i, u := range users {
		response[i] = map[string]interface{}{
			"id":         u.ID,
			"username":   u.Username,
			"email":      u.Email,
			"first_name": u.FirstName,
			"last_name":  u.LastName,
			"created_at": u.CreatedAt,
			"updated_at": u.UpdatedAt,
		}
	}

	respondWithJSON(w, http.StatusOK, response)
}
