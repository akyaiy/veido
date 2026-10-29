package v2

import (
	"github.com/akyaiy/veido/internal/common"
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

// requireTraverseAccess enforces x on every non-root ancestor of ref. Entering
// the scope root is checked separately by resolveResource through its synthetic
// scope resource, so ACL does not need to model a path-node for "/".
func (c *VFSCore) requireTraverseAccess(ctx context.Context, actor Actor, ref common.ResourceRef) error {
	for ancestor := parentResourceRef(ref); ancestor.Path != "/"; ancestor = parentResourceRef(ancestor) {
		if err := c.requireResourceAccess(ctx, actor, common.ActionExec, ancestor); err != nil {
			return err
		}
	}
	return nil
}
