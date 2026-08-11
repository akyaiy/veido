package scopes

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"MyServer/internal/vfs/v2/storage"
	"context"
	"time"
)

func wrapScopeToNode(scope *vfs.Scope) *vfs.Node {
	var updatedAt time.Time = time.Now()
	if scope.UpdatedAt != nil {
		updatedAt = *scope.UpdatedAt
	}

	return &vfs.Node{
		Name:      scope.Key,
		Kind:      "scope",
		IsDir:     true,
		Size:      0,
		UpdatedAt: updatedAt,
	}
}

func wrapProviderToNode(provider *storage.ProviderInfo) *vfs.Node {
	return &vfs.Node{
		Name:      provider.ProviderKey,
		Kind:      "provider",
		IsDir:     true,
		Size:      0,
		UpdatedAt: time.Now(),
	}
}

func wrapConnectionToNode(connection *vfs.ProviderConnection) *vfs.Node {
	return &vfs.Node{
		Name:      connection.ConnectionKey,
		Kind:      "connection",
		IsDir:     true,
		Size:      0,
		UpdatedAt: time.Now(),
	}
}


// handleListScopes handles the scopes fetching.
// It returns [[]*vfs.Node] and an error.
func (p *Provider) handleListScopes(ctx context.Context) ([]*vfs.Node, error) {
	rctx, ok := vfs.RequestContextFromContext(ctx)
	if !ok {
		return nil, vfs.ErrRequestContextNotFound
	}

	actor := rctx.ActorKey

	scopes, err := p.scopes.List(ctx, common.SubjectKey(actor.String()))
	if err != nil {
		return nil, err
	}

	nodes := make([]*vfs.Node, 0, len(scopes))
	for _, scope := range scopes {
		nodes = append(nodes, wrapScopeToNode(scope))
	}

	return nodes, nil
}

func (p *Provider) handleScopeDir(ctx context.Context, scopeKey string) ([]*vfs.Node, error) {
	scope, err := p.scopes.Get(ctx, scopeKey)
	if err != nil {
		return nil, err
	}

	return []*vfs.Node{
		wrapScopeToNode(scope),
	}, nil
}

func (p *Provider) handleProvidersDir(ctx context.Context, scopeKey string) ([]*vfs.Node, error) {
	providers, err := p.connections.ListProviders(ctx, scopeKey)
	if err != nil {
		return nil, err
	}

	nodes := make([]*vfs.Node, 0, len(providers))
	for _, provider := range providers {
		nodes = append(nodes, wrapProviderToNode(provider))
	}

	return nodes, nil
}

func (p *Provider) handleProviderDir(ctx context.Context, scopeKey, providerKey string) ([]*vfs.Node, error) {
	connections, err := p.connections.List(ctx, scopeKey, providerKey)
	if err != nil {
		return nil, err
	}

	nodes := make([]*vfs.Node, 0, len(connections))
	for _, connection := range connections {
		nodes = append(nodes, wrapConnectionToNode(connection))
	}

	return nodes, nil
}
