package v2

import (
	"github.com/akyaiy/veido/internal/common"
	"context"
)

// BoundVFS is an interface for a virtual file system that is bound to a specific actor.
// Its essential for [FSProvider] providers to be able to call vfs with right credentials.
type BoundVFS interface {
	Stat(ctx context.Context, uri common.CanonURI) (*Node, error)
	ReadDir(ctx context.Context, uri common.CanonURI) ([]*Node, error)
	OpenFile(ctx context.Context, uri common.CanonURI, flags int) (File, error)
	Mkdir(ctx context.Context, uri common.CanonURI) (*Node, error)
	Move(ctx context.Context, source common.CanonURI, target common.CanonURI) error
	Delete(ctx context.Context, uri common.CanonURI) error
	Control(ctx context.Context, uri common.CanonURI, command string, input []byte) ([]byte, error)

	SelfURI(path string) (common.CanonURI, error)
}

type boundVFS struct {
	frontend    VFSFrontend
	actor       Actor
	selfAddress common.ResourceAddress
}

func (b boundVFS) SelfURI(resourcePath string) (common.CanonURI, error) {
	b.selfAddress.Path = resourcePath
	return b.selfAddress.URI()
}

func (b boundVFS) Stat(ctx context.Context, uri common.CanonURI) (*Node, error) {
	return b.frontend.Stat(ctx, b.actor, uri)
}

func (b boundVFS) ReadDir(ctx context.Context, uri common.CanonURI) ([]*Node, error) {
	return b.frontend.ReadDir(ctx, b.actor, uri)
}

func (b boundVFS) OpenFile(ctx context.Context, uri common.CanonURI, flags int) (File, error) {
	return b.frontend.OpenFile(ctx, b.actor, uri, flags)
}

func (b boundVFS) Mkdir(ctx context.Context, uri common.CanonURI) (*Node, error) {
	return b.frontend.Mkdir(ctx, b.actor, uri)
}

func (b boundVFS) Move(ctx context.Context, source common.CanonURI, target common.CanonURI) error {
	return b.frontend.Move(ctx, b.actor, source, target)
}

func (b boundVFS) Delete(ctx context.Context, uri common.CanonURI) error {
	return b.frontend.Delete(ctx, b.actor, uri)
}

func (b boundVFS) Control(ctx context.Context, uri common.CanonURI, command string, input []byte) ([]byte, error) {
	return b.frontend.Control(ctx, b.actor, uri, command, input)
}

type BoundVFSContextKey struct{}

func ContextWithBoundVFS(ctx context.Context, bfs BoundVFS) context.Context {
	return context.WithValue(ctx, BoundVFSContextKey{}, bfs)
}

func BoundVFSFromContext(ctx context.Context) (BoundVFS, bool) {
	bfs, ok := ctx.Value(BoundVFSContextKey{}).(BoundVFS)
	return bfs, ok
}
