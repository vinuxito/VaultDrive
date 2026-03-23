package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const maxBulkDelete = 500

// Middleware to require admin access
func (cfg *ApiConfig) requireAdmin(next authedHandler) authedHandler {
	return func(w http.ResponseWriter, r *http.Request, user database.User) {
		// Check if user is admin
		if !user.IsAdmin.Valid || !user.IsAdmin.Bool {
			respondWithError(w, http.StatusForbidden, "Admin access required", nil)
			return
		}

		next(w, r, user)
	}
}

// GET /admin/users - Get all users
func (cfg *ApiConfig) getAllUsersHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	users, err := cfg.dbQueries.GetAllUsers(context.Background())
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error fetching users", err)
		return
	}

	// Transform to frontend-friendly format (exclude sensitive fields)
	response := make([]map[string]interface{}, len(users))
	for i, u := range users {
		isAdmin := false
		if u.IsAdmin.Valid {
			isAdmin = u.IsAdmin.Bool
		}
		response[i] = map[string]interface{}{
			"id":         u.ID,
			"first_name": u.FirstName,
			"last_name":  u.LastName,
			"username":   u.Username,
			"email":      u.Email,
			"is_admin":   isAdmin,
			"created_at": u.CreatedAt,
			"updated_at": u.UpdatedAt,
		}
	}

	respondWithJSON(w, http.StatusOK, response)
}

// PUT /admin/users/{id} - Update user details
func (cfg *ApiConfig) updateUserAsAdminHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	userID := r.PathValue("id")
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	type updateUserRequest struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
		Username  string `json:"username"`
	}

	var req updateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate required fields
	if req.FirstName == "" || req.LastName == "" || req.Email == "" || req.Username == "" {
		respondWithError(w, http.StatusBadRequest, "All fields are required", nil)
		return
	}

	if _, err := mail.ParseAddress(req.Email); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid email format", nil)
		return
	}

	updatedUser, err := cfg.dbQueries.UpdateUserAsAdmin(context.Background(), database.UpdateUserAsAdminParams{
		ID:        userUUID,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Username:  req.Username,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error updating user", err)
		return
	}

	isAdmin := false
	if updatedUser.IsAdmin.Valid {
		isAdmin = updatedUser.IsAdmin.Bool
	}
	response := map[string]interface{}{
		"id":         updatedUser.ID,
		"first_name": updatedUser.FirstName,
		"last_name":  updatedUser.LastName,
		"username":   updatedUser.Username,
		"email":      updatedUser.Email,
		"is_admin":   isAdmin,
		"created_at": updatedUser.CreatedAt,
		"updated_at": updatedUser.UpdatedAt,
	}

	respondWithJSON(w, http.StatusOK, response)
}

// POST /admin/users/{id}/reset-password - Reset user password
func (cfg *ApiConfig) resetUserPasswordHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	userID := r.PathValue("id")
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	type resetPasswordRequest struct {
		NewPassword string `json:"new_password"`
	}

	var req resetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	// Validate password
	if len(req.NewPassword) < 8 {
		respondWithError(w, http.StatusBadRequest, "Password must be at least 8 characters", nil)
		return
	}

	// Hash the new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error hashing password", err)
		return
	}

	err = cfg.dbQueries.UpdateUserPassword(context.Background(), database.UpdateUserPasswordParams{
		ID:           userUUID,
		PasswordHash: string(hashedPassword),
		UpdatedAt:    time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error updating password", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Password reset successfully",
	})
}

// DELETE /admin/users/{id} - Delete user
func (cfg *ApiConfig) deleteUserAsAdminHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	userID := r.PathValue("id")
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	// Prevent admin from deleting themselves
	if userUUID == user.ID {
		respondWithError(w, http.StatusBadRequest, "Cannot delete your own account", nil)
		return
	}

	err = cfg.dbQueries.DeleteUserAsAdmin(context.Background(), userUUID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error deleting user", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "User deleted successfully",
	})
}

