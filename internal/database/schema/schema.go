// Package schema defines the production migration order.
package schema

import (
	aclv2 "github.com/akyaiy/veido/internal/acl/v2"
	"context"
	"database/sql"

	"github.com/akyaiy/veido/internal/auth"
	"github.com/akyaiy/veido/internal/database/migrate"
	"github.com/akyaiy/veido/internal/sqliteDB"
	"github.com/akyaiy/veido/internal/vfs/v2/storage"
)

// SystemGroups returns only schema owned by the non-replaceable system core.
// Provider migrations are supplied by the composition root that selected those
// providers; this package deliberately has no provider imports or registry.
func SystemGroups() []migrate.Group {
	return []migrate.Group{
		sqliteDB.MigrationGroup(),
		auth.MigrationGroup(),
		storage.MigrationGroup(),
		aclv2.MigrationGroup(),
	}
}

func Migrate(ctx context.Context, db *sql.DB, providerGroups ...migrate.Group) error {
	groups := append(SystemGroups(), providerGroups...)
	return migrate.Run(ctx, db, groups...)
}
