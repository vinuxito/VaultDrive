package main

import (
	"encoding/json"
	"net/http"
)

func handleOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	spec := map[string]interface{}{
		"openapi": "3.0.3",
		"info": map[string]interface{}{
			"title":       "VaultDrive Zero-Knowledge API",
			"description": "REST API for VaultDrive. Built with client-side cryptography, zero-knowledge storage, and biometric lock capabilities.",
			"version":     "1.0.0",
		},
		"servers": []map[string]interface{}{
			{"url": "/abrn", "description": "Local/Production Gateway Base Path"},
		},
		"paths": map[string]interface{}{
			"/api/healthz": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":     "Liveness Probe",
					"description": "Returns status, database latency, active goroutines, memory usage, and requests counter.",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{
							"description": "System is healthy",
						},
					},
				},
			},
			"/metrics": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":     "Prometheus Metrics",
					"description": "Exposes standard Prometheus scrape format metrics for requests, errors, memory, and goroutines.",
					"responses": map[string]interface{}{
						"200": map[string]interface{}{
							"description": "Metrics response in plain text",
						},
					},
				},
			},
			"/api/register": map[string]interface{}{
				"post": map[string]interface{}{
					"summary":     "Register User",
					"description": "Registers a new user, saving their public key and encrypted private key.",
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type": "object",
									"properties": map[string]interface{}{
										"email":      map[string]interface{}{"type": "string"},
										"password":   map[string]interface{}{"type": "string"},
										"first_name": map[string]interface{}{"type": "string"},
										"last_name":  map[string]interface{}{"type": "string"},
									},
									"required": []string{"email", "password"},
								},
							},
						},
					},
					"responses": map[string]interface{}{
						"201": map[string]interface{}{"description": "Successfully registered"},
						"400": map[string]interface{}{"description": "Bad request or validation error"},
					},
				},
			},
			"/api/login": map[string]interface{}{
				"post": map[string]interface{}{
					"summary":     "Login User",
					"description": "Authenticates user and returns JWT bearer token.",
					"requestBody": map[string]interface{}{
						"required": true,
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type": "object",
									"properties": map[string]interface{}{
										"email":    map[string]interface{}{"type": "string"},
										"password": map[string]interface{}{"type": "string"},
									},
									"required": []string{"email", "password"},
								},
							},
						},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Successfully authenticated"},
						"401": map[string]interface{}{"description": "Unauthorized"},
					},
				},
			},
			"/api/files": map[string]interface{}{
				"get": map[string]interface{}{
					"summary":     "List Files",
					"description": "Lists all encrypted metadata structures of files within the user's scope.",
					"security": []map[string]interface{}{
						{"BearerAuth": []string{}},
					},
					"responses": map[string]interface{}{
						"200": map[string]interface{}{"description": "Successful retrieval"},
						"401": map[string]interface{}{"description": "Unauthorized"},
					},
				},
			},
		},
		"components": map[string]interface{}{
			"securitySchemes": map[string]interface{}{
				"BearerAuth": map[string]interface{}{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "JWT",
				},
			},
		},
	}
	json.NewEncoder(w).Encode(spec)
}

func handleSwaggerUI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	html := `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>VaultDrive API Docs & Trust Boundaries</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    header {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 1.5rem 2rem;
    }
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-title h1 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #38bdf8;
    }
    .header-title p {
      margin: 0.25rem 0 0 0;
      font-size: 0.875rem;
      color: #94a3b8;
    }
    .trust-boundaries {
      max-width: 1200px;
      margin: 2rem auto;
      padding: 0 2rem;
    }
    .boundary-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
    }
    .boundary-card h2 {
      margin-top: 0;
      color: #38bdf8;
      font-size: 1.25rem;
      border-bottom: 1px solid #334155;
      padding-bottom: 0.5rem;
    }
    .boundary-card p {
      color: #cbd5e1;
      font-size: 0.95rem;
      line-height: 1.6;
    }
    .boundary-card ul {
      color: #cbd5e1;
      font-size: 0.95rem;
      line-height: 1.6;
    }
    #swagger-ui {
      background: #ffffff;
      border-radius: 12px;
      max-width: 1200px;
      margin: 0 auto 3rem auto;
      padding: 1rem;
    }
    /* Customize Swagger UI colors to integrate nicely */
    .swagger-ui .info .title {
      color: #0f172a !important;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <div class="header-title">
        <h1>VaultDrive OpenAPI API Specification</h1>
        <p>Interactive playground and developers guide</p>
      </div>
      <div>
        <span style="background: #0284c7; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.875rem; font-weight: 600;">Zero-Knowledge Verified</span>
      </div>
    </div>
  </header>

  <div class="trust-boundaries">
    <div class="boundary-card">
      <h2>Architectural Trust Boundaries</h2>
      <p>
        VaultDrive operates under a strict <strong>Zero-Knowledge (ZK)</strong> model. The cryptographic trust boundary is drawn entirely at the client browser level.
      </p>
      <ul>
        <li><strong>Data Boundary:</strong> Files are encrypted using AES-GCM-256 before leaving the user interface. The controller only receives raw binary ciphertext blobs.</li>
        <li><strong>Key Management:</strong> Encryption keys are wrapped locally using WebAuthn bound credentials or PBKDF2 stretched passwords. The server never learns, sees, or archives plain-text user PINs, passwords, or recovery shares.</li>
        <li><strong>Metadata Integrity:</strong> Original filenames, MIME types, and sizes are packaged into encrypted metadata payloads, ensuring zero leaks in the transport or database layers.</li>
      </ul>
    </div>
  </div>

  <div id="swagger-ui"></div>

  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/abrn/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`
	w.Write([]byte(html))
}
