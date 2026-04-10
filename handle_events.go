package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/vinuxito/VaultDrive/auth"
	"github.com/google/uuid"
)

var sseRegistry sync.Map

// sseTickets holds short-lived single-use tickets that map to user IDs.
// This prevents raw JWTs from appearing in SSE URLs (and therefore access logs).
var sseTickets sync.Map

type sseTicket struct {
	userID    uuid.UUID
	expiresAt time.Time
}

// handlerSSETicket is called by authenticated clients to obtain a one-time,
// 30-second ticket that can be passed to the SSE endpoint via ?ticket= instead
// of the raw JWT, keeping credentials out of access logs.
func (cfg *ApiConfig) handlerSSETicket(w http.ResponseWriter, r *http.Request) {
	tokenString, err := auth.GetBearerToken(r.Header)
	if err != nil || tokenString == "" {
		respondWithError(w, http.StatusUnauthorized, "Missing token", nil)
		return
	}
	userID, err := auth.ValidateJWT(tokenString, cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
		return
	}

	ticket := uuid.NewString()
	sseTickets.Store(ticket, sseTicket{
		userID:    userID,
		expiresAt: time.Now().Add(30 * time.Second),
	})

	// Purge the ticket after its TTL so the map does not grow unbounded.
	go func() {
		time.Sleep(35 * time.Second)
		sseTickets.Delete(ticket)
	}()

	respondWithJSON(w, http.StatusOK, map[string]string{"ticket": ticket})
}

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

func broadcastAgentOperation(userID uuid.UUID, action string, details map[string]interface{}) {
	payload := map[string]interface{}{
		"id":         uuid.NewString(),
		"action":     action,
		"created_at": time.Now().UTC().Format(time.RFC3339Nano),
	}
	for key, value := range details {
		payload[key] = value
	}
	broadcastToUser(userID, "agent_operation", payload)
}

func (cfg *ApiConfig) handlerSSE(w http.ResponseWriter, r *http.Request) {
	var userID uuid.UUID

	// Preferred path: single-use ticket obtained via POST /api/events/ticket.
	// This keeps the JWT out of the URL and out of access logs.
	if ticketStr := r.URL.Query().Get("ticket"); ticketStr != "" {
		val, ok := sseTickets.LoadAndDelete(ticketStr)
		if !ok {
			respondWithError(w, http.StatusUnauthorized, "Invalid or already-used SSE ticket", nil)
			return
		}
		t := val.(sseTicket)
		if time.Now().After(t.expiresAt) {
			respondWithError(w, http.StatusUnauthorized, "SSE ticket has expired", nil)
			return
		}
		userID = t.userID
	} else {
		// Legacy fallback: accept JWT in Authorization header or ?token= query param.
		// The ?token= path is deprecated; prefer the ticket system.
		tokenString, err := auth.GetBearerToken(r.Header)
		if err != nil {
			tokenString = r.URL.Query().Get("token")
			if tokenString == "" {
				respondWithError(w, http.StatusUnauthorized, "Missing or invalid token", nil)
				return
			}
		}
		userID, err = auth.ValidateJWT(tokenString, cfg.jwtSecret)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
			return
		}
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
