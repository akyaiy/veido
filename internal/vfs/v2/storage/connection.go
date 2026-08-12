package storage

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

type ProviderInfo struct {
	ProviderKey string
}

type ConnectionStorageContract interface {
	Create(ctx context.Context, connection vfs.ProviderConnection) error
	Get(ctx context.Context, scopeKey string, providerKey string, connectionKey string) (*vfs.ProviderConnection, error)
	ListProviders(ctx context.Context, scopeKey string) ([]*ProviderInfo, error)
	List(ctx context.Context, scopeKey string, providerKey string) ([]*vfs.ProviderConnection, error)
	Delete(ctx context.Context, scopeKey string, providerKey string, connectionKey string) error
	UpdateConfig(ctx context.Context, scopeKey string, providerKey string, connectionKey string, config []byte) error
	SetStatus(ctx context.Context, scopeKey string, providerKey string, connectionKey string, status string) error
	SetReady(ctx context.Context, scopeKey string, providerKey string, connectionKey string, ready bool) error
	SetDisplayName(ctx context.Context, scopeKey string, providerKey string, connectionKey string, displayName string) error
}

type ConnectionStorage struct {
	db *sql.DB
}

func NewConnectionStorage(db *sql.DB) (ConnectionStorageContract, error) {
	if db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}
	return &ConnectionStorage{db: db}, nil
}

