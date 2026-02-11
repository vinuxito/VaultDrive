package main

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
)

func (cfg *ApiConfig) handlerLogin(w http.ResponseWriter, r *http.Request) {
	type parameters struct {
		Password string `json:"password"`
		Email    string `json:"email"`
	}

	type response struct {
		Username            string `json:"username"`
		Email               string `json:"email"`
		FirstName           string `json:"first_name"`
		LastName            string `json:"last_name"`
		Token               string `json:"token"`
		RefreshToken        string `json:"refresh_token"`
		PublicKey           string `json:"public_key"`
		PrivateKeyEncrypted string `json:"private_key_encrypted"`
		IsAdmin             bool   `json:"is_admin"`
	}

	decoder := json.NewDecoder(r.Body)
	params := parameters{}
	err := decoder.Decode(&params)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Couldn't decode parameters", err)
		return
	}

	user, err := cfg.dbQueries.GetUserByEmail(r.Context(), params.Email)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Incorrect email or password", err)
		return
	}

	err = auth.CheckPasswordHash(params.Password, user.PasswordHash)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Incorrect email or password", err)
		return
	}

	accessToken, err := auth.MakeJWT(user.ID, cfg.jwtSecret, time.Hour*24*30)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Couldn't create access JWT", err)
		return
	}

	refreshToken, err := auth.MakeRefreshToken()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Couldn't create refresh token", err)
		return
	}

	_, err = cfg.dbQueries.CreateRefreshToken(r.Context(), database.CreateRefreshTokenParams{
		UserID:    user.ID,
		Token:     refreshToken,
		ExpiresAt: time.Now().UTC().Add(time.Hour * 24 * 60),
	})

	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Couldn't save refresh token", err)
		return
	}

	isAdmin := false
	if user.IsAdmin.Valid {
		isAdmin = user.IsAdmin.Bool
	}
	respondWithJSON(w, http.StatusOK, response{
		Username:            user.Username,
		Email:               user.Email,
		FirstName:           user.FirstName,
		LastName:            user.LastName,
		Token:               accessToken,
		RefreshToken:        refreshToken,
		PublicKey:           user.PublicKey,
		PrivateKeyEncrypted: user.PrivateKeyEncrypted,
		IsAdmin:             isAdmin,
	})
}
