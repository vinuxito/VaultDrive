# Build and run the application
run:
	go build -o abrndrive && ./abrndrive

# Just build without running
build:
	go build -o abrndrive

# Clean up built binaries
clean:
	rm -f abrndrive

# Run with live reload during development
dev:
	go run .

# Build for production (with optimizations)
build-prod:
	go build -ldflags="-w -s" -o abrndrive

# Connect to the database
db-connect:
	psql -h localhost -U postgres -d vaultdrive

# === Deploy pipeline ===

PROD_URL ?= https://abrndrive.filemonprime.net
SERVICE  ?= abrndrive

# Build the SPA bundle into vaultdrive_client/dist (the Go backend serves it directly)
build-frontend:
	cd vaultdrive_client && npm run build
	@# Guard: a build that defaults to the /quantix base (VITE_BASE_PATH unset)
	@# produces an index.html whose assets 404 under /abrn/ -> blank page. Fail loud.
	@grep -q '/abrn/assets/' vaultdrive_client/dist/index.html \
		|| { echo "FATAL: dist/index.html base is not /abrn/ — rebuild with VITE_BASE_PATH=/abrn (check vaultdrive_client/.env)"; exit 1; }
	@! grep -q '/quantix/' vaultdrive_client/dist/index.html \
		|| { echo "FATAL: dist/index.html still references /quantix/ — wrong base baked in"; exit 1; }
	@echo "frontend base verified: /abrn/"

# Build the production backend binary at the location systemd starts
build-backend: build-prod

# Restart the systemd service (requires sudo)
deploy-restart:
	sudo systemctl restart $(SERVICE)

# Probe the live URL — fails the make target on non-2xx for /api/healthz
# and on a non-400 response when /api/register is called with an empty body.
deploy-smoke:
	@echo "Smoke: GET /abrn/api/healthz"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' $(PROD_URL)/abrn/api/healthz); \
	  if [ "$$code" != "200" ]; then echo "healthz failed: HTTP $$code"; exit 1; fi; \
	  echo "  healthz: HTTP $$code"
	@echo "Smoke: POST /abrn/api/register {}"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' $(PROD_URL)/abrn/api/register); \
	  if [ "$$code" != "400" ]; then echo "register{} expected 400 got $$code"; exit 1; fi; \
	  echo "  register{}: HTTP $$code"
	@echo "Smoke: GET /abrn/"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' -L $(PROD_URL)/abrn/); \
	  if [ "$$code" != "200" ]; then echo "spa failed: HTTP $$code"; exit 1; fi; \
	  echo "  /abrn/: HTTP $$code"
	@echo "Deploy verified."

# Full deploy: frontend build + backend build + restart + smoke
deploy: build-frontend build-backend deploy-restart deploy-smoke

.PHONY: run build clean dev build-prod db-connect \
	build-frontend build-backend deploy-restart deploy-smoke deploy
