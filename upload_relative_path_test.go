package main

import "testing"

func TestResolveUploadRelativePathUsesExplicitRelativePath(t *testing.T) {
	storedPath, filename, relativeDir, err := resolveUploadRelativePath("client-a/nested/report.pdf", "report.pdf")
	if err != nil {
		t.Fatalf("expected explicit relative path to resolve, got error: %v", err)
	}
	if storedPath != "client-a/nested/report.pdf" {
		t.Fatalf("expected stored path to preserve nesting, got %q", storedPath)
	}
	if filename != "report.pdf" {
		t.Fatalf("expected filename report.pdf, got %q", filename)
	}
	if relativeDir != "client-a/nested" {
		t.Fatalf("expected relative directory client-a/nested, got %q", relativeDir)
	}
}

func TestResolveUploadRelativePathFallsBackToFilename(t *testing.T) {
	storedPath, filename, relativeDir, err := resolveUploadRelativePath("", "plain.txt")
	if err != nil {
		t.Fatalf("expected fallback filename to resolve, got error: %v", err)
	}
	if storedPath != "plain.txt" || filename != "plain.txt" || relativeDir != "" {
		t.Fatalf("unexpected fallback result: path=%q filename=%q dir=%q", storedPath, filename, relativeDir)
	}
}

func TestResolveUploadRelativePathRejectsTraversal(t *testing.T) {
	if _, _, _, err := resolveUploadRelativePath("../secrets.txt", "secrets.txt"); err == nil {
		t.Fatal("expected traversal path to be rejected")
	}
}
