package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/google/uuid"
)

var sseRegistry sync.Map

func broadcastToUser(userID uuid.UUID, event string, payload interface{}) {
	val, ok := sseRegistry.Load(userID.String())
	if !ok {
		return
	}
	data := map[string]interface{}{
		"event":   event,
		"payload": payload,
	}
	b, err := json.Marshal(data)
	if err != nil {
		log.Printf("broadcastToUser: marshal error: %v", err)
		return
	}
	ch := val.(chan string)
	select {
	case ch <- string(b):
	default:
	}
}

func (cfg *ApiConfig) handlerSSE(w http.ResponseWriter, r *http.Request) {
	// EventSource cannot send custom headers, so we accept the JWT via ?token= query
	// param as a fallback to the standard Authorization header.
	tokenString, err := auth.GetBearerToken(r.Header)
	if err != nil {
		tokenString = r.URL.Query().Get("token")
		if tokenString == "" {
			respondWithError(w, http.StatusUnauthorized, "Missing or invalid token", nil)
			return
		}
	}
	userID, err := auth.ValidateJWT(tokenString, cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
		return
	}
	user, err := cfg.dbQueries.GetUserByID(context.Background(), userID)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "User not found", err)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		respondWithError(w, http.StatusInternalServerError, "Streaming not supported", nil)
		return
	}

	ch := make(chan string, 16)
	userKey := user.ID.String()
	sseRegistry.Store(userKey, ch)
	defer sseRegistry.Delete(userKey)

	fmt.Fprintf(w, "data: {\"event\":\"connected\",\"user_id\":\"%s\"}\n\n", userKey)
	flusher.Flush()

	for {
		select {
		case msg := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", msg)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}
