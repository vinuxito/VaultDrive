package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/auth"
)

type room struct {
	id      string
	clients map[string]chan string
	mu      sync.RWMutex
}

var roomsRegistry sync.Map

func getOrCreateRoom(roomID string) *room {
	val, _ := roomsRegistry.LoadOrStore(roomID, &room{
		id:      roomID,
		clients: make(map[string]chan string),
	})
	return val.(*room)
}

func (rm *room) registerClient(clientID string, ch chan string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.clients[clientID] = ch
}

func (rm *room) unregisterClient(clientID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	delete(rm.clients, clientID)
}

func (rm *room) broadcast(senderID string, msg string) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	for cid, ch := range rm.clients {
		if cid == senderID {
			continue // skip echo
		}
		select {
		case ch <- msg:
		default:
			// Channel is full or client is blocked.
		}
	}
}

// handlerRoomConnect upgrades requests to an SSE connection.
// It authenticates via short-lived tickets (similar to handlerSSE) to keep JWTs out of URLs.
func (cfg *ApiConfig) handlerRoomConnect(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		respondWithError(w, http.StatusBadRequest, "Room ID is required", nil)
		return
	}

	var userID uuid.UUID
	var err error

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
		tokenString, err := auth.GetBearerToken(r.Header)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Missing or invalid token", nil)
			return
		}
		userID, err = auth.ValidateJWT(tokenString, cfg.jwtSecret)
		if err != nil {
			respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
			return
		}
	}

	_, err = cfg.dbQueries.GetUserByID(r.Context(), userID)
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

	clientID := uuid.NewString()
	ch := make(chan string, 32)

	rm := getOrCreateRoom(roomID)
	rm.registerClient(clientID, ch)
	defer rm.unregisterClient(clientID)

	// Send initial greeting data with client credentials
	initialData := map[string]string{
		"event":     "connected",
		"client_id": clientID,
		"user_id":   userID.String(),
	}
	initialBytes, _ := json.Marshal(initialData)
	fmt.Fprintf(w, "data: %s\n\n", string(initialBytes))
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

// handlerRoomBroadcast receives ZK encrypted frames and forwards them to room participants.
func (cfg *ApiConfig) handlerRoomBroadcast(w http.ResponseWriter, r *http.Request) {
	roomID := r.PathValue("id")
	if roomID == "" {
		respondWithError(w, http.StatusBadRequest, "Room ID is required", nil)
		return
	}

	type broadcastPayload struct {
		SenderID string          `json:"sender_id"`
		Event    string          `json:"event"`
		Data     json.RawMessage `json:"data"`
	}

	var payload broadcastPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON payload", err)
		return
	}

	if payload.SenderID == "" {
		respondWithError(w, http.StatusBadRequest, "sender_id is required", nil)
		return
	}

	rm := getOrCreateRoom(roomID)

	outMsg := map[string]interface{}{
		"sender_id": payload.SenderID,
		"event":     payload.Event,
		"data":      payload.Data,
	}
	outBytes, err := json.Marshal(outMsg)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to marshal broadcast payload", err)
		return
	}

	rm.broadcast(payload.SenderID, string(outBytes))

	respondWithJSON(w, http.StatusOK, map[string]bool{"success": true})
}
