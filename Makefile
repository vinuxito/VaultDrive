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


.PHONY: run build clean dev build-prod