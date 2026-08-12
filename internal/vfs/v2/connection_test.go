package v2

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func newConnectionResolverTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	t.Cleanup(func() {
		if err := db.Close(); err != nil {
			t.Fatalf("db.Close() error = %v", err)
		}
	})

	const schema = `
		CREATE TABLE vfs_provider_connections (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			scope_key TEXT NOT NULL,
			provider TEXT NOT NULL,
			connection_key TEXT NOT NULL,
			display_name TEXT NOT NULL DEFAULT '',
			config_json TEXT NOT NULL DEFAULT '{}',
			config_version INTEGER NOT NULL DEFAULT 1,
			status TEXT NOT NULL DEFAULT 'active',
			ready INTEGER NOT NULL DEFAULT 0,
			UNIQUE(scope_key, connection_key)
		);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("db.Exec(schema) error = %v", err)
	}
	return db
}

func TestConnectionResolverRequiresReadyForOrdinaryConnections(t *testing.T) {
	db := newConnectionResolverTestDB(t)
	_, err := db.Exec(`
		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES ('debug', 'debug', 'default', 'default', '{}', 'active', 0)
	`)
	if err != nil {
		t.Fatalf("db.Exec(seed) error = %v", err)
	}

	resolver := NewConnectionResolver(db)
	_, err = resolver.ResolveConnection(context.Background(), Scope{Key: "debug"}, "debug", "default")
	if !errors.Is(err, ErrConnectionNotFound) {
		t.Fatalf("ResolveConnection(not ready) error = %v, want %v", err, ErrConnectionNotFound)
	}
}

func TestConnectionResolverAllowsScopesBootstrapConnectionWithoutReady(t *testing.T) {
	db := newConnectionResolverTestDB(t)
	_, err := db.Exec(`
		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES ('system', 'scopes', 'scopes', 'scopes', '{}', 'active', 0)
	`)
	if err != nil {
		t.Fatalf("db.Exec(seed) error = %v", err)
	}

	resolver := NewConnectionResolver(db)
	got, err := resolver.ResolveConnection(context.Background(), Scope{Key: "system"}, "scopes", "scopes")
	if err != nil {
		t.Fatalf("ResolveConnection(scopes bootstrap) error = %v", err)
	}
	if got.ScopeKey != "system" || got.ProviderKey != "scopes" || got.ConnectionKey != "scopes" {
		t.Fatalf("connection = %+v, want system/scopes/scopes", got)
	}
}
