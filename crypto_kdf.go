package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"

	"golang.org/x/crypto/argon2"
)

const (
	argon2Time    = 3         // iterations
	argon2Memory  = 64 * 1024 // 64 MiB
	argon2Threads = 4
	argon2KeyLen  = 32 // AES-256
)

func deriveKeyV2(password string, salt []byte) []byte {
	return argon2.IDKey(
		[]byte(password), salt,
		argon2Time, argon2Memory, argon2Threads, argon2KeyLen,
	)
}

func encryptPrivateKeyV2(privateKeyPEM, password string) (string, error) {
	salt := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, salt); err != nil {
		return "", err
	}

	key := deriveKeyV2(password, salt)

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nil, nonce, []byte(privateKeyPEM), nil)

	envelope := make([]byte, 0, len(salt)+len(nonce)+len(ciphertext))
	envelope = append(envelope, salt...)
	envelope = append(envelope, nonce...)
	envelope = append(envelope, ciphertext...)

	return base64.StdEncoding.EncodeToString(envelope), nil
}

func decryptPrivateKey(encryptedB64, password string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encryptedB64)
	if err != nil {
		return "", err
	}

	if len(data) < 16+12+16 {
		return "", errors.New("invalid encrypted data length")
	}

	salt := data[:16]
	iv := data[16:28]
	ciphertext := data[28:]

	keyHash := sha256.Sum256(append(salt, []byte(password)...))
	key := keyHash[:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
