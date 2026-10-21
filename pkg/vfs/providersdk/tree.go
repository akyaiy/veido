// Package providersdk builds VFS providers from resource handlers, ordinary
// filesystem backends, or a composition of both. It does not authorize calls;
// production requests must enter through the VFS core.
package providersdk

import (
	"MyServer/internal/pathmap"
	"MyServer/internal/vfs/v2/virtfs"
	"MyServer/pkg/vfs"
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"strings"
	"time"
)

type Unit struct{}

type entry struct {
	pattern  string
	handler  virtfs.Handler
	children []*entry
	hidden   bool
	info     RouteInfo
	commands map[string]func(context.Context, Request, []byte) ([]byte, error)
}

// Tree is a build-time declaration. Build freezes it; the resulting Provider
// is safe for concurrent requests if domain handlers are safe for concurrency.
type Tree struct {
	entries  []*entry
	err      error
	built    bool
	root     *Resource[Unit]
	observer func(Trace)
}

type Resource[T any] struct {
	tree  *Tree
	entry *entry
	load  func(context.Context, Request) (T, error)
}

type RouteInfo struct {
	Path       string        `json:"path"`
	Kind       string        `json:"kind"`
	Summary    string        `json:"summary,omitempty"`
	Hidden     bool          `json:"hidden,omitempty"`
	Operations []string      `json:"operations"`
	Schema     any           `json:"schema,omitempty"`
	Commands   []CommandInfo `json:"commands,omitempty"`
}

type CommandInfo struct {
	Name   string `json:"name"`
	Input  any    `json:"input"`
	Output any    `json:"output"`
}

type Trace struct {
	Operation string
	Path      string
	Pattern   string
	Duration  time.Duration
	Err       error
}

func New() *Tree {
	t := &Tree{}
	e := &entry{pattern: "/", info: RouteInfo{Path: "/", Kind: "directory"}}
	t.entries = append(t.entries, e)
	t.root = &Resource[Unit]{tree: t, entry: e, load: func(context.Context, Request) (Unit, error) { return Unit{}, nil }}
	configureDirectory(t.root)
	return t
}

func (t *Tree) Root() *Resource[Unit] { return t.root }
func (t *Tree) Observe(observer func(Trace)) {
	if t.mutable() {
		t.observer = observer
	}
}
func (t *Tree) mutable() bool {
	if t.built {
		t.err = errors.Join(t.err, fmt.Errorf("provider tree is already built"))
		return false
	}
	return true
}

func validName(name string) bool {
	return name != "" && name != "." && name != ".." && !strings.ContainsAny(name, "/\\\x00{}*")
}

func add[P, T any](parent *Resource[P], name string, load func(context.Context, Request) (T, error), dynamic bool) *Resource[T] {
	t := parent.tree
	e := &entry{pattern: path.Join(parent.entry.pattern, name)}
	e.info.Path = e.pattern
	r := &Resource[T]{tree: t, entry: e, load: load}
	if !t.mutable() {
		return r
	}
	if !dynamic && !validName(name) {
		t.err = errors.Join(t.err, fmt.Errorf("invalid resource name %q", name))
	}
	if parent.entry.handler.ReadDir == nil {
		t.err = errors.Join(t.err, fmt.Errorf("%s is not a directory", parent.entry.pattern))
	}
	t.entries = append(t.entries, e)
	if !dynamic {
		parent.entry.children = append(parent.entry.children, e)
	}
	return r
}

func Directory[T any](parent *Resource[T], name string) *Resource[T] {
	r := add(parent, name, parent.load, false)
	configureDirectory(r)
	return r
}

func configureDirectory[T any](r *Resource[T]) {
	r.entry.info.Kind = "directory"
	r.entry.handler.Stat = func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
		if _, err := r.load(ctx, request(req)); err != nil {
			return nil, err
		}
		return DirNode(path.Base(req.Path)), nil
	}
	r.entry.handler.ReadDir = func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
		if _, err := r.load(ctx, request(req)); err != nil {
			return nil, err
		}
		nodes := make([]*vfs.Node, 0, len(r.entry.children))
		for _, child := range r.entry.children {
			if child.hidden {
				continue
			}
			childPath := path.Join(req.Path, path.Base(child.pattern))
			match, _ := pathmap.MatchPath(child.pattern, childPath)
			node, err := child.handler.Stat(ctx, virtfs.Request{Path: childPath, Match: match})
			if errors.Is(err, os.ErrNotExist) || errors.Is(err, vfs.ErrNotFound) {
				continue
			}
			if err != nil {
				return nil, err
			}
			if node == nil {
				return nil, fmt.Errorf("%w: nil metadata for %s", vfs.ErrInternal, childPath)
			}
			nodes = append(nodes, node)
		}
		return nodes, nil
	}
}

