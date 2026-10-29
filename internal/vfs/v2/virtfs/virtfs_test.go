package virtfs

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
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

func TestMkdirUsesParentDirectoryHandler(t *testing.T) {
	var gotParent string
	var gotName string
	fs := New().Route("/projects", Handler{
		Stat: func(ctx context.Context, req Request) (*vfs.Node, error) {
			return DirNode("projects"), nil
		},
		Mkdir: func(ctx context.Context, req Request, name string) (*vfs.Node, error) {
			gotParent = req.Path
			gotName = name
			return DirNode(name), nil
		},
	})

	node, err := fs.Mkdir(context.Background(), "/projects", "demo")
	if err != nil {
		t.Fatalf("Mkdir() error = %v", err)
	}
	if gotParent != "/projects" || gotName != "demo" {
		t.Fatalf("handler saw parent=%q name=%q, want /projects demo", gotParent, gotName)
	}
	if node.Name != "demo" || !node.IsDir {
		t.Fatalf("Mkdir() node = %+v, want demo dir", node)
	}
}

func TestOpenFileCreateUsesParentCreateFileHandler(t *testing.T) {
	var gotName string
	var gotData string
	fs := New().Route("/configs", Handler{
		Stat: func(ctx context.Context, req Request) (*vfs.Node, error) {
			return DirNode("configs"), nil
		},
		CreateFile: func(ctx context.Context, req Request, name string, flags int) (vfs.File, error) {
			gotName = name
			return NewBufferedWriteFile(name, func(data []byte) error {
				gotData = string(data)
				return nil
			}), nil
		},
	})

	file, err := fs.OpenFile(context.Background(), "/configs/new.json", os.O_CREATE|os.O_WRONLY)
	if err != nil {
		t.Fatalf("OpenFile(O_CREATE) error = %v", err)
	}
	if _, err := file.Write([]byte(`{"ok":true}`)); err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("Close() error = %v", err)
	}
	if gotName != "new.json" || gotData != `{"ok":true}` {
		t.Fatalf("handler got name=%q data=%q", gotName, gotData)
	}
}

func TestDeleteAndMoveUseNodeHandlers(t *testing.T) {
	var deleted string
	var movedTo string
	fs := New().Route("/items/{name}", Handler{
		Stat: func(ctx context.Context, req Request) (*vfs.Node, error) {
			return FileNode(req.Match.Param("name"), 0), nil
		},
		Delete: func(ctx context.Context, req Request) error {
			deleted = req.Match.Param("name")
			return nil
		},
		Move: func(ctx context.Context, req Request, targetParentPath string, newName string) error {
			movedTo = targetParentPath + "/" + newName
			return nil
		},
	})

	if err := fs.Delete(context.Background(), "/items/old"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	if err := fs.Move(context.Background(), "/items/old", "/items", "new"); err != nil {
		t.Fatalf("Move() error = %v", err)
	}
	if deleted != "old" || movedTo != "/items/new" {
		t.Fatalf("deleted=%q movedTo=%q", deleted, movedTo)
	}
}
