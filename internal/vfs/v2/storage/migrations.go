package storage

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/akyaiy/veido/internal/database/migrate"
)

func MigrationGroup() migrate.Group {
	return migrate.Group{
		Name: "vfs/core",
		Migrations: []migrate.Migration{
			{Version: 1, Name: "scopes_and_connections", Up: migrateVFSCoreV1},
			{Version: 2, Name: "connection_runtime_fields", Up: migrateVFSCoreV2},
			{Version: 3, Name: "system_scope", Up: migrateVFSCoreV3},
			{Version: 4, Name: "system_scopes_connection", Up: migrateVFSCoreV4},
		},
	}
}

func migrateVFSCoreV3(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO vfs_scopes(scope_key, kind, owner_subject_key)
		VALUES ('system', 'system', 'service:system')
		ON CONFLICT(scope_key) DO NOTHING
	`)
	return err
}

func migrateVFSCoreV4(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO vfs_provider_connections(
			scope_key, provider, connection_key, display_name, config_json, status, ready
		) VALUES ('system', 'scopes', 'scopes', 'Scopes', '{}', 'active', 1)
		ON CONFLICT(scope_key, connection_key) DO NOTHING
	`)
	return err
}

func migrateVFSCoreV1(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS vfs_scopes (
			scope_key TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			owner_subject_key TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
		CREATE TABLE IF NOT EXISTS vfs_provider_connections (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			scope_key TEXT NOT NULL,
			provider TEXT NOT NULL,
			connection_key TEXT NOT NULL,
			display_name TEXT NOT NULL DEFAULT '',
			config_json TEXT NOT NULL DEFAULT '{}',
			config_version INTEGER NOT NULL DEFAULT 1,
			status TEXT NOT NULL DEFAULT 'active',
			ready INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (scope_key) REFERENCES vfs_scopes(scope_key) ON DELETE CASCADE,
			UNIQUE(scope_key, connection_key)
		);
		CREATE TABLE IF NOT EXISTS vfs_principal_default_scopes (
			principal_type TEXT NOT NULL,
			principal_id TEXT NOT NULL,
			scope_key TEXT NOT NULL,
			PRIMARY KEY (principal_type, principal_id),
			FOREIGN KEY (scope_key) REFERENCES vfs_scopes(scope_key) ON DELETE CASCADE
		)
	`)
	return err
}

func migrateVFSCoreV2(ctx context.Context, tx *sql.Tx) error {
	columns, err := tableColumns(ctx, tx, "vfs_provider_connections")
	if err != nil {
		return err
	}
	additions := []struct{ name, ddl string }{
		{"display_name", `ALTER TABLE vfs_provider_connections ADD COLUMN display_name TEXT NOT NULL DEFAULT ''`},
		{"config_version", `ALTER TABLE vfs_provider_connections ADD COLUMN config_version INTEGER NOT NULL DEFAULT 1`},
		{"status", `ALTER TABLE vfs_provider_connections ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`},
		{"ready", `ALTER TABLE vfs_provider_connections ADD COLUMN ready INTEGER NOT NULL DEFAULT 1`},
		{"created_at", `ALTER TABLE vfs_provider_connections ADD COLUMN created_at DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`},
		{"updated_at", `ALTER TABLE vfs_provider_connections ADD COLUMN updated_at DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`},
	}
	for _, addition := range additions {
		if columns[addition.name] {
			continue
		}
		if _, err := tx.ExecContext(ctx, addition.ddl); err != nil {
			return fmt.Errorf("add vfs_provider_connections.%s: %w", addition.name, err)
		}
	}
	_, err = tx.ExecContext(ctx, `
		CREATE UNIQUE INDEX IF NOT EXISTS idx_vfs_provider_connections_id
			ON vfs_provider_connections(id);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_vfs_provider_connections_scope_connection_key
			ON vfs_provider_connections(scope_key, connection_key);
		CREATE UNIQUE INDEX IF NOT EXISTS idx_vfs_provider_connections_scope_display_name
			ON vfs_provider_connections(scope_key, display_name) WHERE display_name != ''
	`)
	return err
}

func tableColumns(ctx context.Context, tx *sql.Tx, table string) (map[string]bool, error) {
	rows, err := tx.QueryContext(ctx, `SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	columns := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		columns[name] = true
	}
	return columns, rows.Err()
}
