# Step 20 — OpenAPI Specification

**Parent:** [v4 Production Launch Index](./v4-production-launch-index.md)  
**Phase:** VII — API & Documentation  
**Status:** 🔲 TODO  
**Priority:** LOW — Developer experience  

---

## Why This Matters

The REST API has 40+ endpoints. Without formal documentation, every integration (mobile app, CLI tool, agent API, third-party) requires reading Go source code. An OpenAPI spec gives us: auto-generated docs, Swagger UI, client SDKs, and a contract that prevents breaking changes.

## Current API Surface

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/register` | Create account |
| POST | `/api/login` | Login (returns JWT) |
| POST | `/api/users/pin` | Set/change PIN |
| POST | `/api/users/pin/login` | PIN-based login |
| GET | `/api/users/pin/status` | Check PIN enrollment |
| GET | `/api/users/me` | Current user profile |

### Files
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/files` | List user's files |
| POST | `/api/files/upload` | Upload encrypted file |
| GET | `/api/files/:id/download` | Download encrypted file |
| DELETE | `/api/files/:id` | Delete file |
| PATCH | `/api/files/:id/star` | Toggle star |
| GET | `/api/files/shared` | Files shared with user |
| GET | `/api/files/search` | Search files (pg_trgm) |

### Sharing
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/files/:id/share-link` | Create share link |
| GET | `/api/share/:token` | Access share link (public) |
| DELETE | `/api/share-links/:id` | Revoke share link |
| GET | `/api/v1/shares` | List all outbound shares |

### Folders
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/folders` | List folders |
| POST | `/api/folders` | Create folder |
| DELETE | `/api/folders/:id` | Delete folder |
| POST | `/api/folders/:id/share-link` | Create folder share link |

### Drop (Upload Links)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/drop/create` | Create upload link |
| GET | `/api/drop/tokens` | List upload links |
| POST | `/api/drop/:token/upload` | Upload via link (public) |

### Groups
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| GET | `/api/groups/:id` | Group detail |
| POST | `/api/groups/:id/members` | Add member |

### Agent API
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agent-keys` | List API keys |
| POST | `/api/agent-keys` | Create API key |
| DELETE | `/api/agent-keys/:id` | Revoke API key |
| GET | `/api/v1/files` | Agent-scoped file list |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/audit` | Audit log |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/healthz` | Health check |
| GET | `/api/branding` | Dynamic branding config |

## Implementation Approach

### Option A: Hand-Written Spec (Recommended for Now)

Create `docs/openapi.yaml` manually based on the actual Go handlers. This ensures accuracy and gives us full control.

### Option B: Auto-Generated from Go Comments

Use `swaggo/swag` to generate from Go doc comments:
```go
// @Summary Upload encrypted file
// @Tags files
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Encrypted file"
// @Success 200 {object} FileData
// @Router /api/files/upload [post]
func handleFileUpload(w http.ResponseWriter, r *http.Request) {
```

### Swagger UI

Serve Swagger UI at `/api/docs`:
```go
mux.Handle("/api/docs/", httpSwagger.Handler(
    httpSwagger.URL("/api/docs/swagger.json"),
))
```

## Verification

| Check | Expected Result |
|-------|----------------|
| `docs/openapi.yaml` validates | ✅ No errors with `swagger-cli validate` |
| Swagger UI accessible | ✅ `/api/docs` renders interactive docs |
| All endpoints documented | ✅ 40+ paths with request/response schemas |
| Example requests work | ✅ Try-it-out from Swagger UI |

## Files to Create

| File | Purpose |
|------|---------|
| `docs/openapi.yaml` | OpenAPI 3.0 specification |
| Go handler comments (optional) | Swagger annotations |
| `main.go` (optional) | Mount Swagger UI handler |
