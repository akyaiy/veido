package acl

import (
	"context"
	"database/sql"

	"github.com/akyaiy/veido/internal/database/migrate"
)

func MigrationGroup() migrate.Group {
	return migrate.Group{Name: "provider/acl", Migrations: []migrate.Migration{{Version: 1, Name: "system_connection", Up: migrateSystemConnection}}}
}

func migrateSystemConnection(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO vfs_provider_connections(scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES ('system', 'acl', 'acl', 'ACL policy', '{}', 'active', 1)
		ON CONFLICT(scope_key, connection_key) DO NOTHING`)
	return err
}
