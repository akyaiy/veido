// Package providertest supplies a disposable VFS core and provider contract
// checks. It is for tests and local development, not production authentication.
package providertest

import (
	core "MyServer/internal/vfs/v2"
	"MyServer/pkg/vfs"
	"context"
	"fmt"
)

type Options struct {
	Connection vfs.ProviderConnection
	Actor      vfs.Actor
	Authorizer vfs.Authorizer
	Lifecycle  vfs.ResourceLifecycleSink
}

type Harness struct {
	Frontend   vfs.Frontend
	Actor      vfs.Actor
	Connection vfs.ProviderConnection
	Provider   vfs.FSProvider
	pool       core.ProviderPool
}

// New uses an in-memory scope/connection resolver and the real core/pool.
// Authorization allows all by default; pass Authorizer to test ACL denials.
func New(ctx context.Context, factory vfs.ProviderFactory, options Options) (*Harness, error) {
	c := options.Connection
	if c.ScopeKey == "" {
		c.ScopeKey = "dev"
	}
	if c.ProviderKey == "" {
		c.ProviderKey = "example"
	}
	if c.ConnectionKey == "" {
		c.ConnectionKey = "default"
	}
	if c.Config == nil {
		c.Config = []byte("{}")
	}
	if options.Actor.Kind == "" {
		options.Actor = vfs.Actor{Kind: vfs.ActorUser, ID: "developer"}
	}
	if options.Authorizer == nil {
		options.Authorizer = allowAll{}
	}
	if options.Lifecycle == nil {
		options.Lifecycle = core.NewNoopResourceLifecycle()
	}
	registry := core.NewProviderRegistry()
	registry.Register(c.ProviderKey, factory)
	pool, err := core.NewProviderPool(registry)
	if err != nil {
		return nil, err
	}
	provider, err := pool.Get(ctx, c)
	if err != nil {
		return nil, err
	}
	resolver := staticResolver{c}
	frontend, err := core.NewVFS(resolver, resolver, pool, options.Authorizer, options.Lifecycle)
	if err != nil {
		pool.Invalidate(c)
		return nil, err
	}
	return &Harness{Frontend: frontend, Actor: options.Actor, Connection: c, Provider: provider, pool: pool}, nil
}

func (h *Harness) URI(path string) vfs.URI {
	uri, err := (vfs.ResourceAddress{ProviderKey: h.Connection.ProviderKey, ConnectionKey: h.Connection.ConnectionKey, ScopeKey: h.Connection.ScopeKey, Path: path}).URI()
	if err != nil {
		panic(err)
	}
	return uri
}
func (h *Harness) Close() error { h.pool.Invalidate(h.Connection); return nil }

type allowAll struct{}

func (allowAll) Can(context.Context, vfs.Actor, vfs.Action, vfs.ResourceRef) (bool, error) {
	return true, nil
}

type staticResolver struct{ connection vfs.ProviderConnection }

func (s staticResolver) ResolveScope(ctx context.Context, actor vfs.Actor, key string) (*vfs.Scope, error) {
	if key != "" && key != s.connection.ScopeKey {
		return nil, fmt.Errorf("%w: unknown test scope", vfs.ErrNotFound)
	}
	return &vfs.Scope{Key: s.connection.ScopeKey, Kind: "user", OwnerSubjectKey: vfs.SubjectKey(actor.String())}, nil
}
func (s staticResolver) ResolveConnection(ctx context.Context, scope vfs.Scope, provider, key string) (*vfs.ProviderConnection, error) {
	if scope.Key != s.connection.ScopeKey || provider != s.connection.ProviderKey || key != s.connection.ConnectionKey {
		return nil, vfs.ErrNotFound
	}
	c := s.connection
	return &c, nil
}
