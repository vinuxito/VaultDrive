package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/vinuxito/VaultDrive/internal/database"
)

type apiV1Meta struct {
	RequestID  string      `json:"request_id"`
	Pagination interface{} `json:"pagination,omitempty"`
}

type apiV1Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   interface{} `json:"error,omitempty"`
	Meta    apiV1Meta   `json:"meta"`
}

func ensureRequestID(w http.ResponseWriter, r *http.Request) string {
	if existing := w.Header().Get("X-Request-Id"); existing != "" {
		if _, err := uuid.Parse(existing); err == nil {
			return existing
		}
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
			RequestID:  ensureRequestID(w, r),
			Pagination: pagination,
		},
	})
}

func defaultV1ErrorCode(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "bad_request"
	case http.StatusUnauthorized:
		return "unauthorized"
	case http.StatusForbidden:
		return "forbidden"
	case http.StatusNotFound:
		return "not_found"
	case http.StatusConflict:
		return "conflict"
	case http.StatusRequestEntityTooLarge:
		return "payload_too_large"
	case http.StatusTooManyRequests:
		return "rate_limited"
	case http.StatusServiceUnavailable:
		return "service_unavailable"
	default:
		if status >= 500 {
			return "internal_error"
		}
		return "request_failed"
	}
}

func respondWithV1ErrorCode(w http.ResponseWriter, r *http.Request, code int, errCode string, msg string) {
	if strings.TrimSpace(errCode) == "" {
		errCode = defaultV1ErrorCode(code)
	}
	respondWithJSON(w, code, apiV1Response{
		Success: false,
		Error: map[string]string{
			"code":    errCode,
			"message": msg,
		},
		Meta: apiV1Meta{
			RequestID: ensureRequestID(w, r),
		},
	})
}

func respondWithV1Error(w http.ResponseWriter, r *http.Request, code int, msg string) {
	respondWithV1ErrorCode(w, r, code, defaultV1ErrorCode(code), msg)
}

type v1ResponseCapture struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func newV1ResponseCapture() *v1ResponseCapture {
	return &v1ResponseCapture{
		header: make(http.Header),
		status: http.StatusOK,
	}
}

func (c *v1ResponseCapture) Header() http.Header {
	return c.header
}

func (c *v1ResponseCapture) WriteHeader(code int) {
	c.status = code
}

func (c *v1ResponseCapture) Write(b []byte) (int, error) {
	return c.body.Write(b)
}

func (cfg *ApiConfig) wrapV1JSON(next authedHandler) authedHandler {
	return func(w http.ResponseWriter, r *http.Request, user database.User) {
		capW := newV1ResponseCapture()
		next(capW, r, user)

		for k, vals := range capW.header {
			lk := strings.ToLower(k)
			if lk == "content-type" || lk == "content-length" {
				continue
			}
			for _, v := range vals {
				w.Header().Add(k, v)
			}
		}

		ct := strings.ToLower(capW.header.Get("Content-Type"))
		raw := bytes.TrimSpace(capW.body.Bytes())

		if ct != "" && !strings.Contains(ct, "application/json") {
			w.Header().Set("Content-Type", capW.header.Get("Content-Type"))
			ensureRequestID(w, r)
			w.WriteHeader(capW.status)
			_, _ = w.Write(capW.body.Bytes())
			return
		}

		if len(raw) == 0 {
			if capW.status >= 400 {
				respondWithV1Error(w, r, capW.status, http.StatusText(capW.status))
				return
			}
			statusOut := capW.status
			if statusOut == http.StatusNoContent {
				statusOut = http.StatusOK
			}
			respondWithV1(w, r, statusOut, map[string]bool{"ok": true}, nil)
			return
		}

		var objCheck map[string]interface{}
		if err := json.Unmarshal(raw, &objCheck); err == nil {
			if _, hasSuccess := objCheck["success"]; hasSuccess {
				if _, hasMeta := objCheck["meta"]; hasMeta {
					w.Header().Set("Content-Type", "application/json")
					ensureRequestID(w, r)
					w.WriteHeader(capW.status)
					_, _ = w.Write(raw)
					return
				}
			}
		}

		if capW.status >= 400 {
			msg := "Request failed"
			if objCheck != nil {
				if e, ok := objCheck["error"].(string); ok && e != "" {
					msg = e
				} else if m, ok := objCheck["message"].(string); ok && m != "" {
					msg = m
				}
			}
			respondWithV1Error(w, r, capW.status, msg)
			return
		}

		var parsed interface{}
		if err := json.Unmarshal(raw, &parsed); err != nil {
			w.Header().Set("Content-Type", "application/json")
			ensureRequestID(w, r)
			w.WriteHeader(capW.status)
			_, _ = w.Write(raw)
			return
		}
		respondWithV1(w, r, capW.status, parsed, nil)
	}
}

func (cfg *ApiConfig) wrapV1ForAgentKey(next authedHandler) authedHandler {
	return func(w http.ResponseWriter, r *http.Request, user database.User) {
		if actor, ok := actorFromContext(r.Context()); ok && actor != nil && actor.AuthType == "agent_api_key" {
			cfg.wrapV1JSON(next)(w, r, user)
			return
		}
		next(w, r, user)
	}
}
