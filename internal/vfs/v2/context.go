package v2

import (
	"MyServer/internal/common"
	"context"
)

type RequestContextCtxKey struct{}
type actorContextKey struct{}

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

// ContextWithActor attaches the authenticated VFS actor to a transport
// request context. Protocol adapters can share this value without depending on
// the application's authentication implementation.
func ContextWithActor(ctx context.Context, actor Actor) context.Context {
	return context.WithValue(ctx, actorContextKey{}, actor)
}

// ActorFromContext returns the actor attached by the transport authentication
// middleware.
func ActorFromContext(ctx context.Context) (Actor, bool) {
	actor, ok := ctx.Value(actorContextKey{}).(Actor)
	return actor, ok
}
