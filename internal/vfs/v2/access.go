package v2

import (
	"MyServer/internal/common"
	"context"
)

type Authorizer interface {
	Can(ctx context.Context, actor Actor, action common.Action, ref common.ResourceRef) (bool, error)
}

type ACLAuthorizer struct {
}

func (a *ACLAuthorizer) Can(ctx context.Context, actor Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	return true, nil
}