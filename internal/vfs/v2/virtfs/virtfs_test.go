package virtfs

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"errors"
	"io"
	"os"
	"testing"
)

func TestGeneratedFileStatAndOpenFile(t *testing.T) {
	fs := New().
		Dir("/", func(ctx context.Context, req Request) ([]*vfs.Node, error) {
			return []*vfs.Node{FileNode("info.txt", 5)}, nil
		}).
		GeneratedFile("/info.txt", func(ctx context.Context, req Request) ([]byte, error) {
			return []byte("hello"), nil
		})

	node, err := fs.Stat(context.Background(), "/info.txt")
	if err != nil {
		t.Fatalf("Stat() error = %v", err)
	}
	if node.IsDir || node.Size != 5 {
		t.Fatalf("Stat() node = %+v, want file size 5", node)
	}

	file, err := fs.OpenFile(context.Background(), "/info.txt", os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile() error = %v", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}
	if string(data) != "hello" {
		t.Fatalf("ReadAll() = %q, want %q", data, "hello")
	}
}

func TestDirectoryCannotOpenAsFile(t *testing.T) {
	fs := New().Dir("/", func(ctx context.Context, req Request) ([]*vfs.Node, error) {
		return nil, nil
	})

	_, err := fs.OpenFile(context.Background(), "/", os.O_RDONLY)
	if !errors.Is(err, os.ErrInvalid) {
		t.Fatalf("OpenFile(dir) error = %v, want %v", err, os.ErrInvalid)
	}
}

func TestBufferedWriteFileCommitsOnClose(t *testing.T) {
	var got string
	fs := New().BufferedWriteFile("/reload", func(ctx context.Context, req Request, data []byte) error {
		got = string(data)
		return nil
	})

	file, err := fs.OpenFile(context.Background(), "/reload", os.O_WRONLY)
	if err != nil {
		t.Fatalf("OpenFile(write file) error = %v", err)
	}
	if _, err := file.Write([]byte("now")); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	if got != "now" {
		t.Fatalf("committed data = %q, want %q", got, "now")
	}
}

func TestControlDefaultsToNotImplemented(t *testing.T) {
	fs := New().Dir("/", func(ctx context.Context, req Request) ([]*vfs.Node, error) {
		return nil, nil
	})

	_, err := fs.Control(context.Background(), "/", "ping", nil)
	if !errors.Is(err, vfs.ErrNotImplemented) {
		t.Fatalf("Control() error = %v, want %v", err, vfs.ErrNotImplemented)
	}
}
