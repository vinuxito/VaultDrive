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


.PHONY: run build clean dev build-prod db-connect
