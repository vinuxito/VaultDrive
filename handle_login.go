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
		Pin      string `json:"pin"`
	}

	type response struct {
		Username               string `json:"username"`
		Email                  string `json:"email"`
		FirstName              string `json:"first_name"`
		LastName               string `json:"last_name"`
		Token                  string `json:"token"`
		RefreshToken           string `json:"refresh_token"`
		PublicKey              string `json:"public_key"`
		PrivateKeyEncrypted    string `json:"private_key_encrypted"`
		PrivateKeyPinEncrypted string `json:"private_key_pin_encrypted,omitempty"`
		IsAdmin                bool   `json:"is_admin"`
		PinSet                 bool   `json:"pin_set"`
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

	if params.Pin != "" {
		if !user.PinHash.Valid || user.PinHash.String == "" {
			respondWithError(w, http.StatusUnauthorized, "PIN not configured. Please log in with your password.", nil)
			return
		}
		if isPINLocked(user) {
			respondWithError(w, http.StatusTooManyRequests, pinLockedMessage(user), nil)
			return
		}
		if err := auth.CheckPasswordHash(params.Pin, user.PinHash.String); err != nil {
			message, lockErr := cfg.registerFailedPINAttempt(r.Context(), user)
			if lockErr != nil {
				respondWithError(w, http.StatusInternalServerError, "Could not validate PIN", lockErr)
				return
			}
			if message == "" {
				message = "Incorrect PIN"
			}
			respondWithError(w, http.StatusUnauthorized, message, err)
			return
		}
		if err := cfg.resetPINLockout(r.Context(), user.ID); err != nil {
			respondWithError(w, http.StatusInternalServerError, "Could not reset PIN lockout state", err)
			return
		}
	} else {
		if err := auth.CheckPasswordHash(params.Password, user.PasswordHash); err != nil {
			respondWithError(w, http.StatusUnauthorized, "Incorrect email or password", err)
			return
		}
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

	pinSet := user.PinHash.Valid && user.PinHash.String != ""

	privateKeyPinEncrypted := ""
	if user.PrivateKeyPinEncrypted.Valid {
		privateKeyPinEncrypted = user.PrivateKeyPinEncrypted.String
	}

	respondWithJSON(w, http.StatusOK, response{
		Username:               user.Username,
		Email:                  user.Email,
		FirstName:              user.FirstName,
		LastName:               user.LastName,
		Token:                  accessToken,
		RefreshToken:           refreshToken,
		PublicKey:              user.PublicKey,
		PrivateKeyEncrypted:    user.PrivateKeyEncrypted,
		PrivateKeyPinEncrypted: privateKeyPinEncrypted,
		IsAdmin:                isAdmin,
		PinSet:                 pinSet,
	})
}