func request(req virtfs.Request) Request { return Request{Path: req.Path, Match: req.Match} }

func DirNode(name string) *vfs.Node {
	return &vfs.Node{Name: name, Kind: "dir", IsDir: true, UpdatedAt: time.Now()}
}
func FileNode(name string, size int64) *vfs.Node {
	return &vfs.Node{Name: name, Kind: "file", Size: size, UpdatedAt: time.Now()}
}

func (r *Resource[T]) Hidden() *Resource[T] {
	if r.tree.mutable() {
		r.entry.hidden = true
		r.entry.info.Hidden = true
	}
	return r
}
func (r *Resource[T]) Describe(summary string) *Resource[T] {
	if r.tree.mutable() {
		r.entry.info.Summary = summary
	}
	return r
}

// Metadata avoids rendering a document just to determine its size. Supply
// accurate size/time when known; default generated documents compute size.
func (r *Resource[T]) Metadata(fn func(context.Context, Request, T) (*vfs.Node, error)) *Resource[T] {
	if !r.tree.mutable() {
		return r
	}
	if fn == nil {
		r.tree.err = errors.Join(r.tree.err, fmt.Errorf("nil metadata handler"))
		return r
	}
	r.entry.handler.Stat = func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
		value, err := r.load(ctx, request(req))
		if err != nil {
			return nil, err
		}
		return fn(ctx, request(req), value)
	}
	return r
}

func (r *Resource[T]) Mkdir(fn func(context.Context, Request, T, string) (*vfs.Node, error)) *Resource[T] {
	if !r.tree.mutable() {
		return r
	}
	if fn == nil {
		return r
	}
	r.entry.handler.Mkdir = func(ctx context.Context, req virtfs.Request, name string) (*vfs.Node, error) {
		if !validName(name) {
			return nil, vfs.ErrInvalidArgument
		}
		value, err := r.load(ctx, request(req))
		if err != nil {
			return nil, err
		}
		return fn(ctx, request(req), value, name)
	}
	return r
}

func (r *Resource[T]) Delete(fn func(context.Context, Request, T) error) *Resource[T] {
	if !r.tree.mutable() {
		return r
	}
	if fn == nil {
		return r
	}
	r.entry.handler.Delete = func(ctx context.Context, req virtfs.Request) error {
		value, err := r.load(ctx, request(req))
		if err != nil {
			return err
		}
		return fn(ctx, request(req), value)
	}
	return r
}

func (r *Resource[T]) Move(fn func(context.Context, Request, T, string, string) error) *Resource[T] {
	if !r.tree.mutable() {
		return r
	}
	if fn == nil {
		return r
	}
	r.entry.handler.Move = func(ctx context.Context, req virtfs.Request, target, name string) error {
		if name != "" && !validName(name) {
			return vfs.ErrInvalidArgument
		}
		value, err := r.load(ctx, request(req))
		if err != nil {
			return err
		}
		return fn(ctx, request(req), value, target, name)
	}
	return r
}

// Build validates the whole declaration before exposing any routes.
func (t *Tree) Build() (*Provider, error) {
	if !t.mutable() {
		return nil, t.err
	}
	for i, e := range t.entries {
		if e.handler.Stat == nil {
			t.err = errors.Join(t.err, fmt.Errorf("missing metadata: %s", e.pattern))
		}
		for _, other := range t.entries[:i] {
			if overlaps(e.pattern, other.pattern) {
				t.err = errors.Join(t.err, fmt.Errorf("conflicting routes: %s and %s", e.pattern, other.pattern))
			}
		}
	}
	if t.err != nil {
		return nil, t.err
	}
	t.built = true
	fs := virtfs.New()
	for _, e := range t.entries {
		fs.Route(e.pattern, e.handler)
	}
	return &Provider{fs: fs, entries: t.entries, observer: t.observer}, nil
}

