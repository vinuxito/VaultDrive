package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func (cfg *ApiConfig) handlerCreateFiles(w http.ResponseWriter, r *http.Request) {

	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Missing or invalid token", err)
		return
	}

	ownerID, err := auth.ValidateJWT(token, cfg.jwtSecret)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, "Invalid token", err)
		return
	}

	// Parse multipart form (max 10 MB)
	err = r.ParseMultipartForm(10 << 20)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Could not parse multipart form", err)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Error retrieving the file", err)
		return
	}
	defer file.Close()

	// Create uploads directory if it doesn't exist
	uploadDir := "uploads"
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		err = os.Mkdir(uploadDir, 0755)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Could not create uploads directory", err)
			return
		}
	}

	// Generate a unique filename to prevent overwriting
	filename := uuid.New().String() + filepath.Ext(handler.Filename)
	filePath := filepath.Join(uploadDir, filename)

	// Create the file on the server
	dst, err := os.Create(filePath)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not create file on server", err)
		return
	}
	defer dst.Close()

	// Copy the uploaded file to the destination file
	if _, err := io.Copy(dst, file); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Could not save file", err)
		return
	}

	// Extract encryption metadata
	credentialScheme := r.FormValue("credential_scheme")
	if credentialScheme == "" {
		credentialScheme = "password"
	}
	metadata := map[string]string{
		"iv":                r.FormValue("iv"),
		"salt":              r.FormValue("salt"),
		"algorithm":         r.FormValue("algorithm"),
		"credential_scheme": credentialScheme,
	}

	wrappedKey := r.FormValue("wrapped_key")
	if wrappedKey == "" {
		os.Remove(filePath)
		respondWithError(w, http.StatusBadRequest, "wrapped_key is required", nil)
		return
	}

	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		os.Remove(filePath)
		respondWithError(w, http.StatusInternalServerError, "Error processing metadata", err)
		return
	}

	dbfile, err := cfg.dbQueries.CreateFile(r.Context(), database.CreateFileParams{
		OwnerID:           uuid.NullUUID{UUID: ownerID, Valid: true},
		Filename:          handler.Filename,
		FilePath:          filePath,
		FileSize:          handler.Size,
		EncryptedMetadata: sql.NullString{String: string(metadataJSON), Valid: true},
		CurrentKeyVersion: sql.NullInt32{Int32: 1, Valid: true},
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
		DropSourceID:      uuid.NullUUID{},
	})

	if err != nil {
		// If DB insert fails, we should probably delete the uploaded file
		os.Remove(filePath)
		respondWithError(w, http.StatusInternalServerError, "Could not create file entry", err)
		return
	}

	// Save the wrapped key for the owner
	_, err = cfg.dbQueries.CreateFileAccessKey(r.Context(), database.CreateFileAccessKeyParams{
		FileID:     uuid.NullUUID{UUID: dbfile.ID, Valid: true},
		UserID:     uuid.NullUUID{UUID: ownerID, Valid: true},
		WrappedKey: wrappedKey,
	})

	if err != nil {
		// Rollback: delete file and DB entry
		os.Remove(filePath)
		cfg.dbQueries.DeleteFile(r.Context(), dbfile.ID)
		respondWithError(w, http.StatusInternalServerError, "Could not save file access key", err)
		return
	}
	cfg.insertActivity(r.Context(), ownerID, "file_upload", map[string]interface{}{
		"file_id":   dbfile.ID.String(),
		"filename":  dbfile.Filename,
		"file_size": dbfile.FileSize,
	})
	cfg.insertAudit(r.Context(), ownerID, "file.uploaded", "file", &dbfile.ID, map[string]interface{}{
		"filename":  dbfile.Filename,
		"file_size": dbfile.FileSize,
	}, r)

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"file_name":  dbfile.Filename,
		"file_path":  dbfile.FilePath,
		"file_id":    dbfile.ID,
		"owner_id":   dbfile.OwnerID,
		"created_at": dbfile.CreatedAt,
		"updated_at": dbfile.UpdatedAt,
		"metadata":   dbfile.EncryptedMetadata.String,
	})

}
