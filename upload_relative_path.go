package main

import (
	"context"
	"fmt"
	pathpkg "path"
	"strings"
	"time"

	"github.com/vinuxito/VaultDrive/internal/database"
	"github.com/google/uuid"
)

func resolveUploadRelativePath(explicitRelativePath string, fallbackFilename string) (string, string, string, error) {
	rawPath := strings.TrimSpace(explicitRelativePath)
	if rawPath == "" {
		rawPath = strings.TrimSpace(fallbackFilename)
	}
	if rawPath == "" {
		return "", "", "", fmt.Errorf("upload path is empty")
	}

	normalized := strings.ReplaceAll(rawPath, "\\", "/")
	cleaned := pathpkg.Clean(normalized)
	if cleaned == "." || cleaned == "" {
		return "", "", "", fmt.Errorf("upload path is empty")
	}
	if strings.HasPrefix(cleaned, "/") || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", "", "", fmt.Errorf("invalid upload path")
	}
	if strings.Contains(cleaned, "/../") {
		return "", "", "", fmt.Errorf("invalid upload path")
	}

	filename := pathpkg.Base(cleaned)
	if filename == "." || filename == "" {
		return "", "", "", fmt.Errorf("upload filename is empty")
	}

	relDir := pathpkg.Dir(cleaned)
	if relDir == "." {
		relDir = ""
	}

	return cleaned, filename, relDir, nil
}

func ensureUploadFolderPath(
	queries *database.Queries,
	ctx context.Context,
	ownerID uuid.UUID,
	rootFolderID uuid.NullUUID,
	relativeDir string,
) (uuid.NullUUID, error) {
	if relativeDir == "" {
		return rootFolderID, nil
	}

	folders, err := queries.GetFoldersByOwner(ctx, ownerID)
	if err != nil {
		return uuid.NullUUID{}, err
	}

	byParentAndName := make(map[string]database.Folder, len(folders))
	for _, folder := range folders {
		parentKey := "root"
		if folder.ParentID.Valid {
			parentKey = folder.ParentID.UUID.String()
		}
		byParentAndName[parentKey+"/"+folder.Name] = folder
	}

	currentParent := rootFolderID
	for _, segment := range strings.Split(relativeDir, "/") {
		if segment == "" {
			continue
		}
		parentKey := "root"
		if currentParent.Valid {
			parentKey = currentParent.UUID.String()
		}
		lookupKey := parentKey + "/" + segment
		if existing, ok := byParentAndName[lookupKey]; ok {
			currentParent = uuid.NullUUID{UUID: existing.ID, Valid: true}
			continue
		}

		created, err := queries.CreateFolder(ctx, database.CreateFolderParams{
			OwnerID:   ownerID,
			Name:      segment,
			ParentID:  currentParent,
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		})
		if err != nil {
			return uuid.NullUUID{}, err
		}
		byParentAndName[lookupKey] = created
		currentParent = uuid.NullUUID{UUID: created.ID, Valid: true}
	}

	return currentParent, nil
}
