package main

import (
	"context"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
)

// A completed server stream does not prove that a recipient saved or read a file.
// The bounded detached audit survives client cancellation; it never appends JSON
// to a partially written ciphertext response.
func (cfg *ApiConfig) streamDownload(w http.ResponseWriter, r *http.Request, file *os.File, ownerID, fileID uuid.UUID, metadata map[string]interface{}) {
	requestID := ensureRequestID(w, r)
	r = r.WithContext(context.WithValue(r.Context(), requestIDContextKey{}, requestID))
	info, err := file.Stat()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Stored file information is unavailable", err)
		return
	}
	written, streamErr := io.Copy(w, file)
	action := "file.downloaded"
	if streamErr != nil || written != info.Size() || r.Context().Err() != nil {
		action = "file.download_interrupted"
		if streamErr == nil {
			streamErr = r.Context().Err()
		}
		log.Printf("event=download_interrupted request_id=%s bytes=%d expected=%d error_class=%s", requestID, written, info.Size(), operationalErrorClass(streamErr))
	}
	metadata["bytes_streamed"] = written
	metadata["expected_bytes"] = info.Size()
	metadata["delivery_scope"] = "server_stream"
	ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 2*time.Second)
	defer cancel()
	cfg.insertAudit(ctx, ownerID, action, "file", &fileID, metadata, r)
}
