package v2

import (
	"context"
	"database/sql"
	"fmt"
)

type ProviderConnection struct {
	ID            int64
	ScopeKey      string
	ProviderKey   string
	ConnectionKey string
	DisplayName   string
	Config        []byte
	ConfigVersion int64
	Status        string
	Ready         bool
}

type ConnectionResolverContract interface {
	ResolveConnection(ctx context.Context, scope Scope, providerKey string, connectionKey string) (*ProviderConnection, error)
}

type ConnectionResolver struct {
	db *sql.DB
}

func NewConnectionResolver(db *sql.DB) ConnectionResolverContract {
	return &ConnectionResolver{db: db}
}

func (cr *ConnectionResolver) ResolveConnection(ctx context.Context,
	scope Scope,
	providerKey string,
	connectionKey string,
) (*ProviderConnection, error) {
	if scope.Key == "" {
		return nil, ErrInvalidScope
	}
	if providerKey == "" {
		return nil, ErrInvalidProvider
	}
	if connectionKey == "" {
		return nil, ErrConnectionNotFound
	}

	var c ProviderConnection
	var config string
	const query = `
        SELECT id, scope_key, provider, connection_key, display_name, config_json, config_version, status, ready
        FROM vfs_provider_connections
        WHERE scope_key = ?
          AND provider = ?
          AND connection_key = ?
          AND status = 'active'
          AND (
            ready = 1
            OR (scope_key = 'system' AND provider = 'scopes' AND connection_key = 'scopes')
          )
    `

	err := cr.db.QueryRowContext(ctx, query, scope.Key, providerKey, connectionKey).Scan(
		&c.ID,
		&c.ScopeKey,
		&c.ProviderKey,
		&c.ConnectionKey,
		&c.DisplayName,
		&config,
		&c.ConfigVersion,
		&c.Status,
		&c.Ready,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("%w: %v", ErrConnectionNotFound, err)
	}
	if err != nil {
		return nil, err
	}

	c.Config = []byte(config)
	return &c, nil
}