// POST /admin/users/bulk-delete - Delete multiple users at once
func (cfg *ApiConfig) bulkDeleteUsersHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	type bulkDeleteRequest struct {
		UserIDs []string `json:"user_ids"`
	}

	var req bulkDeleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if len(req.UserIDs) == 0 {
		respondWithError(w, http.StatusBadRequest, "No users selected", nil)
		return
	}

	if len(req.UserIDs) > maxBulkDelete {
		respondWithError(w, http.StatusBadRequest, fmt.Sprintf("Maximum %d users per request", maxBulkDelete), nil)
		return
	}

	deleted := 0
	skipped := 0
	for _, id := range req.UserIDs {
		userUUID, err := uuid.Parse(id)
		if err != nil {
			skipped++
			continue
		}
		// Prevent admin from deleting themselves
		if userUUID == user.ID {
			skipped++
			continue
		}
		if err := cfg.dbQueries.DeleteUserAsAdmin(context.Background(), userUUID); err != nil {
			log.Printf("bulk-delete: failed user %s", id)
			skipped++
			continue
		}
		deleted++
	}

	if deleted == 0 {
		respondWithError(w, http.StatusBadRequest, "No users were deleted", nil)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": fmt.Sprintf("Deleted %d user(s), skipped %d", deleted, skipped),
		"deleted": deleted,
		"skipped": skipped,
	})
}

// POST /admin/users - Create a new user (admin)
func (cfg *ApiConfig) createUserAsAdminHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	type createUserRequest struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Username  string `json:"username"`
		Email     string `json:"email"`
		Password  string `json:"password"`
	}

	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	if req.FirstName == "" || req.LastName == "" || req.Username == "" || req.Email == "" || req.Password == "" {
		respondWithError(w, http.StatusBadRequest, "All fields are required", nil)
		return
	}

	if _, err := mail.ParseAddress(req.Email); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid email format", nil)
		return
	}

	if len(req.Password) < 8 {
		respondWithError(w, http.StatusBadRequest, "Password must be at least 8 characters", nil)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error hashing password", err)
		return
	}

	privKeyPEM, pubKeyPEM, err := generateRSAKeys()
	if err != nil {
		log.Printf("Error generating keys: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error creating user keys", err)
		return
	}

	encryptedPrivKey, err := encryptPrivateKey(privKeyPEM, req.Password)
	if err != nil {
		log.Printf("Error encrypting private key: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error securing user keys", err)
		return
	}

	now := time.Now()
	newUser, err := cfg.dbQueries.CreateUser(context.Background(), database.CreateUserParams{
		FirstName:           req.FirstName,
		LastName:            req.LastName,
		Username:            req.Username,
		Email:               req.Email,
		PasswordHash:        string(hashedPassword),
		PublicKey:           pubKeyPEM,
		PrivateKeyEncrypted: encryptedPrivKey,
		CreatedAt:           now,
		UpdatedAt:           now,
	})
	if err != nil {
		log.Printf("Error creating user in DB: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Error creating user (email or username may already exist)", err)
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         newUser.ID,
		"first_name": newUser.FirstName,
		"last_name":  newUser.LastName,
		"username":   newUser.Username,
		"email":      newUser.Email,
		"is_admin":   false,
		"created_at": newUser.CreatedAt,
		"updated_at": newUser.UpdatedAt,
	})
}

// POST /admin/users/{id}/reset-pin - Clear user's PIN so they can re-enroll
func (cfg *ApiConfig) resetUserPINHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	userID := r.PathValue("id")
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	err = cfg.dbQueries.ResetUserPINAsAdmin(context.Background(), database.ResetUserPINAsAdminParams{
		ID:        userUUID,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error resetting PIN", err)
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "PIN reset successfully. User will need to set a new PIN.",
	})
}

// PUT /admin/users/{id}/admin-status - Toggle admin role
func (cfg *ApiConfig) toggleAdminHandler(w http.ResponseWriter, r *http.Request, user database.User) {
	userID := r.PathValue("id")
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID", err)
		return
	}

	// Prevent removing admin from own account
	if userUUID == user.ID {
		respondWithError(w, http.StatusBadRequest, "Cannot change your own admin status", nil)
		return
	}

	type adminStatusRequest struct {
		IsAdmin bool `json:"is_admin"`
	}

	var req adminStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err)
		return
	}

	err = cfg.dbQueries.SetUserAdminStatus(context.Background(), database.SetUserAdminStatusParams{
		ID:        userUUID,
		IsAdmin:   sql.NullBool{Bool: req.IsAdmin, Valid: true},
		UpdatedAt: time.Now(),
	})
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Error updating admin status", err)
		return
	}

	action := "granted"
	if !req.IsAdmin {
		action = "revoked"
	}
	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Admin access " + action + " successfully",
	})
}
