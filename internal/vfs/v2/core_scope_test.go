package v2

import (
	"MyServer/internal/common"
	"context"
	"errors"
	"testing"
)

type scopeGateTestResolver struct {
	scope         Scope
	err           error
	explicitKeys  []string
	defaultActors []Actor
}

func (r *scopeGateTestResolver) ResolveExplicitScope(_ context.Context, scopeKey string) (*Scope, error) {
	r.explicitKeys = append(r.explicitKeys, scopeKey)
	if r.err != nil {
		return nil, r.err
	}
	scope := r.scope
	return &scope, nil
}

func (r *scopeGateTestResolver) ResolveDefaultScope(_ context.Context, actor Actor) (*Scope, error) {
	r.defaultActors = append(r.defaultActors, actor)
	if r.err != nil {
		return nil, r.err
	}
	scope := r.scope
	return &scope, nil
}

type scopeGateTestConnectionResolver struct {
	connection ProviderConnection
	calls      int
}

func (r *scopeGateTestConnectionResolver) ResolveConnection(_ context.Context, _ Scope, _, _ string) (*ProviderConnection, error) {
	r.calls++
	connection := r.connection
	return &connection, nil
}

type authorizationCall struct {
	action common.Action
	ref    common.ResourceRef
}

type scopeGateTestAuthorizer struct {
	calls []authorizationCall
	can   func(common.Action, common.ResourceRef) (bool, error)
}

func (a *scopeGateTestAuthorizer) Can(_ context.Context, _ Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	a.calls = append(a.calls, authorizationCall{action: action, ref: ref})
	return a.can(action, ref)
}

type scopeGateTestPool struct{ getCalls int }

func (p *scopeGateTestPool) Get(context.Context, ProviderConnection) (FSProvider, error) {
	p.getCalls++
	return nil, errors.New("provider must not be resolved in this test")
}

func (*scopeGateTestPool) Invalidate(ProviderConnection) {}

func newScopeGateTestCore(resolver ScopeResolverContract, connections ConnectionResolverContract, authorizer Authorizer, pool ProviderPool) *VFSCore {
	return &VFSCore{
		scopeResolver:      resolver,
		connectionResolver: connections,
		authorizer:         authorizer,
		providerPool:       pool,
		lifecycle:          NewNoopResourceLifecycle(),
	}
}

func scopeGateRef(scopeKey string) common.ResourceRef {
	return common.ResourceRef{
		ProviderKey:   "scopes",
		ConnectionKey: "scopes",
		ScopeKey:      "system",
		Path:          "/scopes/" + scopeKey,
	}
}

func TestResolveResourceExplicitScopeRequiresExecBeforeConnectionLookup(t *testing.T) {
	resolver := &scopeGateTestResolver{scope: Scope{Key: "alice", OwnerSubjectKey: "user:1"}}
	connections := &scopeGateTestConnectionResolver{}
	authorizer := &scopeGateTestAuthorizer{can: func(action common.Action, ref common.ResourceRef) (bool, error) {
		return false, nil
	}}
	pool := &scopeGateTestPool{}
	core := newScopeGateTestCore(resolver, connections, authorizer, pool)

	_, err := core.resolveResource(context.Background(), Actor{Kind: ActorUser, ID: "2"}, "local@default[alice]:///projects/demo")
	if !errors.Is(err, ErrPermissionDenied) {
		t.Fatalf("resolveResource() error = %v, want permission denied", err)
	}
	if len(resolver.explicitKeys) != 1 || resolver.explicitKeys[0] != "alice" {
		t.Fatalf("explicit lookups = %v, want [alice]", resolver.explicitKeys)
	}
	if len(resolver.defaultActors) != 0 {
		t.Fatalf("default lookups = %v, want none", resolver.defaultActors)
	}
	if len(authorizer.calls) != 1 {
		t.Fatalf("authorizer calls = %v, want one scope gate", authorizer.calls)
	}
	if got := authorizer.calls[0]; got.action != common.ActionExec || got.ref != scopeGateRef("alice") {
		t.Fatalf("scope gate = %+v, want x on %+v", got, scopeGateRef("alice"))
	}
	if connections.calls != 0 {
		t.Fatalf("connection resolver calls = %d, want 0", connections.calls)
	}
	if pool.getCalls != 0 {
		t.Fatalf("provider pool calls = %d, want 0", pool.getCalls)
	}
}

