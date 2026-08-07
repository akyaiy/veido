package v2

import (
	"MyServer/internal/common"
	"context"
)

func (c *VFSCore) Stat(ctx context.Context, actor Actor, uri common.CanonURI) (Node, error) {
	return Node{}, ErrNotImplemented
}

func (c *VFSCore) ReadDir(ctx context.Context, actor Actor, uri common.CanonURI) ([]Node, error) {
	return nil, ErrNotImplemented
}

func (c *VFSCore) OpenFile(ctx context.Context, actor Actor, uri common.CanonURI, flag int) (File, error) {
	return nil, ErrNotImplemented
}

func (c *VFSCore) Mkdir(ctx context.Context, actor Actor, uri common.CanonURI) (Node, error) {
	return Node{}, ErrNotImplemented
}

func (c *VFSCore) Move(ctx context.Context, actor Actor, source common.CanonURI, target common.CanonURI) error {
	return ErrNotImplemented
}

func (c *VFSCore) Delete(ctx context.Context, actor Actor, uri common.CanonURI) error {
	return ErrNotImplemented
}

func (c *VFSCore) Control(ctx context.Context, actor Actor, uri common.CanonURI, input []byte) ([]byte, error) {
	return nil, ErrNotImplemented
}
