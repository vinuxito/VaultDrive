package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func uploadStorageDir() string {
	if dir := os.Getenv("UPLOAD_DIR"); dir != "" {
		return dir
	}
	return "uploads"
}

// resolveStoredFilePath maps both legacy database paths ("uploads/<file>")
// and current paths into the configured storage root. It never permits a
// database value to escape that root.
func resolveStoredFilePath(stored string) (string, error) {
	if strings.TrimSpace(stored) == "" {
		return "", fmt.Errorf("stored file path is empty")
	}

	root, err := filepath.Abs(uploadStorageDir())
	if err != nil {
		return "", fmt.Errorf("resolve upload root: %w", err)
	}
	root = filepath.Clean(root)
	cleaned := filepath.Clean(stored)

	var candidate string
	if filepath.IsAbs(cleaned) {
		candidate = cleaned
	} else {
		parts := strings.Split(filepath.ToSlash(cleaned), "/")
		if len(parts) > 0 && parts[0] == "uploads" {
			parts = parts[1:]
		}
		if len(parts) == 0 {
			return "", fmt.Errorf("stored file path has no filename")
		}
		candidate = filepath.Join(append([]string{root}, parts...)...)
	}
	candidate = filepath.Clean(candidate)

	relative, err := filepath.Rel(root, candidate)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("stored file path escapes upload root")
	}
	return candidate, nil
}

type storedFileCheck struct {
	Total     int
	Available int
	Missing   int
	Empty     int
	Invalid   int
}

func checkStoredFilePaths(paths []string) storedFileCheck {
	result := storedFileCheck{Total: len(paths)}
	for _, stored := range paths {
		resolved, err := resolveStoredFilePath(stored)
		if err != nil {
			result.Invalid++
			continue
		}
		info, err := os.Stat(resolved)
		if os.IsNotExist(err) {
			result.Missing++
			continue
		}
		if err != nil || !info.Mode().IsRegular() {
			result.Invalid++
			continue
		}
		if info.Size() == 0 {
			result.Empty++
			continue
		}
		result.Available++
	}
	return result
}
