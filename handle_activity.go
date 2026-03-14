package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
	"github.com/sqlc-dev/pqtype"
)

type activityResponse struct {
	ID        string                 `json:"id"`
	EventType string                 `json:"event_type"`
	Message   string                 `json:"message,omitempty"`
	Payload   map[string]interface{} `json:"payload,omitempty"`
	CreatedAt string                 `json:"created_at"`
}

func displayNameForUser(user database.User) string {
	fullName := strings.TrimSpace(strings.TrimSpace(user.FirstName) + " " + strings.TrimSpace(user.LastName))
	if fullName != "" {
		return fullName
	}
	if user.Username != "" {
		return user.Username
	}
	return user.Email
}

func describeActivity(eventType string, payload map[string]interface{}) string {
	switch eventType {
	case "drop_upload":
		if count, ok := payload["count"].(float64); ok && count > 1 {
			if linkName, ok := payload["link_name"].(string); ok && linkName != "" {
				return fmt.Sprintf("Received %.0f files via %s", count, linkName)
			}
			return fmt.Sprintf("Received %.0f files via secure drop", count)
		}
		if filename, ok := payload["filename"].(string); ok && filename != "" {
			return fmt.Sprintf("Received %s via secure drop", filename)
		}
		return "New files received via secure drop"
	case "file_shared":
		filename, _ := payload["filename"].(string)
		recipientName, _ := payload["recipient_name"].(string)
		recipientEmail, _ := payload["recipient_email"].(string)
		target := recipientName
		if target == "" {
			target = recipientEmail
		}
		if filename != "" && target != "" {
			return fmt.Sprintf("Shared %s with %s", filename, target)
		}
		if target != "" {
			return fmt.Sprintf("Shared a file with %s", target)
		}
		return "Shared a file"
	case "file_received":
		filename, _ := payload["filename"].(string)
		if filename != "" {
			return fmt.Sprintf("%s was shared with you", filename)
		}
		return "A file was shared with you"
	default:
		return strings.ReplaceAll(eventType, "_", " ")
	}
}

func (cfg *ApiConfig) logActivity(ctx context.Context, userID uuid.UUID, eventType string, payload interface{}) {
	entry := database.InsertActivityParams{
		UserID:    userID,
		EventType: eventType,
	}

	if payload != nil {
		rawPayload, err := json.Marshal(payload)
		if err != nil {
			log.Printf("logActivity: failed to marshal payload for %s: %v", eventType, err)
			return
		}
		entry.Payload = pqtype.NullRawMessage{RawMessage: rawPayload, Valid: true}
	}

	if err := cfg.dbQueries.InsertActivity(ctx, entry); err != nil {
		log.Printf("logActivity: failed to insert %s activity: %v", eventType, err)
	}
}

func (cfg *ApiConfig) handlerGetActivity(w http.ResponseWriter, r *http.Request, user database.User) {
	activities, err := cfg.dbQueries.GetRecentActivitiesForUser(r.Context(), user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not load activity", err)
		return
	}

	response := make([]activityResponse, 0, len(activities))
	for _, activity := range activities {
		payload := map[string]interface{}{}
		if activity.Payload.Valid && len(activity.Payload.RawMessage) > 0 {
			if err := json.Unmarshal(activity.Payload.RawMessage, &payload); err != nil {
				log.Printf("handlerGetActivity: failed to unmarshal payload for %s: %v", activity.EventType, err)
				payload = map[string]interface{}{}
			}
		}

		response = append(response, activityResponse{
			ID:        activity.ID.String(),
			EventType: activity.EventType,
			Message:   describeActivity(activity.EventType, payload),
			Payload:   payload,
			CreatedAt: activity.CreatedAt.Format(time.RFC3339),
		})
	}

	respondWithJSON(w, http.StatusOK, response)
}