func (s *ConnectionStorage) Create(ctx context.Context, connection vfs.ProviderConnection) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	connection, err := normalizeConnection(connection)
	if err != nil {
		return WrapError(ErrConnectionNotCreated, err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrConnectionNotCreated, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	if err := ensureScopeExists(ctx, tx, connection.ScopeKey); err != nil {
		return WrapError(ErrConnectionNotCreated, err)
	}

	const query = `
		INSERT INTO vfs_provider_connections (
			scope_key,
			provider,
			connection_key,
			display_name,
			config_json,
			status,
			ready
		)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	if _, err := tx.ExecContext(
		ctx,
		query,
		connection.ScopeKey,
		connection.ProviderKey,
		connection.ConnectionKey,
		connection.DisplayName,
		string(connection.Config),
		connection.Status,
		connection.Ready,
	); err != nil {
		return WrapError(ErrConnectionNotCreated, err)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrConnectionNotCreated, err)
	}

	committed = true
	return nil
}

func (s *ConnectionStorage) Get(ctx context.Context, scopeKey string, providerKey string, connectionKey string) (*vfs.ProviderConnection, error) {
	if s == nil || s.db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	scopeKey, providerKey, connectionKey, err := normalizeConnectionKeyParts(scopeKey, providerKey, connectionKey)
	if err != nil {
		return nil, WrapError(ErrConnectionNotFound, err)
	}

	const query = `
		SELECT
			id,
			scope_key,
			provider,
			connection_key,
			display_name,
			config_json,
			config_version,
			status,
			ready
		FROM vfs_provider_connections
		WHERE scope_key = ?
		  AND provider = ?
		  AND connection_key = ?
	`

	var connection vfs.ProviderConnection
	var config string
	err = s.db.QueryRowContext(ctx, query, scopeKey, providerKey, connectionKey).Scan(
		&connection.ID,
		&connection.ScopeKey,
		&connection.ProviderKey,
		&connection.ConnectionKey,
		&connection.DisplayName,
		&config,
		&connection.ConfigVersion,
		&connection.Status,
		&connection.Ready,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, WrapError(ErrConnectionNotFound, err)
	}
	if err != nil {
		return nil, WrapError(ErrConnectionNotFound, err)
	}

	connection.Config = []byte(config)
	return &connection, nil
}

func (s *ConnectionStorage) ListProviders(ctx context.Context, scopeKey string) ([]*ProviderInfo, error) {
	if s == nil || s.db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	scopeKey = strings.TrimSpace(scopeKey)
	if scopeKey == "" {
		return nil, WrapError(ErrConnectionsNotListed, fmt.Errorf("%w: empty scope key", vfs.ErrInvalidScope))
	}

	var (
		rows *sql.Rows
		err  error
	)
	const query = `
		SELECT
			provider
		FROM vfs_provider_connections
		WHERE scope_key = ?
		ORDER BY provider
	`
	rows, err = s.db.QueryContext(ctx, query, scopeKey)
	if err != nil {
		return nil, WrapError(ErrConnectionsNotListed, err)
	}
	defer rows.Close()

	providers := make([]*ProviderInfo, 0)
	for rows.Next() {
		var providerKey string
		if err := rows.Scan(&providerKey); err != nil {
			return nil, WrapError(ErrConnectionsNotListed, err)
		}
		providers = append(providers, &ProviderInfo{ProviderKey: providerKey})
	}
	if err := rows.Err(); err != nil {
		return nil, WrapError(ErrConnectionsNotListed, err)
	}

	return providers, nil
}

func (s *ConnectionStorage) List(ctx context.Context, scopeKey string, providerKey string) ([]*vfs.ProviderConnection, error) {
	if s == nil || s.db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	scopeKey = strings.TrimSpace(scopeKey)
	if scopeKey == "" {
		return nil, WrapError(ErrConnectionsNotListed, fmt.Errorf("%w: empty scope key", vfs.ErrInvalidScope))
	}

	providerKey = strings.TrimSpace(providerKey)

	var (
		rows *sql.Rows
		err  error
	)
	if providerKey == "" {
		const query = `
			SELECT
				id,
				scope_key,
				provider,
				connection_key,
				display_name,
				config_json,
				config_version,
				status,
				ready
			FROM vfs_provider_connections
			WHERE scope_key = ?
			ORDER BY provider, connection_key
		`
		rows, err = s.db.QueryContext(ctx, query, scopeKey)
	} else {
		const query = `
			SELECT
				id,
				scope_key,
				provider,
				connection_key,
				display_name,
				config_json,
				config_version,
				status,
				ready
			FROM vfs_provider_connections
			WHERE scope_key = ?
			  AND provider = ?
			ORDER BY connection_key
		`
		rows, err = s.db.QueryContext(ctx, query, scopeKey, providerKey)
	}
	if err != nil {
		return nil, WrapError(ErrConnectionsNotListed, err)
	}
	defer rows.Close()

	connections := make([]*vfs.ProviderConnection, 0)
	for rows.Next() {
		var connection vfs.ProviderConnection
		var config string
		if err := rows.Scan(
			&connection.ID,
			&connection.ScopeKey,
			&connection.ProviderKey,
			&connection.ConnectionKey,
			&connection.DisplayName,
			&config,
			&connection.ConfigVersion,
			&connection.Status,
			&connection.Ready,
		); err != nil {
			return nil, WrapError(ErrConnectionsNotListed, err)
		}
		connection.Config = []byte(config)
		connections = append(connections, &connection)
	}
	if err := rows.Err(); err != nil {
		return nil, WrapError(ErrConnectionsNotListed, err)
	}

	return connections, nil
}

func (s *ConnectionStorage) Delete(ctx context.Context, scopeKey string, providerKey string, connectionKey string) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	scopeKey, providerKey, connectionKey, err := normalizeConnectionKeyParts(scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotDeleted, err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrConnectionNotDeleted, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const query = `
		DELETE FROM vfs_provider_connections
		WHERE scope_key = ?
		  AND provider = ?
		  AND connection_key = ?
	`

	result, err := tx.ExecContext(ctx, query, scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotDeleted, err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return WrapError(ErrConnectionNotDeleted, err)
	}
	if affected == 0 {
		return WrapError(ErrConnectionNotDeleted, ErrConnectionNotFound)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrConnectionNotDeleted, err)
	}

	committed = true
	return nil
}

func (s *ConnectionStorage) UpdateConfig(ctx context.Context, scopeKey string, providerKey string, connectionKey string, config []byte) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	scopeKey, providerKey, connectionKey, err := normalizeConnectionKeyParts(scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}
	if len(config) == 0 {
		config = []byte("{}")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const query = `
		UPDATE vfs_provider_connections
		SET config_json = ?,
		    config_version = config_version + 1,
		    updated_at = CURRENT_TIMESTAMP
		WHERE scope_key = ?
		  AND provider = ?
		  AND connection_key = ?
	`

	result, err := tx.ExecContext(ctx, query, string(config), scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}
	if affected == 0 {
		return WrapError(ErrConnectionNotUpdated, ErrConnectionNotFound)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	committed = true
	return nil
}

func (s *ConnectionStorage) SetStatus(ctx context.Context, scopeKey string, providerKey string, connectionKey string, status string) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	scopeKey, providerKey, connectionKey, err := normalizeConnectionKeyParts(scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	status = strings.TrimSpace(status)
	if status == "" {
		return WrapError(ErrConnectionNotUpdated, fmt.Errorf("%w: empty connection status", vfs.ErrConnectionInactive))
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const query = `
		UPDATE vfs_provider_connections
		SET status = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE scope_key = ?
		  AND provider = ?
		  AND connection_key = ?
	`

	result, err := tx.ExecContext(ctx, query, status, scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}
	if affected == 0 {
		return WrapError(ErrConnectionNotUpdated, ErrConnectionNotFound)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	committed = true
	return nil
}

func (s *ConnectionStorage) SetReady(ctx context.Context, scopeKey string, providerKey string, connectionKey string, ready bool) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	scopeKey, providerKey, connectionKey, err := normalizeConnectionKeyParts(scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const query = `
		UPDATE vfs_provider_connections
		SET ready = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE scope_key = ?
		  AND provider = ?
		  AND connection_key = ?
	`

	result, err := tx.ExecContext(ctx, query, ready, scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}
	if affected == 0 {
		return WrapError(ErrConnectionNotUpdated, ErrConnectionNotFound)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	committed = true
	return nil
}

func (s *ConnectionStorage) SetDisplayName(ctx context.Context, scopeKey string, providerKey string, connectionKey string, displayName string) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	scopeKey, providerKey, connectionKey, err := normalizeConnectionKeyParts(scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	displayName = strings.TrimSpace(displayName)
	if displayName == "" {
		return WrapError(ErrConnectionNotUpdated, fmt.Errorf("%w: empty display name", vfs.ErrConnectionNotFound))
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const query = `
		UPDATE vfs_provider_connections
		SET display_name = ?,
		    updated_at = CURRENT_TIMESTAMP
		WHERE scope_key = ?
		  AND provider = ?
		  AND connection_key = ?
	`

	result, err := tx.ExecContext(ctx, query, displayName, scopeKey, providerKey, connectionKey)
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}
	if affected == 0 {
		return WrapError(ErrConnectionNotUpdated, ErrConnectionNotFound)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrConnectionNotUpdated, err)
	}

	committed = true
	return nil
}

func normalizeConnection(connection vfs.ProviderConnection) (vfs.ProviderConnection, error) {
	connection.ScopeKey = strings.TrimSpace(connection.ScopeKey)
	if connection.ScopeKey == "" {
		return connection, fmt.Errorf("%w: empty scope key", vfs.ErrInvalidScope)
	}

	connection.ProviderKey = strings.TrimSpace(connection.ProviderKey)
	if connection.ProviderKey == "" {
		return connection, fmt.Errorf("%w: empty provider key", vfs.ErrInvalidProvider)
	}

	connection.ConnectionKey = strings.TrimSpace(connection.ConnectionKey)
	if connection.ConnectionKey == "" {
		return connection, fmt.Errorf("%w: empty connection key", vfs.ErrConnectionNotFound)
	}

	connection.DisplayName = strings.TrimSpace(connection.DisplayName)
	if connection.DisplayName == "" {
		connection.DisplayName = connection.ConnectionKey
	}

	connection.Status = strings.TrimSpace(connection.Status)
	if connection.Status == "" {
		connection.Status = "active"
	}

	if len(connection.Config) == 0 {
		connection.Config = []byte("{}")
	}

	return connection, nil
}

func normalizeConnectionKeyParts(scopeKey string, providerKey string, connectionKey string) (string, string, string, error) {
	scopeKey = strings.TrimSpace(scopeKey)
	if scopeKey == "" {
		return "", "", "", fmt.Errorf("%w: empty scope key", vfs.ErrInvalidScope)
	}

	providerKey = strings.TrimSpace(providerKey)
	if providerKey == "" {
		return "", "", "", fmt.Errorf("%w: empty provider key", vfs.ErrInvalidProvider)
	}

	connectionKey = strings.TrimSpace(connectionKey)
	if connectionKey == "" {
		return "", "", "", fmt.Errorf("%w: empty connection key", vfs.ErrConnectionNotFound)
	}

	return scopeKey, providerKey, connectionKey, nil
}

func ensureScopeExists(ctx context.Context, tx *sql.Tx, scopeKey string) error {
	const query = `
		SELECT 1
		FROM vfs_scopes
		WHERE scope_key = ?
	`

	var exists int
	err := tx.QueryRowContext(ctx, query, scopeKey).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrScopeNotFound
	}
	if err != nil {
		return err
	}

	return nil
}
