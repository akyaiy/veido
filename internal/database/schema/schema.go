// Package schema defines the production migration order.
package schema

import (
	"context"
	"database/sql"

	"MyServer/internal/auth"
	"MyServer/internal/database/migrate"
	"MyServer/internal/sqliteDB"
	"MyServer/internal/vfs/v2/storage"
)

// SystemGroups returns only schema owned by the non-replaceable system core.
// Provider migrations are supplied by the composition root that selected those
// providers; this package deliberately has no provider imports or registry.
func SystemGroups() []migrate.Group {
	return []migrate.Group{
		sqliteDB.MigrationGroup(),
		auth.MigrationGroup(),
		storage.MigrationGroup(),
	}
}

func Migrate(ctx context.Context, db *sql.DB, providerGroups ...migrate.Group) error {
	groups := append(SystemGroups(), providerGroups...)
	return migrate.Run(ctx, db, groups...)
}
