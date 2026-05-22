# Build and run the application
run:
	go build -o quantix-drive && ./quantix-drive

# Just build without running
build:
	go build -o quantix-drive

# Clean up built binaries
clean:
	rm -f quantix-drive

# Run with live reload during development
dev:
	go run .

# Build for production (with optimizations)
build-prod:
	go build -ldflags="-w -s" -o quantix-drive

# Connect to the database
db-connect:
	psql -h localhost -U postgres -d vaultdrive

# === Deploy pipeline ===

PROD_URL ?= https://quantixdrive.filemonprime.net
SERVICE  ?= quantixdrive

# Build the SPA bundle into vaultdrive_client/dist (Apache serves it directly)
build-frontend:
	cd vaultdrive_client && npm run build

# Build the production backend binary at the location systemd starts
build-backend: build-prod

# Restart the systemd service (requires sudo)
deploy-restart:
	sudo systemctl restart $(SERVICE)

# Probe the live URL — fails the make target on non-2xx for /api/healthz
# and on a non-400 response when /api/register is called with an empty body.
deploy-smoke:
	@echo "Smoke: GET /api/healthz"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' $(PROD_URL)/api/healthz); \
	  if [ "$$code" != "200" ]; then echo "healthz failed: HTTP $$code"; exit 1; fi; \
	  echo "  healthz: HTTP $$code"
	@echo "Smoke: POST /api/register {}"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' $(PROD_URL)/api/register); \
	  if [ "$$code" != "400" ]; then echo "register{} expected 400 got $$code"; exit 1; fi; \
	  echo "  register{}: HTTP $$code"
	@echo "Smoke: GET /quantix/"
	@code=$$(curl -s -o /dev/null -w '%{http_code}' -L $(PROD_URL)/quantix/); \
	  if [ "$$code" != "200" ]; then echo "spa failed: HTTP $$code"; exit 1; fi; \
	  echo "  /quantix/: HTTP $$code"
	@echo "Deploy verified."

# Full deploy: frontend build + backend build + restart + smoke
deploy: build-frontend build-backend deploy-restart deploy-smoke

.PHONY: run build clean dev build-prod db-connect \
	build-frontend build-backend deploy-restart deploy-smoke deploy
