package main

import (
	"net/http"

	"github.com/google/uuid"
)

type apiV1Meta struct {
	RequestID string      `json:"request_id"`
	Pagination interface{} `json:"pagination,omitempty"`
}

type apiV1Response struct {
	Success bool      `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   interface{} `json:"error,omitempty"`
	Meta    apiV1Meta `json:"meta"`
}

func ensureRequestID(w http.ResponseWriter, r *http.Request) string {
	if existing := r.Header.Get("X-Request-Id"); existing != "" {
		w.Header().Set("X-Request-Id", existing)
		return existing
	}
	requestID := uuid.NewString()
	w.Header().Set("X-Request-Id", requestID)
	return requestID
}

func respondWithV1(w http.ResponseWriter, r *http.Request, code int, payload interface{}, pagination interface{}) {
	respondWithJSON(w, code, apiV1Response{
		Success: code < http.StatusBadRequest,
		Data:    payload,
		Meta: apiV1Meta{
			RequestID: ensureRequestID(w, r),
			Pagination: pagination,
		},
	})
}

func respondWithV1Error(w http.ResponseWriter, r *http.Request, code int, msg string) {
	respondWithJSON(w, code, apiV1Response{
		Success: false,
		Error: map[string]string{
			"message": msg,
		},
		Meta: apiV1Meta{
			RequestID: ensureRequestID(w, r),
		},
	})
}
