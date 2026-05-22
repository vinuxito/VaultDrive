package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/vinuxito/VaultDrive/auth"
	"github.com/vinuxito/VaultDrive/internal/database"
)

const (
	minPasswordLength = 8
	maxPasswordLength = 64
	maxFieldLength    = 254
)

var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func validateRegisterInput(firstName, lastName, username, email, password string) error {
	firstName = strings.TrimSpace(firstName)
	lastName = strings.TrimSpace(lastName)
	username = strings.TrimSpace(username)
	email = strings.TrimSpace(email)

	if firstName == "" {
		return errors.New("first_name is required")
	}
	if lastName == "" {
		return errors.New("last_name is required")
	}
	if username == "" {
		return errors.New("username is required")
	}
	if email == "" {
		return errors.New("email is required")
	}
	if !emailRegex.MatchString(email) {
		return errors.New("email is not a valid email address")
	}
	if len(firstName) > maxFieldLength || len(lastName) > maxFieldLength ||
		len(username) > maxFieldLength || len(email) > maxFieldLength {
		return fmt.Errorf("fields must be %d characters or fewer", maxFieldLength)
	}
	if len(password) < minPasswordLength {
		return fmt.Errorf("password must be at least %d characters", minPasswordLength)
	}
	if len(password) > maxPasswordLength {
		return fmt.Errorf("password must be %d characters or fewer", maxPasswordLength)
	}
	return nil
}

func (cfg *ApiConfig) registerUserHandler(w http.ResponseWriter, r *http.Request) {
	var newUser struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		Password  string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&newUser)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request payload", err)
		return
	}

	newUser.FirstName = strings.TrimSpace(newUser.FirstName)
	newUser.LastName = strings.TrimSpace(newUser.LastName)
	newUser.Username = strings.TrimSpace(newUser.Username)
	newUser.Email = strings.TrimSpace(newUser.Email)

	if err := validateRegisterInput(newUser.FirstName, newUser.LastName, newUser.Username, newUser.Email, newUser.Password); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error(), err)
		return
	}

	hashedPassword, err := auth.HashPassword(newUser.Password)
	if err != nil {
		log.Printf("Error hashing password: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error creating user", err)
		return
	}

	// Generate RSA Keys
	privKeyPEM, pubKeyPEM, err := generateRSAKeys()
	if err != nil {
		log.Printf("Error generating keys: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error creating user keys", err)
		return
	}

	// Encrypt Private Key
	encryptedPrivKey, err := encryptPrivateKey(privKeyPEM, newUser.Password)
	if err != nil {
		log.Printf("Error encrypting private key: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error securing user keys", err)
		return
	}

	user, err := cfg.dbQueries.CreateUser(context.Background(), database.CreateUserParams{
		FirstName:           newUser.FirstName,
		LastName:            newUser.LastName,
		Username:            newUser.Username,
		Email:               newUser.Email,
		PasswordHash:        hashedPassword,
		PublicKey:           pubKeyPEM,
		PrivateKeyEncrypted: encryptedPrivKey,
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	})

	if err != nil {
		log.Printf("Error creating user in DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error creating user", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         user.ID,
		"first_name": user.FirstName,
		"last_name":  user.LastName,
		"username":   user.Username,
		"email":      user.Email,
		"created_at": user.CreatedAt,
		"updated_at": user.UpdatedAt,
	})
}

func generateRSAKeys() (string, string, error) {
	// Generate 2048-bit RSA key
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", "", err
	}

	// Encode Private Key to PEM
	privBytes := x509.MarshalPKCS1PrivateKey(key)
	privPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privBytes,
	})

	// Encode Public Key to PEM
	pubBytes, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		return "", "", err
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubBytes,
	})

	return string(privPEM), string(pubPEM), nil
}

func encryptPrivateKey(privateKeyPEM, password string) (string, error) {
	// 1. Generate a random salt (16 bytes)
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}

	// 2. Derive a key from password + salt using SHA256
	// Note: In production, use a slower KDF like Argon2 or PBKDF2
	keyHash := sha256.Sum256(append(salt, []byte(password)...))
	key := keyHash[:]

	// 3. Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 4. Generate nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// 5. Encrypt
	ciphertext := gcm.Seal(nonce, nonce, []byte(privateKeyPEM), nil)

	// 6. Combine salt + ciphertext (which includes nonce prefix)
	finalData := append(salt, ciphertext...)

	// 7. Base64 encode
	return base64.StdEncoding.EncodeToString(finalData), nil
}
