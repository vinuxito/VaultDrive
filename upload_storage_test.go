package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveStoredFilePathMapsLegacyUploadsPrefix(t *testing.T) {
	root := t.TempDir()
	t.Setenv("UPLOAD_DIR", root)

	got, err := resolveStoredFilePath(filepath.Join("uploads", "nested", "cipher.bin"))
	if err != nil {
		t.Fatalf("resolveStoredFilePath returned error: %v", err)
	}

	want := filepath.Join(root, "nested", "cipher.bin")
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestResolveStoredFilePathPreservesConfiguredAbsolutePath(t *testing.T) {
	root := t.TempDir()
	t.Setenv("UPLOAD_DIR", root)
	stored := filepath.Join(root, "cipher.bin")

	got, err := resolveStoredFilePath(stored)
	if err != nil {
		t.Fatalf("resolveStoredFilePath returned error: %v", err)
	}
	if got != stored {
		t.Fatalf("got %q, want %q", got, stored)
	}
}

func TestResolveStoredFilePathRejectsTraversalAndOutsideAbsolutePath(t *testing.T) {
	root := t.TempDir()
	t.Setenv("UPLOAD_DIR", root)

	for _, stored := range []string{
		filepath.Join("uploads", "..", "..", "secret"),
		filepath.Join(filepath.Dir(root), "outside.bin"),
	} {
		t.Run(stored, func(t *testing.T) {
			if _, err := resolveStoredFilePath(stored); err == nil {
				t.Fatalf("expected %q to be rejected", stored)
			}
		})
	}
}

func TestCheckStoredFilePathsReportsMissingOrEmptyCorpus(t *testing.T) {
	root := t.TempDir()
	t.Setenv("UPLOAD_DIR", root)

	if err := os.WriteFile(filepath.Join(root, "present.bin"), []byte("ciphertext"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "empty.bin"), nil, 0600); err != nil {
		t.Fatal(err)
	}

	result := checkStoredFilePaths([]string{
		filepath.Join("uploads", "present.bin"),
		filepath.Join("uploads", "empty.bin"),
		filepath.Join("uploads", "missing.bin"),
	})

	if result.Total != 3 || result.Available != 1 || result.Missing != 1 || result.Empty != 1 {
		t.Fatalf("unexpected result: %+v", result)
	}
}
