package main

import (
	"net/http"

	"github.com/vinuxito/VaultDrive/internal/messages"
)

func (cfg *ApiConfig) middlewareAcceptLanguage(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		acceptLang := r.Header.Get("Accept-Language")
		lang := "en" // Default

		if len(acceptLang) >= 2 {
			lang = acceptLang[:2]
		}

		ctx := messages.WithLanguage(r.Context(), lang)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
