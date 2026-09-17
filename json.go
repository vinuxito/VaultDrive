package main

import (
	"encoding/json"
	"net/http"

	"github.com/vinuxito/VaultDrive/internal/messages"
)

func respondWithError(w http.ResponseWriter, code int, msg string, err error) {
	logResponseFailure(w, code, err)
	type errorResponse struct {
		Error string `json:"error"`
	}
	respondWithJSON(w, code, errorResponse{
		Error: msg,
	})
}

func respondWithErrorCtx(r *http.Request, w http.ResponseWriter, code int, msgKey string, err error) {
	logResponseFailure(w, code, err)
	// Fetch message from messages package
	msg := messages.Get(r.Context(), msgKey)

	type errorResponse struct {
		Error string `json:"error"`
	}
	respondWithJSON(w, code, errorResponse{
		Error: msg,
	})
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {

	w.Header().Set("Content-Type", "application/json")
	dat, err := json.Marshal(payload)
	if err != nil {
		logResponseFailure(w, http.StatusInternalServerError, err)
		w.WriteHeader(500)
		return
	}
	w.WriteHeader(code)
	w.Write(dat)
}
