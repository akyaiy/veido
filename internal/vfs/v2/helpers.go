package v2

import (
	"MyServer/internal/common"
	"context"
	"fmt"
	"path"
)

func parentResourceRef(ref common.ResourceRef) common.ResourceRef {
	ref.Path = path.Dir(path.Clean("/" + ref.Path))
	return ref
}

func splitResourcePath(resourcePath string) (parentPath string, name string) {
	cleanPath := path.Clean("/" + resourcePath)
	return path.Dir(cleanPath), path.Base(cleanPath)
}

func (c *VFSCore) requireResourceAccess(ctx context.Context, actor Actor, action common.Action, ref common.ResourceRef) error {
	ok, err := c.authorizer.Can(ctx, actor, action, ref)
	if err != nil {
		return err
	}
	if !ok {
		return WrapError(ErrPermissionDenied, fmt.Errorf("cannot access %s", ref.Path))
	}
	return nil
}