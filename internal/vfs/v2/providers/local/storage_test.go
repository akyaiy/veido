package local

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLocalStorageWriterStreamsToCASPath(t *testing.T) {
	ctx := context.Background()
	driver := NewLocalStorageDriver(t.TempDir())

	writer, err := driver.Create(ctx)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	for _, chunk := range [][]byte{[]byte("hello "), []byte("streaming "), []byte("cas")} {
		if _, err := writer.Write(chunk); err != nil {
			t.Fatalf("Write(%q) error = %v", chunk, err)
		}
	}

	hash, size, err := writer.Commit(ctx)
	if err != nil {
		t.Fatalf("Commit() error = %v", err)
	}
	sum := sha256.Sum256([]byte("hello streaming cas"))
	if want := hex.EncodeToString(sum[:]); hash != want {
		t.Fatalf("hash = %s, want %s", hash, want)
	}
	if size != int64(len("hello streaming cas")) {
		t.Fatalf("size = %d, want %d", size, len("hello streaming cas"))
	}

	file, err := driver.Open(ctx, hash)
	if err != nil {
		t.Fatalf("Open(committed hash) error = %v", err)
	}
	data, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("ReadAll(committed hash) error = %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("Close(committed hash) error = %v", err)
	}
	if string(data) != "hello streaming cas" {
		t.Fatalf("data = %q, want hello streaming cas", data)
	}
}

func TestLocalStorageWriterAbortRemovesTempFile(t *testing.T) {
	ctx := context.Background()
	base := t.TempDir()
	driver := NewLocalStorageDriver(base)

	writer, err := driver.Create(ctx)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if _, err := writer.Write([]byte("partial")); err != nil {
		t.Fatalf("Write(partial) error = %v", err)
	}
	if err := writer.Abort(); err != nil {
		t.Fatalf("Abort() error = %v", err)
	}

	entries, err := os.ReadDir(filepath.Join(base, "temp"))
	if err != nil {
		t.Fatalf("ReadDir(temp) error = %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("temp entries after Abort() = %d, want 0", len(entries))
	}
}

func TestLocalStorageCleanupTempRemovesOldFiles(t *testing.T) {
	ctx := context.Background()
	base := t.TempDir()
	driver := NewLocalStorageDriver(base)

	tempDir := filepath.Join(base, "temp")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		t.Fatalf("MkdirAll(temp) error = %v", err)
	}
	oldPath := filepath.Join(tempDir, "upload-old")
	if err := os.WriteFile(oldPath, []byte("old"), 0600); err != nil {
		t.Fatalf("WriteFile(old temp) error = %v", err)
	}
	oldTime := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(oldPath, oldTime, oldTime); err != nil {
		t.Fatalf("Chtimes(old temp) error = %v", err)
	}

	if err := driver.CleanupTemp(ctx, time.Hour); err != nil {
		t.Fatalf("CleanupTemp() error = %v", err)
	}
	if _, err := os.Stat(oldPath); !os.IsNotExist(err) {
		t.Fatalf("Stat(old temp) error = %v, want os.ErrNotExist", err)
	}
}
