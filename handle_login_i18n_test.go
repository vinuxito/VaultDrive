package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestI18nLoginErrors(t *testing.T) {
	apiCfg := &ApiConfig{}
	
	// Create a dummy router just to test the handler
	mux := http.NewServeMux()
	mux.Handle("/api/login", apiCfg.middlewareAcceptLanguage(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Just call respondWithErrorCtx with the error key to simulate invalid credentials
		respondWithErrorCtx(r, w, http.StatusUnauthorized, "ErrInvalidCredentials", nil)
	})))

	tests := []struct {
		name           string
		acceptLang     string
		expectedOutput string
	}{
		{
			name:           "English default",
			acceptLang:     "",
			expectedOutput: `{"error":"Login failed. Please check your email and password."}`,
		},
		{
			name:           "Spanish",
			acceptLang:     "es-MX",
			expectedOutput: `{"error":"Error al iniciar sesión. Verifica tu correo y contraseña."}`,
		},
		{
			name:           "Unknown language falls back to English",
			acceptLang:     "fr",
			expectedOutput: `{"error":"Login failed. Please check your email and password."}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("POST", "/api/login", bytes.NewBuffer([]byte(`{}`)))
			if tt.acceptLang != "" {
				req.Header.Set("Accept-Language", tt.acceptLang)
			}

			rr := httptest.NewRecorder()
			mux.ServeHTTP(rr, req)

			if rr.Code != http.StatusUnauthorized {
				t.Errorf("expected status %d, got %d", http.StatusUnauthorized, rr.Code)
			}

			// read body and trim newlines
			body := bytes.TrimSpace(rr.Body.Bytes())
			if string(body) != tt.expectedOutput {
				t.Errorf("expected %s, got %s", tt.expectedOutput, body)
			}
		})
	}
}
