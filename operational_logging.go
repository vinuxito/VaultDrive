package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net"
	"net/http"

	"github.com/lib/pq"
)

type requestIDContextKey struct{}

func operationalRequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDContextKey{}).(string)
	return id
}

// Classification deliberately excludes error strings: drivers may include SQL,
// user input, connection credentials, stored paths or encrypted key material.
func operationalErrorClass(err error) string {
	switch {
	case err == nil:
		return "response"
	case errors.Is(err, context.Canceled):
		return "cancelled"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.Is(err, sql.ErrNoRows):
		return "not_found"
	}
	var databaseError *pq.Error
	if errors.As(err, &databaseError) {
		return "database"
	}
	var networkError net.Error
	if errors.As(err, &networkError) {
		return "network"
	}
	return "internal"
}

func logResponseFailure(w http.ResponseWriter, status int, err error) {
	if err == nil && status < 500 {
		return
	}
	log.Printf("event=response_error status=%d request_id=%q error_class=%s", status, w.Header().Get("X-Request-Id"), operationalErrorClass(err))
}
