package providersdk

import (
	"github.com/akyaiy/veido/pkg/vfs"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"reflect"
	"sort"
	"strings"
	"sync"
)

type Mount struct {
	Path     string
	Provider vfs.FSProvider
	// Hidden hides the mount from its parent's listing, not from direct access.
	Hidden bool
	// PreservePath supports existing providers that already use the mount prefix.
	PreservePath bool
}

// Compose overlays explicit, non-overlapping subtrees on an ordinary provider.
// A mount shadows the backend name even when hidden or returning not-found.
// Moves across mount boundaries and mutations of mount roots are denied.
// The result owns Close for the base and each mounted provider.
func Compose(base vfs.FSProvider, mounts ...Mount) (vfs.FSProvider, error) {
	if base == nil {
		return nil, fmt.Errorf("%w: nil base provider", vfs.ErrInvalidArgument)
	}
	copyMounts := append([]Mount(nil), mounts...)
	for i, m := range copyMounts {
		if m.Provider == nil || m.Path == "/" || m.Path != path.Clean(m.Path) || !strings.HasPrefix(m.Path, "/") {
			return nil, fmt.Errorf("%w: invalid mount %q", vfs.ErrInvalidArgument, m.Path)
		}
		for _, segment := range strings.Split(strings.TrimPrefix(m.Path, "/"), "/") {
			if !validName(segment) {
				return nil, fmt.Errorf("%w: invalid mount", vfs.ErrInvalidArgument)
			}
		}
		for _, other := range copyMounts[:i] {
			if under(m.Path, other.Path) || under(other.Path, m.Path) {
				return nil, fmt.Errorf("%w: overlapping mounts", vfs.ErrInvalidArgument)
			}
		}
	}
	return &composite{base: base, mounts: copyMounts}, nil
}

type composite struct {
	base      vfs.FSProvider
	mounts    []Mount
	closeOnce sync.Once
	closeErr  error
}

type mountedBound struct {
	vfs.BoundVFS
	prefix string
}

func (b mountedBound) SelfURI(p string) (vfs.URI, error) {
	return b.BoundVFS.SelfURI(b.prefix + clean(p))
}
func (c *composite) mountContext(ctx context.Context, i int) context.Context {
	if i < 0 || c.mounts[i].PreservePath {
		return ctx
	}
	if bound, ok := vfs.BoundVFSFromContext(ctx); ok {
		return vfs.ContextWithBoundVFS(ctx, mountedBound{BoundVFS: bound, prefix: c.mounts[i].Path})
	}
	return ctx
}

func under(p, prefix string) bool { return p == prefix || strings.HasPrefix(p, prefix+"/") }
func (c *composite) resolve(raw string) (vfs.FSProvider, string, int) {
	p := path.Clean("/" + raw)
	for i, m := range c.mounts {
		if under(p, m.Path) {
			if !m.PreservePath {
				p = strings.TrimPrefix(p, m.Path)
				if p == "" {
					p = "/"
				}
			}
			return m.Provider, p, i
		}
	}
	return c.base, p, -1
}
func (c *composite) protected(raw string) bool {
	p := path.Clean("/" + raw)
	for _, m := range c.mounts {
		if under(m.Path, p) {
			return true
		}
	}
	return false
}
func (c *composite) Stat(ctx context.Context, path string) (*vfs.Node, error) {
	p, rel, i := c.resolve(path)
	n, err := p.Stat(c.mountContext(ctx, i), rel)
	if err != nil || n == nil {
		return n, err
	}
	copy := *n
	if i >= 0 && clean(path) == c.mounts[i].Path {
		copy.Name = baseName(path)
	}
	return &copy, nil
}
func (c *composite) OpenFile(ctx context.Context, path string, flags int) (vfs.File, error) {
	if wantsWrite(flags) && c.protected(path) {
		return nil, os.ErrPermission
	}
	p, rel, i := c.resolve(path)
	return p.OpenFile(c.mountContext(ctx, i), rel, flags)
}
func (c *composite) ReadDir(ctx context.Context, raw string) ([]*vfs.Node, error) {
	p, rel, i := c.resolve(raw)
	nodes, err := p.ReadDir(c.mountContext(ctx, i), rel)
	if err != nil || i >= 0 {
		return nodes, err
	}
	result := make([]*vfs.Node, 0, len(nodes)+len(c.mounts))
	shadow := map[string]bool{}
	for _, m := range c.mounts {
		if path.Dir(m.Path) == clean(raw) {
			shadow[path.Base(m.Path)] = true
		}
	}
	for _, n := range nodes {
		if n != nil && !shadow[n.Name] {
			result = append(result, n)
		}
	}
	for _, m := range c.mounts {
		if path.Dir(m.Path) == clean(raw) && !m.Hidden {
			n, err := c.Stat(ctx, m.Path)
			if errors.Is(err, os.ErrNotExist) || errors.Is(err, vfs.ErrNotFound) {
				continue
			}
			if err != nil {
				return nil, err
			}
			if n == nil || !n.IsDir {
				return nil, fmt.Errorf("%w: mount root must be a directory", vfs.ErrInternal)
			}
			result = append(result, n)
		}
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	return result, nil
}
func (c *composite) Mkdir(ctx context.Context, parent, name string) (*vfs.Node, error) {
	if !validName(name) {
		return nil, vfs.ErrInvalidArgument
	}
	target := path.Join(clean(parent), name)
	if c.protected(target) {
		return nil, os.ErrPermission
	}
	p, rel, i := c.resolve(parent)
	return p.Mkdir(c.mountContext(ctx, i), rel, name)
}
func (c *composite) Delete(ctx context.Context, path string) error {
	if c.protected(path) {
		return os.ErrPermission
	}
	p, rel, i := c.resolve(path)
	return p.Delete(c.mountContext(ctx, i), rel)
}
func (c *composite) Move(ctx context.Context, source, target, name string) error {
	if name == "" {
		name = baseName(source)
	}
	if !validName(name) {
		return vfs.ErrInvalidArgument
	}
	if c.protected(source) || c.protected(path.Join(clean(target), name)) {
		return os.ErrPermission
	}
	p, src, si := c.resolve(source)
	_, dst, di := c.resolve(target)
	if si != di {
		return vfs.ErrUnsupported
	}
	return p.Move(c.mountContext(ctx, si), src, dst, name)
}
func (c *composite) Control(ctx context.Context, path, command string, data []byte) ([]byte, error) {
	p, rel, i := c.resolve(path)
	return p.Control(c.mountContext(ctx, i), rel, command, data)
}
func (c *composite) Close() error {
	c.closeOnce.Do(func() {
		var errs []error
		seen := map[io.Closer]bool{}
		for _, p := range append([]vfs.FSProvider{c.base}, mountProviders(c.mounts)...) {
			if closer, ok := p.(io.Closer); ok {
				if reflect.TypeOf(closer).Comparable() {
					if seen[closer] {
						continue
					}
					seen[closer] = true
				}
				errs = append(errs, closer.Close())
			}
		}
		c.closeErr = errors.Join(errs...)
	})
	return c.closeErr
}
func mountProviders(mounts []Mount) []vfs.FSProvider {
	p := make([]vfs.FSProvider, 0, len(mounts))
	for _, m := range mounts {
		p = append(p, m.Provider)
	}
	return p
}
func clean(p string) string    { return path.Clean("/" + p) }
func baseName(p string) string { return path.Base(clean(p)) }
