package main

import (
	"context"
	"net/http"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
)

type authedHandler func(http.ResponseWriter, *http.Request, database.User)

func (cfg *ApiConfig) middlewareAuth(handler authedHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenString, err := auth.GetBearerToken(r.Header)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Missing or invalid token", err)
			return
		}

		userID, err := auth.ValidateJWT(tokenString, cfg.jwtSecret)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
			return
		}

		user, err := cfg.dbQueries.GetUserByID(context.Background(), userID)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Error getting user", err)
			return
		}

		handler(w, r, user)
	}
}