func overlaps(a, b string) bool {
	aa, bb := strings.Split(a, "/"), strings.Split(b, "/")
	if len(aa) != len(bb) {
		return false
	}
	for i := range aa {
		if aa[i] != bb[i] && !strings.HasPrefix(aa[i], "{") && !strings.HasPrefix(bb[i], "{") {
			return false
		}
	}
	return true
}

type Provider struct {
	fs       *virtfs.FS
	entries  []*entry
	observer func(Trace)
}

func (p *Provider) begin(ctx context.Context, op, rawPath string) (context.Context, func(error)) {
	ctx = context.WithValue(ctx, cacheContextKey{}, &operationCache{values: make(map[cacheKey]cachedValue)})
	start := time.Now()
	return ctx, func(err error) {
		if p.observer == nil {
			return
		}
		pattern := ""
		for _, e := range p.entries {
			if _, ok := pathmap.MatchPath(e.pattern, rawPath); ok {
				pattern = e.pattern
				break
			}
		}
		p.observer(Trace{op, rawPath, pattern, time.Since(start), err})
	}
}

func (p *Provider) Stat(ctx context.Context, path string) (node *vfs.Node, err error) {
	ctx, done := p.begin(ctx, "stat", path)
	defer func() { done(err) }()
	if err = ctx.Err(); err != nil {
		return
	}
	return p.fs.Stat(ctx, path)
}
func (p *Provider) ReadDir(ctx context.Context, path string) (nodes []*vfs.Node, err error) {
	ctx, done := p.begin(ctx, "read_dir", path)
	defer func() { done(err) }()
	if err = ctx.Err(); err != nil {
		return
	}
	return p.fs.ReadDir(ctx, path)
}
func (p *Provider) OpenFile(ctx context.Context, path string, flags int) (file vfs.File, err error) {
	ctx, done := p.begin(ctx, "open_file", path)
	defer func() { done(err) }()
	if err = ctx.Err(); err != nil {
		return
	}
	return p.fs.OpenFile(ctx, path, flags)
}
func (p *Provider) Mkdir(ctx context.Context, path, name string) (node *vfs.Node, err error) {
	ctx, done := p.begin(ctx, "mkdir", path)
	defer func() { done(err) }()
	if err = ctx.Err(); err != nil {
		return
	}
	return p.fs.Mkdir(ctx, path, name)
}
func (p *Provider) Delete(ctx context.Context, path string) (err error) {
	ctx, done := p.begin(ctx, "delete", path)
	defer func() { done(err) }()
	if err = ctx.Err(); err != nil {
		return
	}
	return p.fs.Delete(ctx, path)
}
func (p *Provider) Move(ctx context.Context, source, target, name string) (err error) {
	ctx, done := p.begin(ctx, "move", source)
	defer func() { done(err) }()
	if err = ctx.Err(); err != nil {
		return
	}
	return p.fs.Move(ctx, source, target, name)
}
func (p *Provider) Control(ctx context.Context, path, command string, input []byte) (output []byte, err error) {
	ctx, done := p.begin(ctx, "control", path)
	defer func() { done(err) }()
	if err = ctx.Err(); err != nil {
		return
	}
	return p.fs.Control(ctx, path, command, input)
}

// Routes returns a detached description, including supported operations (not ACL).
func (p *Provider) Routes() []RouteInfo {
	out := make([]RouteInfo, 0, len(p.entries))
	for _, e := range p.entries {
		info := e.info
		info.Schema = cloneSchema(info.Schema)
		info.Commands = append([]CommandInfo(nil), info.Commands...)
		for i := range info.Commands {
			info.Commands[i].Input = cloneSchema(info.Commands[i].Input)
			info.Commands[i].Output = cloneSchema(info.Commands[i].Output)
		}
		info.Operations = []string{"stat"}
		h := e.handler
		for _, op := range []struct {
			name    string
			enabled bool
		}{
			{"read_dir", h.ReadDir != nil}, {"open_file", h.OpenFile != nil}, {"mkdir", h.Mkdir != nil}, {"delete", h.Delete != nil}, {"move", h.Move != nil}, {"control", h.Control != nil},
		} {
			if op.enabled {
				info.Operations = append(info.Operations, op.name)
			}
		}
		out = append(out, info)
	}
	return out
}