func TestResolveResourceScopeAuthorizerErrorFailsClosed(t *testing.T) {
	authorizerErr := errors.New("acl backend unavailable")
	resolver := &scopeGateTestResolver{scope: Scope{Key: "alice"}}
	connections := &scopeGateTestConnectionResolver{}
	authorizer := &scopeGateTestAuthorizer{can: func(common.Action, common.ResourceRef) (bool, error) {
		return false, authorizerErr
	}}
	core := newScopeGateTestCore(resolver, connections, authorizer, &scopeGateTestPool{})

	_, err := core.resolveResource(context.Background(), Actor{Kind: ActorUser, ID: "2"}, "local@default[alice]:///projects/demo")
	if !errors.Is(err, authorizerErr) {
		t.Fatalf("resolveResource() error = %v, want authorizer error", err)
	}
	if connections.calls != 0 {
		t.Fatalf("connection resolver calls = %d, want 0", connections.calls)
	}
}

func TestResolveResourceRejectsNonCanonicalScopeKeyBeforeAuthorization(t *testing.T) {
	resolver := &scopeGateTestResolver{scope: Scope{Key: "alice/private"}}
	connections := &scopeGateTestConnectionResolver{}
	authorizer := &scopeGateTestAuthorizer{can: func(common.Action, common.ResourceRef) (bool, error) {
		return true, nil
	}}
	core := newScopeGateTestCore(resolver, connections, authorizer, &scopeGateTestPool{})

	_, err := core.resolveResource(context.Background(), Actor{Kind: ActorUser, ID: "2"}, "local@default[alice/private]:///projects/demo")
	if !errors.Is(err, ErrInvalidScope) {
		t.Fatalf("resolveResource() error = %v, want invalid scope", err)
	}
	if len(authorizer.calls) != 0 {
		t.Fatalf("authorizer calls = %v, want none", authorizer.calls)
	}
	if connections.calls != 0 {
		t.Fatalf("connection resolver calls = %d, want 0", connections.calls)
	}
}

func TestStatScopeExecDoesNotGrantTargetRead(t *testing.T) {
	resolver := &scopeGateTestResolver{scope: Scope{Key: "alice"}}
	connections := &scopeGateTestConnectionResolver{connection: ProviderConnection{
		ScopeKey: "alice", ProviderKey: "local", ConnectionKey: "default",
	}}
	targetRef := common.ResourceRef{
		ProviderKey: "local", ConnectionKey: "default", ScopeKey: "alice", Path: "/projects/demo",
	}
	parentRef := common.ResourceRef{
		ProviderKey: "local", ConnectionKey: "default", ScopeKey: "alice", Path: "/projects",
	}
	authorizer := &scopeGateTestAuthorizer{can: func(action common.Action, ref common.ResourceRef) (bool, error) {
		if action == common.ActionExec && ref == scopeGateRef("alice") {
			return true, nil
		}
		if action == common.ActionExec && ref == parentRef {
			return true, nil
		}
		if action == common.ActionRead && ref == targetRef {
			return false, nil
		}
		return false, errors.New("unexpected authorization check")
	}}
	pool := &scopeGateTestPool{}
	core := newScopeGateTestCore(resolver, connections, authorizer, pool)

	_, err := core.Stat(context.Background(), Actor{Kind: ActorUser, ID: "2"}, "local@default[alice]:///projects/demo")
	if !errors.Is(err, ErrPermissionDenied) {
		t.Fatalf("Stat() error = %v, want permission denied", err)
	}
	if len(authorizer.calls) != 3 {
		t.Fatalf("authorizer calls = %v, want scope, traverse and target checks", authorizer.calls)
	}
	if connections.calls != 1 {
		t.Fatalf("connection resolver calls = %d, want 1", connections.calls)
	}
	if pool.getCalls != 0 {
		t.Fatalf("provider pool calls = %d, want 0", pool.getCalls)
	}
}

func TestResolveResourceDefaultScopeSelectionStillRequiresExec(t *testing.T) {
	actor := Actor{Kind: ActorUser, ID: "2"}
	resolver := &scopeGateTestResolver{scope: Scope{Key: "bob"}}
	connections := &scopeGateTestConnectionResolver{}
	authorizer := &scopeGateTestAuthorizer{can: func(action common.Action, ref common.ResourceRef) (bool, error) {
		if action != common.ActionExec || ref != scopeGateRef("bob") {
			t.Fatalf("scope gate = %s %+v, want x on %+v", action, ref, scopeGateRef("bob"))
		}
		return false, nil
	}}
	core := newScopeGateTestCore(resolver, connections, authorizer, &scopeGateTestPool{})

	_, err := core.resolveResource(context.Background(), actor, "local@default[]:///projects/demo")
	if !errors.Is(err, ErrPermissionDenied) {
		t.Fatalf("resolveResource() error = %v, want permission denied", err)
	}
	if len(resolver.defaultActors) != 1 || resolver.defaultActors[0] != actor {
		t.Fatalf("default actors = %v, want [%v]", resolver.defaultActors, actor)
	}
	if len(resolver.explicitKeys) != 0 {
		t.Fatalf("explicit lookups = %v, want none", resolver.explicitKeys)
	}
}
