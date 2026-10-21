package providersdk

import (
	"MyServer/pkg/vfs"
	"context"
	"io"
	"io/fs"
	"os"
	"strings"
)

// Backend is the small read contract for ordinary filesystem providers.
// Returned readers may implement io.Seeker; the SDK never buffers whole blobs.
type Backend interface {
	Stat(context.Context, string) (*vfs.Node, error)
	ReadDir(context.Context, string) ([]*vfs.Node, error)
	OpenRead(context.Context, string) (io.ReadCloser, error)
}
type WriteBackend interface {
	OpenWrite(context.Context, string, int) (vfs.File, error)
}
type MkdirBackend interface {
	Mkdir(context.Context, string, string) (*vfs.Node, error)
}
type MoveBackend interface {
	Move(context.Context, string, string, string) error
}
type DeleteBackend interface {
	Delete(context.Context, string) error
}
type ControlBackend interface {
	Control(context.Context, string, string, []byte) ([]byte, error)
}

// FromBackend keeps backend-specific append, create/exclusive and rename
// semantics in the backend. Implement optional interfaces for supported writes.
func FromBackend(b Backend) vfs.FSProvider { return &backendProvider{Backend: b} }

type backendProvider struct{ Backend }

func (p *backendProvider) OpenFile(ctx context.Context, path string, flags int) (vfs.File, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if wantsWrite(flags) {
		if w, ok := p.Backend.(WriteBackend); ok {
			return w.OpenWrite(ctx, path, flags)
		}
		return nil, os.ErrPermission
	}
	node, err := p.Stat(ctx, path)
	if err != nil {
		return nil, err
	}
	if node.IsDir {
		return nil, os.ErrInvalid
	}
	r, err := p.OpenRead(ctx, path)
	if err != nil {
		return nil, err
	}
	return ReadFile(ctx, node, r), nil
}
func (p *backendProvider) Mkdir(ctx context.Context, path, name string) (*vfs.Node, error) {
	if w, ok := p.Backend.(MkdirBackend); ok {
		return w.Mkdir(ctx, path, name)
	}
	return nil, os.ErrPermission
}
func (p *backendProvider) Move(ctx context.Context, source, target, name string) error {
	if w, ok := p.Backend.(MoveBackend); ok {
		return w.Move(ctx, source, target, name)
	}
	return os.ErrPermission
}
func (p *backendProvider) Delete(ctx context.Context, path string) error {
	if w, ok := p.Backend.(DeleteBackend); ok {
		return w.Delete(ctx, path)
	}
	return os.ErrPermission
}
func (p *backendProvider) Control(ctx context.Context, path, command string, data []byte) ([]byte, error) {
	if w, ok := p.Backend.(ControlBackend); ok {
		return w.Control(ctx, path, command, data)
	}
	return nil, vfs.ErrUnsupported
}
func (p *backendProvider) Close() error {
	if c, ok := p.Backend.(io.Closer); ok {
		return c.Close()
	}
	return nil
}

// FromFS adapts a standard read-only io/fs.FS, including embed.FS and os.DirFS.
// It does not add confinement beyond the supplied filesystem implementation.
func FromFS(fsys fs.FS) vfs.FSProvider { return FromBackend(fsBackend{fsys}) }

type fsBackend struct{ fsys fs.FS }

func fsPath(path string) (string, error) {
	if path == "/" || path == "" {
		return ".", nil
	}
	name := strings.TrimPrefix(path, "/")
	if !fs.ValidPath(name) {
		return "", os.ErrInvalid
	}
	return name, nil
}
func (b fsBackend) Stat(ctx context.Context, path string) (*vfs.Node, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	name, err := fsPath(path)
	if err != nil {
		return nil, err
	}
	i, err := fs.Stat(b.fsys, name)
	if err != nil {
		return nil, err
	}
	n := fromInfo(i)
	if name == "." {
		n.Name = "/"
	}
	return n, nil
}
func (b fsBackend) ReadDir(ctx context.Context, path string) ([]*vfs.Node, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	name, err := fsPath(path)
	if err != nil {
		return nil, err
	}
	entries, err := fs.ReadDir(b.fsys, name)
	if err != nil {
		return nil, err
	}
	nodes := make([]*vfs.Node, 0, len(entries))
	for _, e := range entries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		i, err := e.Info()
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, fromInfo(i))
	}
	return nodes, nil
}
func (b fsBackend) OpenRead(ctx context.Context, path string) (io.ReadCloser, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	name, err := fsPath(path)
	if err != nil {
		return nil, err
	}
	return b.fsys.Open(name)
}
func fromInfo(i fs.FileInfo) *vfs.Node {
	kind := "file"
	if i.IsDir() {
		kind = "dir"
	}
	return &vfs.Node{Name: i.Name(), Kind: kind, IsDir: i.IsDir(), Size: i.Size(), UpdatedAt: i.ModTime()}
}
