package vfs

import (
	"context"
	"database/sql"
	"io"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func newTestLocalFSProvider(t *testing.T) FSProvider {
	t.Helper()

	dir := t.TempDir()
	db, err := sql.Open("sqlite3", filepath.Join(dir, "vfs.db")+"?_foreign_keys=on")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	repo := NewRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		t.Fatalf("migrate test db: %v", err)
	}

	return NewLocalFSProvider(db, NewLocalStorageDriver(filepath.Join(dir, "storage")))
}

func TestOpenExistingFileForWriteWithoutWritePreservesContent(t *testing.T) {
	ctx := context.Background()
	provider := newTestLocalFSProvider(t)
	content := []byte("non-empty artifact content")

	created, err := provider.OpenFile(ctx, "", "0", "file1", os.O_CREATE|os.O_WRONLY)
	if err != nil {
		t.Fatalf("create file: %v", err)
	}
	if _, err := created.Write(content); err != nil {
		t.Fatalf("write initial content: %v", err)
	}
	if err := created.Close(); err != nil {
		t.Fatalf("close created file: %v", err)
	}

	fileID, err := provider.ResolvePathToID(ctx, "/file1")
	if err != nil {
		t.Fatalf("resolve file: %v", err)
	}

	openedForWrite, err := provider.OpenFile(ctx, fileID, "", "", os.O_WRONLY)
	if err != nil {
		t.Fatalf("open existing file for write: %v", err)
	}
	if err := openedForWrite.Close(); err != nil {
		t.Fatalf("close write-opened file: %v", err)
	}

	openedForRead, err := provider.OpenFile(ctx, fileID, "", "", os.O_RDONLY)
	if err != nil {
		t.Fatalf("open existing file for read: %v", err)
	}
	defer openedForRead.Close()

	got, err := io.ReadAll(openedForRead)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if string(got) != string(content) {
		t.Fatalf("content = %q, want %q", got, content)
	}
}

func TestOpenExistingFileWithTruncateClearsContent(t *testing.T) {
	ctx := context.Background()
	provider := newTestLocalFSProvider(t)

	created, err := provider.OpenFile(ctx, "", "0", "file1", os.O_CREATE|os.O_WRONLY)
	if err != nil {
		t.Fatalf("create file: %v", err)
	}
	if _, err := created.Write([]byte("content")); err != nil {
		t.Fatalf("write initial content: %v", err)
	}
	if err := created.Close(); err != nil {
		t.Fatalf("close created file: %v", err)
	}

	fileID, err := provider.ResolvePathToID(ctx, "/file1")
	if err != nil {
		t.Fatalf("resolve file: %v", err)
	}

	truncated, err := provider.OpenFile(ctx, fileID, "", "", os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("open existing file with truncate: %v", err)
	}
	if err := truncated.Close(); err != nil {
		t.Fatalf("close truncated file: %v", err)
	}

	openedForRead, err := provider.OpenFile(ctx, fileID, "", "", os.O_RDONLY)
	if err != nil {
		t.Fatalf("open existing file for read: %v", err)
	}
	defer openedForRead.Close()

	got, err := io.ReadAll(openedForRead)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("content length = %d, want 0", len(got))
	}
}
