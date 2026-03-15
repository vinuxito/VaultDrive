package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

type ApiConfig struct {
	apiHits   atomic.Int32
	dbQueries *database.Queries
	db        *sql.DB
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
	allowed := os.Getenv("CORS_ALLOWED_ORIGINS")
	if allowed == "" {
		allowed = "https://dev-app.filemonprime.net,https://abrndrive.filemonprime.net,http://localhost:5173,http://localhost:8082"
	}
	origins := strings.Split(allowed, ",")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowOrigin := ""
		for _, o := range origins {
			if strings.TrimSpace(o) == origin {
				allowOrigin = origin
				break
			}
		}
		if allowOrigin == "" && origin == "" {
			allowOrigin = origins[0]
		}
		w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "X-File-Metadata, X-Wrapped-Key, X-File-Name")

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

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET environment variable is required")
	}

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

	apiConfig := ApiConfig{
		apiHits:   atomic.Int32{},
		dbQueries: database.New(db),
		db:        db,
		jwtSecret: jwtSecret,
	}

	fmt.Println("Connected to the database successfully.")

	mux := http.NewServeMux()

	mux.Handle("GET /api/healthz", apiConfig.middlewareMetricsInc(http.HandlerFunc(healthCheckHandler)))

	mux.HandleFunc("DELETE /api/upload-links/{id}", apiConfig.handlerDeleteDropToken)

	mux.Handle("POST /api/register", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.registerUserHandler)))

	mux.Handle("POST /api/login", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerLogin)))

	mux.Handle("GET /api/user-by-username",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.getUserByUsernameHandler)))

	mux.Handle("GET /api/user-by-email",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.getUserByEmailHandler)))

	mux.Handle("GET /api/user/public-key", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerGetPublicKey)))

	mux.Handle("GET /api/users/{userId}/public-key", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerGetPublicKeyByID)))

	mux.Handle("GET /api/folders", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handleListFolders)))
	mux.Handle("GET /api/v1/folders",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("folders:read")(apiConfig.handlerV1ListFolders)))

	mux.Handle("POST /api/folders", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handleCreateFolder)))
	mux.Handle("POST /api/v1/folders",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("folders:write")(apiConfig.handlerV1CreateFolder)))

	mux.Handle("PUT /api/folders/{id}", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handleUpdateFolder)))
	mux.Handle("PUT /api/v1/folders/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("folders:write")(apiConfig.handlerV1UpdateFolder)))

	mux.Handle("DELETE /api/folders/{id}", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handleDeleteFolder)))
	mux.Handle("DELETE /api/v1/folders/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("folders:write")(apiConfig.handlerV1DeleteFolder)))

	mux.Handle("POST /api/drop/create", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerCreateDropToken)))

	mux.Handle("GET /api/drop/tokens", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerListDropTokens)))

	mux.HandleFunc("GET /api/drop/{token}", apiConfig.handlerDropTokenInfo)
	mux.HandleFunc("GET /api/drop/{token}/owner-info", apiConfig.handlerDropOwnerInfo)
	mux.HandleFunc("GET /api/drop/{token}/files", apiConfig.handlerDropTokenFiles)
	mux.HandleFunc("POST /api/drop/{token}/upload", apiConfig.handlerDropUpload)
	mux.HandleFunc("POST /api/drop/{token}/done", apiConfig.handlerDropDone)

	mux.Handle("POST /api/files/upload", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerCreateFiles)))
	mux.Handle("POST /api/v1/files/upload",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("files:upload_ciphertext")(apiConfig.handlerV1CreateFile)))

	mux.Handle("GET /api/files/{id}/download", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerDownloadFile)))
	mux.Handle("GET /api/v1/files/{id}/download",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("files:download_ciphertext")(apiConfig.handlerV1DownloadFile)))

	mux.Handle("POST /api/files/{id}/share", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerShareFile)))

	mux.Handle("GET /api/files/{id}/shares", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerListFileShares)))

	mux.Handle("DELETE /api/files/{id}/revoke/{user_id}", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerRevokeFileAccess)))

	mux.Handle("GET /api/files", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerListFiles)))
	mux.Handle("GET /api/v1/files",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("files:list")(apiConfig.handlerV1ListFiles)))
	mux.Handle("GET /api/v1/files/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("files:read_metadata")(apiConfig.handlerV1GetFileMetadata)))

	mux.Handle("GET /api/files/shared", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerListSharedFiles)))

	mux.Handle("DELETE /api/files/{id}", apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.handlerDeleteFile)))

	// Groups CRUD
	mux.Handle("GET /api/groups",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.getGroupsHandler)))

	mux.Handle("POST /api/groups",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.createGroupHandler)))

	mux.Handle("GET /api/groups/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.getGroupHandler)))

	mux.Handle("PUT /api/groups/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.updateGroupHandler)))

	mux.Handle("DELETE /api/groups/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.deleteGroupHandler)))

	// Group Members
	mux.Handle("GET /api/groups/{id}/members",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.getGroupMembersHandler)))

	mux.Handle("POST /api/groups/{id}/members",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.addGroupMemberHandler)))

	mux.Handle("DELETE /api/groups/{id}/members/{userId}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.removeGroupMemberHandler)))

	// Group Files
	mux.Handle("GET /api/groups/{id}/files",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.getGroupFilesHandler)))

	mux.Handle("POST /api/groups/{id}/files",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.shareFileToGroupHandler)))

	mux.Handle("DELETE /api/groups/{id}/files/{fileId}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.removeFileFromGroupHandler)))

	// User Search (for adding members)
	mux.Handle("GET /api/users/search",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.searchUsersHandler)))

	mux.Handle("POST /api/users/pin",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerSetUserPIN)))
	mux.Handle("GET /api/users/pin/status",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerGetPINStatus)))

	mux.Handle("GET /api/users/me",
		apiConfig.middlewareMetricsInc(http.HandlerFunc(apiConfig.getUserMeHandler)))

	mux.Handle("PUT /api/users/organization",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerUpdateOrganization)))

	mux.Handle("POST /api/files/{fileId}/share-link",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerCreatePublicShareLink)))

	mux.HandleFunc("GET /api/share/{token}/info", apiConfig.handlerGetPublicShareLinkInfo)
	mux.HandleFunc("GET /api/share/{token}", apiConfig.handlerGetPublicShareLinkFile)

	mux.Handle("GET /api/files/{fileId}/share-links",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerListPublicShareLinks)))

	mux.Handle("DELETE /api/share-links/{linkId}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerRevokePublicShareLink)))

	mux.Handle("POST /api/file-requests",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerCreateFileRequest)))
	mux.Handle("GET /api/file-requests",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerListFileRequests)))
	mux.Handle("DELETE /api/file-requests/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerRevokeFileRequest)))
	mux.HandleFunc("GET /api/file-requests/{token}/info", apiConfig.handlerGetFileRequestInfo)
	mux.HandleFunc("POST /api/file-requests/{token}/upload", apiConfig.handlerFileRequestUpload)

	mux.Handle("GET /api/activity",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerGetActivity)))
	mux.Handle("GET /api/v1/activity",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("activity:read")(apiConfig.handlerGetActivity)))

	mux.Handle("GET /api/security-posture",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerGetSecurityPosture)))

	mux.Handle("GET /api/files/{id}/access-summary",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerGetFileAccessSummary)))
	mux.Handle("GET /api/v1/files/{id}/access-summary",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("trust:read")(apiConfig.handlerGetFileAccessSummary)))
	mux.Handle("GET /api/v1/files/{id}/trust",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("trust:read")(apiConfig.handlerGetFileTrustSummary)))
	mux.Handle("GET /api/v1/files/{id}/timeline",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("trust:read")(apiConfig.handlerGetFileSecurityTimeline)))

	mux.Handle("DELETE /api/files/{id}/revoke-external",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareAuth(apiConfig.handlerRevokeAllExternalAccess)))
	mux.Handle("DELETE /api/v1/files/{id}/revoke-external",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("shares:revoke")(apiConfig.handlerRevokeAllExternalAccess)))

	mux.Handle("GET /api/v1/files/{fileId}/share-links",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("shares:list")(apiConfig.handlerListPublicShareLinks)))
	mux.Handle("POST /api/v1/files/{fileId}/share-link",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("shares:create")(apiConfig.handlerCreatePublicShareLink)))
	mux.Handle("DELETE /api/v1/share-links/{linkId}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("shares:revoke")(apiConfig.handlerRevokePublicShareLink)))

	mux.Handle("GET /api/v1/file-requests",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("requests:list")(apiConfig.handlerListFileRequests)))
	mux.Handle("POST /api/v1/file-requests",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("requests:create")(apiConfig.handlerCreateFileRequest)))
	mux.Handle("DELETE /api/v1/file-requests/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("requests:revoke")(apiConfig.handlerRevokeFileRequest)))

	mux.Handle("GET /api/v1/agent-keys",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("api_keys:read")(apiConfig.handlerListAgentAPIKeys)))
	mux.Handle("POST /api/v1/agent-keys",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("api_keys:write")(apiConfig.handlerCreateAgentAPIKey)))
	mux.Handle("DELETE /api/v1/agent-keys/{id}",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("api_keys:write")(apiConfig.handlerRevokeAgentAPIKey)))
	mux.Handle("GET /api/v1/auth/introspect",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor()(apiConfig.handlerAgentAuthIntrospect)))
	mux.Handle("GET /api/v1/audit",
		apiConfig.middlewareMetricsInc(
			apiConfig.middlewareActor("activity:read")(apiConfig.handlerGetAuditLogs)))

	mux.HandleFunc("GET /api/events", apiConfig.handlerSSE)

	fmt.Printf("Starting server on port %s...\n", port)

	// SPA catch-all handler - must be registered AFTER API routes
	// Handles any non-API route that doesn't match file
	mux.HandleFunc("GET /{path...}", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Skip API paths - they should be handled by API routes above
		// Check for both /api/ and /abrn/api/ patterns
		if strings.Contains(path, "/api/") {
			http.NotFound(w, r)
			return
		}

		// Vite builds with base:"/abrn/" so asset URLs carry a /abrn prefix,
		// but the files in dist/ live at the root of dist (not in an abrn/ subdir).
		// The old domain strips /abrn/ via Apache ProxyPass; the new dedicated
		// domain does not, so we normalise here for both cases.
		cleanPath := strings.TrimPrefix(path, "/abrn")

		if cleanPath == "" || cleanPath == "/" {
			cleanPath = "/index.html"
		}

		// Try to serve actual file if it exists
		filePath := "vaultdrive_client/dist" + cleanPath
		if _, err := os.Stat(filePath); err == nil {
			http.ServeFile(w, r, filePath)
			return
		}

		// SPA catch-all: serve index.html for all client-side routes
		http.ServeFile(w, r, "vaultdrive_client/dist/index.html")
	})

	log.Printf("Server listening on port %s", port)
	// Configure server with explicit timeouts for large file uploads
	server := &http.Server{
		Addr:    ":" + port,
		Handler: middlewareCORS(mux),
		// Timeouts configured for 2GB uploads (30 minutes)
		ReadTimeout:    30 * time.Minute, // Maximum time to read request body
		WriteTimeout:   30 * time.Minute, // Maximum time to write response
		IdleTimeout:    60 * time.Minute, // Keep-alive timeout
		MaxHeaderBytes: 1 << 20,          // 1MB max header size to prevent overflow attacks
	}
	err = server.ListenAndServe()
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
