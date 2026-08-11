package v2

import (
	"MyServer/internal/common"
	"context"
)

type RequestContextCtxKey struct{}

type RequestContext struct {
	ActorKey   Actor
	RequestURI common.CanonURI
	Resolved   struct {
		Address    common.ResourceAddress
		Scope      Scope
		Connection ProviderConnection
		Ref        common.ResourceRef
	}
}

func ContextWithRequestContext(ctx context.Context, rctx RequestContext) context.Context {
	return context.WithValue(ctx, RequestContextCtxKey{}, rctx)
}

func RequestContextFromContext(ctx context.Context) (RequestContext, bool) {
	rctx, ok := ctx.Value(RequestContextCtxKey{}).(RequestContext)
	return rctx, ok
}
