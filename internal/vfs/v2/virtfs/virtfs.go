// Package virtfs helps build synthetic VFS providers.
//
// It is meant for providers that do not translate an existing filesystem, but
// instead expose a virtual tree such as /scopes, /health, /config.json, or
// command-like files.
package virtfs

import (
	"github.com/akyaiy/veido/internal/pathmap"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"errors"
	"os"
	"path"
	"strings"
	"time"
)

type Match = pathmap.Match

// Request is passed to route handlers.
type Request struct {
	Path  string
	Match Match
}

type StatFunc func(ctx context.Context, req Request) (*vfs.Node, error)
type ReadDirFunc func(ctx context.Context, req Request) ([]*vfs.Node, error)
type OpenFileFunc func(ctx context.Context, req Request, flags int) (vfs.File, error)
type ControlFunc func(ctx context.Context, req Request, command string, input []byte) ([]byte, error)
type MkdirFunc func(ctx context.Context, req Request, name string) (*vfs.Node, error)
type CreateFileFunc func(ctx context.Context, req Request, name string, flags int) (vfs.File, error)
type DeleteFunc func(ctx context.Context, req Request) error
type MoveFunc func(ctx context.Context, req Request, targetParentPath string, newName string) error

// Handler describes one virtual node route.
type Handler struct {
	Stat       StatFunc
	ReadDir    ReadDirFunc
	OpenFile   OpenFileFunc
	Control    ControlFunc
	Mkdir      MkdirFunc
	CreateFile CreateFileFunc
	Delete     DeleteFunc
	Move       MoveFunc
}

// FS is a route-based in-memory/synthetic filesystem.
//
// FS implements vfs.FSProvider. Mutating operations are denied by default.
type FS struct {
	routes []route
}

type route struct {
	pattern string
	handler Handler
}

func New() *FS {
	return &FS{}
}

func (fs *FS) Route(pattern string, handler Handler) *FS {
	if fs == nil {
		return fs
	}
	fs.routes = append(fs.routes, route{
		pattern: clean(pattern),
		handler: handler,
	})
	return fs
}

func (fs *FS) Dir(pattern string, readDir ReadDirFunc) *FS {
	return fs.Route(pattern, Handler{
		Stat: func(ctx context.Context, req Request) (*vfs.Node, error) {
			return DirNode(path.Base(req.Path)), nil
		},
		ReadDir: readDir,
	})
}

func (fs *FS) File(pattern string, open OpenFileFunc) *FS {
	return fs.Route(pattern, Handler{
		Stat: func(ctx context.Context, req Request) (*vfs.Node, error) {
			return FileNode(path.Base(req.Path), 0), nil
		},
		OpenFile: open,
	})
}

// GeneratedFile exposes a read-only file whose contents are generated when
// Stat or OpenFile is called.
func (fs *FS) GeneratedFile(pattern string, read func(ctx context.Context, req Request) ([]byte, error)) *FS {
	return fs.Route(pattern, Handler{
		Stat: func(ctx context.Context, req Request) (*vfs.Node, error) {
			data, err := read(ctx, req)
			if err != nil {
				return nil, err
			}
			return FileNode(path.Base(req.Path), int64(len(data))), nil
		},
		OpenFile: func(ctx context.Context, req Request, flags int) (vfs.File, error) {
			if wantsWrite(flags) {
				return nil, os.ErrPermission
			}
			data, err := read(ctx, req)
			if err != nil {
				return nil, err
			}
			return NewReadOnlyFile(path.Base(req.Path), data), nil
		},
	})
}

// WritableGeneratedFile exposes a file that can be read as generated content
// and overwritten with buffered bytes committed on Close.
func (fs *FS) WritableGeneratedFile(pattern string, read func(ctx context.Context, req Request) ([]byte, error), write func(ctx context.Context, req Request, data []byte) error) *FS {
	return fs.Route(pattern, Handler{
		Stat: func(ctx context.Context, req Request) (*vfs.Node, error) {
			data, err := read(ctx, req)
			if err != nil {
				return nil, err
			}
			return FileNode(path.Base(req.Path), int64(len(data))), nil
		},
		OpenFile: func(ctx context.Context, req Request, flags int) (vfs.File, error) {
			if wantsWrite(flags) {
				return NewBufferedWriteFile(path.Base(req.Path), func(data []byte) error {
					return write(ctx, req, data)
				}), nil
			}
			data, err := read(ctx, req)
			if err != nil {
				return nil, err
			}
			return NewReadOnlyFile(path.Base(req.Path), data), nil
		},
	})
}

