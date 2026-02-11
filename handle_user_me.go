package main

import (
	"context"
	"log"
	"net/http"

	"github.com/Pranay0205/VaultDrive/auth"
)

func (cfg *ApiConfig) getUserMeHandler(w http.ResponseWriter, r *http.Request) {
	log.Printf("getUserMeHandler called!")
	// Get user ID from JWT token
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		log.Printf("No authorization header found")
		respondWithError(w, http.StatusUnauthorized, "Missing or invalid token", nil)
		return
	}

	// Remove "Bearer " prefix if present
	if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
		tokenString = tokenString[7:]
	}

	userID, err := auth.ValidateJWT(tokenString, cfg.jwtSecret)
	if err != nil {
		log.Printf("JWT validation error: %v", err)
		respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
		return
	}

	// Get user from database
	user, err := cfg.dbQueries.GetUserByID(context.Background(), userID)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error getting user", err)
		return
	}

	// Return user info (without sensitive data)
	response := map[string]interface{}{
		"id":         user.ID,
		"first_name": user.FirstName,
		"last_name":  user.LastName,
		"username":   user.Username,
		"email":      user.Email,
		"created_at": user.CreatedAt,
		"updated_at": user.UpdatedAt,
	}

	respondWithJSON(w, http.StatusOK, response)
}
