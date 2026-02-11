package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync/atomic"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type ApiConfig struct {
	apiHits   atomic.Int32
	dbQueries *database.Queries
	jwtSecret string
}

func (cfg *ApiConfig) middlewareMetricsInc(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s - User-Agent: %s", r.Method, r.URL.String(), r.UserAgent())
		cfg.apiHits.Add(1)
		next.ServeHTTP(w, r)
	})
}

func middlewareCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "X-File-Metadata, X-Wrapped-Key")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {

	godotenv.Load()

	dbURL := os.Getenv("DB_URL")

	fmt.Printf("Database URL: %s...\n", dbURL[:12])

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		fmt.Printf("Error connecting to the database: %v\n", err)
		return
	}
	defer db.Close()

	apiConfig := ApiConfig{apiHits: atomic.Int32{}, dbQueries: database.New(db)}

	fmt.Println("Connected to the database successfully.")

	mux := http.NewServeMux()

	mux.Handle("GET /api/healthz", apiConfig.middlewareMetricsInc(http.HandlerFunc(healthCheckHandler)))

	mux.HandleFunc("DELETE /api/upload-links/{id}", apiConfig.handlerDeleteDropToken)

	mux.Handle("POST /api/register", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.registerUserHandler)))

	mux.Handle("POST /api/login", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerLogin)))

	mux.Handle("GET /api/user-by-username", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.getUserByUsernameHandler)))

	mux.Handle("GET /api/user-by-email", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.getUserByEmailHandler)))

	mux.Handle("GET /api/user/public-key", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerGetPublicKey)))

	mux.Handle("GET /api/folders", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handleListFolders)))

	mux.Handle("POST /api/folders", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handleCreateFolder)))

	mux.Handle("POST /api/drop/create", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerCreateDropToken)))

	mux.Handle("GET /api/drop/tokens", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerListDropTokens)))

	mux.HandleFunc("GET /api/drop/{token}", apiConfig.handlerDropTokenInfo)
	mux.HandleFunc("GET /api/drop/{token}/owner-info", apiConfig.handlerDropOwnerInfo)
	mux.HandleFunc("GET /api/drop/{token}/files", apiConfig.handlerDropTokenFiles)
	mux.HandleFunc("POST /api/drop/{token}/upload", apiConfig.handlerDropUpload)
	mux.HandleFunc("POST /api/drop/{token}/done", apiConfig.handlerDropDone)

	mux.Handle("POST /api/files/upload", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerCreateFiles)))

	mux.Handle("GET /api/files/{id}/download", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerDownloadFile)))

	mux.Handle("POST /api/files/{id}/share", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerShareFile)))

	mux.Handle("GET /api/files/{id}/shares", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerListFileShares)))

	mux.Handle("DELETE /api/files/{id}/revoke/{user_id}", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerRevokeFileAccess)))

	mux.Handle("GET /api/files", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerListFiles)))

	mux.Handle("GET /api/files/shared", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerListSharedFiles)))

	mux.Handle("DELETE /api/files/{id}", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerDeleteFile)))

	fmt.Printf("Starting server on port %s...\n", port)

	// SPA catch-all handler - must be registered AFTER API routes
	// Handles any non-API route that doesn't match file
	mux.HandleFunc("GET /{path...}", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "" || path == "/" {
			path = "/index.html"
		}

		// Try to serve actual file if it exists
		filePath := "vaultdrive_client/dist" + path
		if _, err := os.Stat(filePath); err == nil {
			http.ServeFile(w, r, filePath)
			return
		}

		// SPA catch-all: serve index.html for all client-side routes
		http.ServeFile(w, r, "vaultdrive_client/dist/index.html")
	})

	log.Printf("Server listening on port %s", port)
	err = http.ListenAndServe(":"+port, middlewareCORS(mux))
	if err != nil {
		log.Fatalf("Error starting server: %v\n", err)
	}

}

func healthCheckHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	response := map[string]string{
		"status": "ok",
	}
	json.NewEncoder(w).Encode(response)
}
