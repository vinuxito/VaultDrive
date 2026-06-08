package main

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type syncAction struct {
	Type       string    `json:"type"`        // "rename" or "delete"
	FileID     string    `json:"file_id"`     // UUID of the file
	Filename   string    `json:"filename"`    // new filename if rename
	ParentHash string    `json:"parent_hash"` // expected parent hash before change
	NewHash    string    `json:"new_hash"`    // new parent hash after change
	UpdatedAt  time.Time `json:"updated_at"`
}

type syncResult struct {
	FileID   string `json:"file_id"`
	Success  bool   `json:"success"`
	Conflict bool   `json:"conflict"`
	Error    string `json:"error,omitempty"`
	// Current server state if conflict
	Filename   string `json:"filename,omitempty"`
	ParentHash string `json:"parent_hash,omitempty"`
}

func (cfg *ApiConfig) handlerFilesSync(w http.ResponseWriter, r *http.Request, user database.User) {
	var payload struct {
		Actions []syncAction `json:"actions"`
	}

	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	results := make([]syncResult, 0, len(payload.Actions))

	for _, action := range payload.Actions {
		fileID, err := uuid.Parse(action.FileID)
		if err != nil {
			results = append(results, syncResult{
				FileID:  action.FileID,
				Success: false,
				Error:   "Invalid file ID format",
			})
			continue
		}

		dbFile, err := cfg.dbQueries.GetFileByID(r.Context(), fileID)
		if err != nil {
			results = append(results, syncResult{
				FileID:  action.FileID,
				Success: false,
				Error:   "File not found or access denied",
			})
			continue
		}

		// Security: verify owner
		if dbFile.OwnerID.UUID != user.ID {
			results = append(results, syncResult{
				FileID:  action.FileID,
				Success: false,
				Error:   "Access denied",
			})
			continue
		}

		// Check conflict: Compare current parent_hash in DB with the expected one
		currentHash := dbFile.ParentHash.String
		if action.ParentHash != currentHash {
			// Conflict detected!
			results = append(results, syncResult{
				FileID:     action.FileID,
				Success:    false,
				Conflict:   true,
				Filename:   dbFile.Filename,
				ParentHash: currentHash,
				Error:      "Version conflict: parent version mismatch",
			})
			continue
		}

		if action.Type == "rename" {
			if action.Filename == "" {
				results = append(results, syncResult{
					FileID:  action.FileID,
					Success: false,
					Error:   "Filename is required for rename",
				})
				continue
			}

			// Update file filename in database
			_, err = cfg.dbQueries.UpdateFile(r.Context(), database.UpdateFileParams{
				ID:                 dbFile.ID,
				Filename:           action.Filename,
				FilePath:           dbFile.FilePath,
				FileSize:           dbFile.FileSize,
				EncryptedMetadata:  dbFile.EncryptedMetadata,
				CurrentKeyVersion:  dbFile.CurrentKeyVersion,
				UpdatedAt:          time.Now().UTC(),
			})
			if err != nil {
				log.Printf("ERROR: failed to update file name during sync: %v", err)
				results = append(results, syncResult{
					FileID:  action.FileID,
					Success: false,
					Error:   "Database update failed",
				})
				continue
			}

			// Update parent_hash
			err = cfg.dbQueries.UpdateFileParentHash(r.Context(), database.UpdateFileParentHashParams{
				ID: dbFile.ID,
				ParentHash: sql.NullString{
					String: action.NewHash,
					Valid:  action.NewHash != "",
				},
				UpdatedAt: time.Now().UTC(),
			})
			if err != nil {
				log.Printf("ERROR: failed to update parent_hash during sync: %v", err)
				results = append(results, syncResult{
					FileID:  action.FileID,
					Success: false,
					Error:   "Failed to update version hash",
				})
				continue
			}

			cfg.insertAudit(r.Context(), user.ID, "file.renamed", "file", &dbFile.ID, map[string]interface{}{
				"filename": dbFile.Filename,
				"new_name": action.Filename,
			}, r)

			results = append(results, syncResult{
				FileID:  action.FileID,
				Success: true,
			})

		} else if action.Type == "delete" {
			err = cfg.dbQueries.DeleteFile(r.Context(), dbFile.ID)
			if err != nil {
				log.Printf("ERROR: failed to delete file during sync: %v", err)
				results = append(results, syncResult{
					FileID:  action.FileID,
					Success: false,
					Error:   "Failed to delete file entry",
				})
				continue
			}

			cfg.insertAudit(r.Context(), user.ID, "file.deleted", "file", &dbFile.ID, map[string]interface{}{
				"filename": dbFile.Filename,
			}, r)

			results = append(results, syncResult{
				FileID:  action.FileID,
				Success: true,
			})
		} else {
			results = append(results, syncResult{
				FileID:  action.FileID,
				Success: false,
				Error:   "Unknown action type",
			})
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"results": results,
	})
}
