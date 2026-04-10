package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type collectionTemplate struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Description    *string   `json:"description,omitempty"`
	DefaultMessage *string   `json:"default_message,omitempty"`
	ChecklistItems []string  `json:"checklist_items"`
	BrandingTag    *string   `json:"branding_tag,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (cfg *ApiConfig) handlerListCollectionTemplates(w http.ResponseWriter, r *http.Request, user database.User) {
	rows, err := cfg.db.QueryContext(r.Context(),
		`SELECT id::text, name, description, default_message, checklist_items, branding_tag, created_at, updated_at
		 FROM upload_link_templates
		 WHERE user_id = $1
		 ORDER BY created_at DESC
		 LIMIT 100`, user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not list templates", err)
		return
	}
	defer rows.Close()

	templates := []collectionTemplate{}
	for rows.Next() {
		var t collectionTemplate
		var checklistRaw json.RawMessage
		var desc, msg, branding *string
		if err := rows.Scan(&t.ID, &t.Name, &desc, &msg, &checklistRaw, &branding, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		t.Description = desc
		t.DefaultMessage = msg
		t.BrandingTag = branding
		t.ChecklistItems = parseStringSlice(checklistRaw)
		templates = append(templates, t)
	}
	respondWithJSON(w, http.StatusOK, templates)
}

func (cfg *ApiConfig) handlerCreateCollectionTemplate(w http.ResponseWriter, r *http.Request, user database.User) {
	var body struct {
		Name           string   `json:"name"`
		Description    *string  `json:"description"`
		DefaultMessage *string  `json:"default_message"`
		ChecklistItems []string `json:"checklist_items"`
		BrandingTag    *string  `json:"branding_tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		respondWithError(w, http.StatusBadRequest, "name is required", nil)
		return
	}

	checklistJSON, _ := json.Marshal(body.ChecklistItems)

	var t collectionTemplate
	var checklistRaw json.RawMessage
	var desc, msg, branding *string
	err := cfg.db.QueryRowContext(r.Context(),
		`INSERT INTO upload_link_templates (user_id, name, description, default_message, checklist_items, branding_tag)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id::text, name, description, default_message, checklist_items, branding_tag, created_at, updated_at`,
		user.ID, body.Name, body.Description, body.DefaultMessage, checklistJSON, body.BrandingTag,
	).Scan(&t.ID, &t.Name, &desc, &msg, &checklistRaw, &branding, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not create template", err)
		return
	}
	t.Description = desc
	t.DefaultMessage = msg
	t.BrandingTag = branding
	t.ChecklistItems = parseStringSlice(checklistRaw)
	respondWithJSON(w, http.StatusCreated, t)
}

func (cfg *ApiConfig) handlerUpdateCollectionTemplate(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	if _, err := uuid.Parse(idStr); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID", nil)
		return
	}

	var body struct {
		Name           string   `json:"name"`
		Description    *string  `json:"description"`
		DefaultMessage *string  `json:"default_message"`
		ChecklistItems []string `json:"checklist_items"`
		BrandingTag    *string  `json:"branding_tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		respondWithError(w, http.StatusBadRequest, "name is required", nil)
		return
	}

	checklistJSON, _ := json.Marshal(body.ChecklistItems)

	var t collectionTemplate
	var checklistRaw json.RawMessage
	var desc, msg, branding *string
	err := cfg.db.QueryRowContext(r.Context(),
		`UPDATE upload_link_templates
		 SET name=$3, description=$4, default_message=$5, checklist_items=$6, branding_tag=$7, updated_at=NOW()
		 WHERE id=$1 AND user_id=$2
		 RETURNING id::text, name, description, default_message, checklist_items, branding_tag, created_at, updated_at`,
		idStr, user.ID, body.Name, body.Description, body.DefaultMessage, checklistJSON, body.BrandingTag,
	).Scan(&t.ID, &t.Name, &desc, &msg, &checklistRaw, &branding, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		respondWithError(w, http.StatusNotFound, "Template not found", err)
		return
	}
	t.Description = desc
	t.DefaultMessage = msg
	t.BrandingTag = branding
	t.ChecklistItems = parseStringSlice(checklistRaw)
	respondWithJSON(w, http.StatusOK, t)
}

func (cfg *ApiConfig) handlerDeleteCollectionTemplate(w http.ResponseWriter, r *http.Request, user database.User) {
	idStr := r.PathValue("id")
	if _, err := uuid.Parse(idStr); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid template ID", nil)
		return
	}

	res, err := cfg.db.ExecContext(r.Context(),
		`DELETE FROM upload_link_templates WHERE id=$1 AND user_id=$2`, idStr, user.ID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not delete template", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		respondWithError(w, http.StatusNotFound, "Template not found", nil)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// parseStringSlice safely decodes a JSONB []string; returns empty slice on error.
func parseStringSlice(raw json.RawMessage) []string {
	if raw == nil {
		return []string{}
	}
	var s []string
	if err := json.Unmarshal(raw, &s); err != nil {
		return []string{}
	}
	return s
}
