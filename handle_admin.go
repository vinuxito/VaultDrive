package main

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Pranay0205/VaultDrive/internal/database"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

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
	if len(req.NewPassword) < 6 {
		respondWithError(w, http.StatusBadRequest, "Password must be at least 6 characters", nil)
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
