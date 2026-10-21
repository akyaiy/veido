package scopes

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"context"
	"os"
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

func wrapConnectionToNode(connection *vfs.ProviderConnection) *vfs.Node {
	return &vfs.Node{
		Name:      connectionName(connection.ProviderKey, connection.ConnectionKey),
		Kind:      "connection",
		IsDir:     true,
		Size:      0,
		UpdatedAt: time.Now(),
	}
}

func (p *Provider) handleGetDefaultScope(ctx context.Context) (*scopeInfoPayload, error) {
	rctx, ok := vfs.RequestContextFromContext(ctx)
	if !ok {
		return nil, vfs.ErrRequestContextNotFound
	}

	principal := rctx.ActorKey

	defaultScope, err := p.scopes.GetDefault(ctx, common.SubjectKey(principal.String()))
	if err != nil {
		return nil, err
	}
	if defaultScope == nil {
		return nil, os.ErrNotExist
	}

	return &scopeInfoPayload{
		ScopeKey:        defaultScope.Key,
		Kind:            defaultScope.Kind,
		OwnerSubjectKey: defaultScope.OwnerSubjectKey.String(),
		UpdatedAt:       defaultScope.UpdatedAt,
		Providers:       nil,
	}, nil
}
