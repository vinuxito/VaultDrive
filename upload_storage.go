package main

import "os"

func uploadStorageDir() string {
	if dir := os.Getenv("UPLOAD_DIR"); dir != "" {
		return dir
	}
	return "uploads"
}
