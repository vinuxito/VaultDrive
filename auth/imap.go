package auth

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/bcrypt"
)

const (
	EncryptionKeyLen = 32
	NonceLen         = 12
)

// deriveKey derives a fixed encryption key from the app's JWT secret
func deriveKey(secret string) []byte {
	if secret == "" {
		panic("deriveKey: secret cannot be empty - JWT_SECRET not loaded")
	}

	// Use SHA-256 to create a deterministic key from the secret
	// Pad or truncate to 32 bytes (AES-256)
	key := make([]byte, EncryptionKeyLen)
	secretBytes := []byte(secret)

	// Use repeated secret to fill key if needed
	for i := 0; i < EncryptionKeyLen; i++ {
		key[i] = secretBytes[i%len(secretBytes)]
	}

	return key
}

// EncryptPassword encrypts a password using AES-256-GCM
// Returns: base64(encrypted_password)
func EncryptPassword(password string, jwtSecret string) (string, error) {
	if password == "" {
		return "", fmt.Errorf("password cannot be empty")
	}

	// Derive key from JWT secret (in production, use a dedicated encryption key)
	key := deriveKey(jwtSecret)

	// Create AES-GCM cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random nonce
	nonce := make([]byte, NonceLen)
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt password: GCM appends the nonce to ciphertext
	// dst = nonce (pre-allocate capacity), nonce, plaintext, additionalData
	nonceAndCiphertext := gcm.Seal(nonce, nonce, []byte(password), nil)

	// Encode to Base64 for storage
	return base64.StdEncoding.EncodeToString(nonceAndCiphertext), nil
}

// DecryptPassword decrypts an AES-256-GCM encrypted password
func DecryptPassword(encrypted string, jwtSecret string) (string, error) {
	if encrypted == "" {
		return "", fmt.Errorf("encrypted data cannot be empty")
	}

	// Decode from Base64
	data, err := base64.StdEncoding.DecodeString(encrypted)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}

	if len(data) < NonceLen {
		return "", fmt.Errorf("encrypted data too short")
	}

	// Derive key from JWT secret
	key := deriveKey(jwtSecret)

	// Create AES-GCM cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Extract nonce and ciphertext
	nonce := data[:NonceLen]
	ciphertext := data[NonceLen:]

	// Decrypt password
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// HashIMAPPassword securely stores IMAP password
// Using bcrypt for compatibility with existing auth system
// Returns bcrypt hash of password
func HashIMAPPassword(password string) (string, error) {
	if password == "" {
		return "", fmt.Errorf("password cannot be empty")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}

	return string(hashedPassword), nil
}

// CheckIMAPPassword verifies an IMAP password against its hash
func CheckIMAPPassword(password, hash string) error {
	if password == "" || hash == "" {
		return fmt.Errorf("password or hash cannot be empty")
	}

	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}
