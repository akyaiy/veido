package providersdk

import (
	"github.com/akyaiy/veido/internal/pathmap"
	"github.com/akyaiy/veido/pkg/vfs"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
)

// Request describes a provider-local operation. Context remains the standard
// Go context; request data is never stored on a pooled provider instance.
type Request struct {
	Path  string
	Match pathmap.Match
}

func (r Request) Param(name string) string { return r.Match.Param(name) }

func Actor(ctx context.Context) (vfs.Actor, error) {
	if req, ok := vfs.RequestContextFromContext(ctx); ok {
		return req.ActorKey, nil
	}
	return vfs.Actor{}, vfs.ErrRequestContextNotFound
}

func Bound(ctx context.Context) (vfs.BoundVFS, error) {
	fs, ok := vfs.BoundVFSFromContext(ctx)
	if !ok {
		return nil, vfs.ErrRequestContextNotFound
	}
	return fs, nil
}

func SelfURI(ctx context.Context, path string) (vfs.URI, error) {
	fs, err := Bound(ctx)
	if err != nil {
		return "", err
	}
	return fs.SelfURI(path)
}

// ReadJSON always re-enters the VFS core through the actor-bound frontend.
func ReadJSON[T any](ctx context.Context, uri vfs.URI, maxBytes int64) (T, error) {
	var zero T
	fs, err := Bound(ctx)
	if err != nil {
		return zero, err
	}
	f, err := fs.OpenFile(ctx, uri, os.O_RDONLY)
	if err != nil {
		return zero, err
	}
	if maxBytes <= 0 {
		maxBytes = DefaultMaxDocumentBytes
	}
	data, readErr := io.ReadAll(io.LimitReader(f, maxBytes+1))
	if err := errors.Join(readErr, f.Close()); err != nil {
		return zero, err
	}
	if int64(len(data)) > maxBytes {
		return zero, vfs.ErrResourceExhausted
	}
	return decode[T](data, false)
}

func WriteJSON[T any](ctx context.Context, uri vfs.URI, value T) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	fs, err := Bound(ctx)
	if err != nil {
		return err
	}
	f, err := fs.OpenFile(ctx, uri, os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		return err
	}
	n, writeErr := f.Write(data)
	if writeErr == nil && n != len(data) {
		writeErr = io.ErrShortWrite
	}
	return vfs.FinishWrite(f, writeErr)
}

type cacheKey struct {
	route *entry
	path  string
}
type cachedValue struct {
	value any
	err   error
}
type operationCache struct{ values map[cacheKey]cachedValue }
type cacheContextKey struct{}

func memo[T any](ctx context.Context, key cacheKey, load func() (T, error)) (T, error) {
	cache, ok := ctx.Value(cacheContextKey{}).(*operationCache)
	if !ok {
		return load()
	}
	if item, ok := cache.values[key]; ok {
		if item.err != nil {
			var zero T
			return zero, item.err
		}
		return item.value.(T), nil
	}
	value, err := load()
	cache.values[key] = cachedValue{value, err}
	return value, err
}
