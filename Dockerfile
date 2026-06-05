# Build Stage
FROM golang:1.25-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Install goose for migrations
RUN go install github.com/pressly/goose/v3/cmd/goose@v3.24.1

# Copy the source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -o vaultdrive-backend .

# Final Stage
FROM alpine:latest

WORKDIR /root/

# Install ca-certificates for HTTPS calls
RUN apk --no-cache add ca-certificates bash

# Copy the binary from the builder stage
COPY --from=builder /app/vaultdrive-backend .

# Copy frontend build
COPY --from=builder /app/vaultdrive_client/dist ./vaultdrive_client/dist

# Copy goose binary
COPY --from=builder /go/bin/goose .

# Copy migration files
COPY --from=builder /app/sql/schema ./sql/schema

# Create uploads directory
RUN mkdir -p uploads

# Expose the port
EXPOSE 8080

# Run migrations and start app
CMD ["/bin/sh", "-c", "./goose -dir sql/schema postgres \"$DB_URL\" up && ./vaultdrive-backend"]