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
	"io"
	"log"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/auth"
	"github.com/Pranay0205/VaultDrive/internal/database"
)

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
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	hashedPassword, err := auth.HashPassword(newUser.Password)
	if err != nil {
		log.Printf("Error hashing password: %v", err)
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	// Generate RSA Keys
	privKeyPEM, pubKeyPEM, err := generateRSAKeys()
	if err != nil {
		log.Printf("Error generating keys: %v", err)
		http.Error(w, "Error creating user keys", http.StatusInternalServerError)
		return
	}

	// Encrypt Private Key
	encryptedPrivKey, err := encryptPrivateKey(privKeyPEM, newUser.Password)
	if err != nil {
		log.Printf("Error encrypting private key: %v", err)
		http.Error(w, "Error securing user keys", http.StatusInternalServerError)
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
		http.Error(w, "Error creating user", http.StatusInternalServerError)
		return
	}

	respondWithJSON(w, http.StatusCreated, user)
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
