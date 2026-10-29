package users

import (
	"github.com/akyaiy/veido/internal/database/migrate"
	"context"
	"database/sql"
)

func MigrationGroup() migrate.Group {
	return migrate.Group{Name: "provider/users", Migrations: []migrate.Migration{
		{Version: 1, Name: "profiles", Up: migrateProfiles},
		{Version: 2, Name: "system_connection", Up: migrateSystemConnection},
	}}
}

func migrateSystemConnection(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO vfs_provider_connections(
			scope_key, provider, connection_key, display_name, config_json, status, ready
		) VALUES ('system', 'users', 'account', 'Users', '{}', 'active', 1)
		ON CONFLICT(scope_key, connection_key) DO NOTHING
	`)
	return err
}

func migrateProfiles(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS user_profiles (
		user_id TEXT PRIMARY KEY,
		display_name TEXT NOT NULL DEFAULT '',
		locale TEXT NOT NULL DEFAULT '',
		timezone TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	)`)
	return err
}