// BufferedWriteFile exposes a file that accepts writes and calls write on Close.
// It is useful for command-like files where the written bytes are the command
// payload.
func (fs *FS) BufferedWriteFile(pattern string, write func(ctx context.Context, req Request, data []byte) error) *FS {
	return fs.Route(pattern, Handler{
		Stat: func(ctx context.Context, req Request) (*vfs.Node, error) {
			return FileNode(path.Base(req.Path), 0), nil
		},
		OpenFile: func(ctx context.Context, req Request, flags int) (vfs.File, error) {
			if !wantsWrite(flags) {
				return nil, os.ErrPermission
			}
			return NewBufferedWriteFile(path.Base(req.Path), func(data []byte) error {
				return write(ctx, req, data)
			}), nil
		},
	})
}

func (fs *FS) Stat(ctx context.Context, rawPath string) (*vfs.Node, error) {
	req, handler, err := fs.match(rawPath)
	if err != nil {
		return nil, err
	}
	if handler.Stat == nil {
		return nil, os.ErrNotExist
	}
	return handler.Stat(ctx, req)
}

func (fs *FS) ReadDir(ctx context.Context, rawPath string) ([]*vfs.Node, error) {
	req, handler, err := fs.match(rawPath)
	if err != nil {
		return nil, err
	}
	if handler.ReadDir == nil {
		return nil, os.ErrInvalid
	}
	return handler.ReadDir(ctx, req)
}

func (fs *FS) OpenFile(ctx context.Context, rawPath string, flags int) (vfs.File, error) {
	req, handler, err := fs.match(rawPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) && flags&os.O_CREATE != 0 {
			return fs.createFile(ctx, rawPath, flags)
		}
		return nil, err
	}
	if handler.OpenFile == nil {
		return nil, os.ErrInvalid
	}
	return handler.OpenFile(ctx, req, flags)
}

func (fs *FS) Mkdir(ctx context.Context, parentPath string, name string) (*vfs.Node, error) {
	req, handler, err := fs.match(parentPath)
	if err != nil {
		return nil, err
	}
	if handler.Mkdir == nil {
		return nil, os.ErrPermission
	}
	return handler.Mkdir(ctx, req, name)
}

func (fs *FS) Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error {
	req, handler, err := fs.match(sourcePath)
	if err != nil {
		return err
	}
	if handler.Move == nil {
		return os.ErrPermission
	}
	return handler.Move(ctx, req, targetParentPath, newName)
}

func (fs *FS) Delete(ctx context.Context, rawPath string) error {
	req, handler, err := fs.match(rawPath)
	if err != nil {
		return err
	}
	if handler.Delete == nil {
		return os.ErrPermission
	}
	return handler.Delete(ctx, req)
}

func (fs *FS) Control(ctx context.Context, rawPath string, command string, input []byte) ([]byte, error) {
	req, handler, err := fs.match(rawPath)
	if err != nil {
		return nil, err
	}
	if handler.Control == nil {
		return nil, vfs.ErrNotImplemented
	}
	return handler.Control(ctx, req, command, input)
}

func (fs *FS) match(rawPath string) (Request, Handler, error) {
	cleaned := clean(rawPath)
	for _, route := range fs.routes {
		match, ok := pathmap.MatchPath(route.pattern, cleaned)
		if !ok {
			continue
		}
		return Request{
			Path:  cleaned,
			Match: match,
		}, route.handler, nil
	}
	return Request{}, Handler{}, os.ErrNotExist
}

func (fs *FS) createFile(ctx context.Context, rawPath string, flags int) (vfs.File, error) {
	parentPath, name := splitParent(rawPath)
	req, handler, err := fs.match(parentPath)
	if err != nil {
		return nil, err
	}
	if handler.CreateFile == nil {
		return nil, os.ErrPermission
	}
	return handler.CreateFile(ctx, req, name, flags)
}

func DirNode(name string) *vfs.Node {
	if name == "." || name == "/" {
		name = "/"
	}
	return &vfs.Node{
		Name:      name,
		Kind:      "dir",
		IsDir:     true,
		UpdatedAt: time.Now(),
	}
}

func FileNode(name string, size int64) *vfs.Node {
	return &vfs.Node{
		Name:      name,
		Kind:      "file",
		IsDir:     false,
		Size:      size,
		UpdatedAt: time.Now(),
	}
}

func clean(rawPath string) string {
	if rawPath == "" || rawPath == "." {
		return "/"
	}
	if !strings.HasPrefix(rawPath, "/") {
		rawPath = "/" + rawPath
	}
	return path.Clean(rawPath)
}

func wantsWrite(flags int) bool {
	return flags&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_TRUNC|os.O_CREATE) != 0
}

func splitParent(rawPath string) (string, string) {
	cleaned := clean(rawPath)
	parent, name := path.Split(cleaned)
	parent = clean(parent)
	return parent, name
}
