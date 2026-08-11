package v2test

import (
	"MyServer/internal/common"
	v2 "MyServer/internal/vfs/v2"
	"MyServer/internal/vfs/v2/providers"
	"bytes"
	"context"
	"database/sql"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

type allowAllAuthorizer struct{}

func (allowAllAuthorizer) Can(ctx context.Context, actor v2.Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	return true, nil
}

func newDebugFrontendTestDB(t *testing.T) *sql.DB {
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
		CREATE TABLE vfs_scopes (
			scope_key TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			owner_subject_key TEXT NOT NULL,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE vfs_provider_connections (
			scope_key TEXT NOT NULL,
			provider TEXT NOT NULL,
			connection_key TEXT NOT NULL,
			config_json TEXT NOT NULL DEFAULT '{}',
			status TEXT NOT NULL DEFAULT 'active',
			ready INTEGER NOT NULL DEFAULT 1,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (scope_key, provider, connection_key)
		);

		CREATE TABLE vfs_principal_default_scopes (
			principal_type TEXT NOT NULL,
			principal_id TEXT NOT NULL,
			scope_key TEXT NOT NULL,
			PRIMARY KEY (principal_type, principal_id)
		);

		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES ('debug', 'user', 'user:42');

		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, config_json, status, ready)
		VALUES ('debug', 'debug', 'default', '{add_message: "ssss"}', 'active', 1);

		INSERT INTO vfs_principal_default_scopes (principal_type, principal_id, scope_key)
		VALUES ('user', '42', 'debug');
	`

	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("db.Exec(schema) error = %v", err)
	}

	return db
}

func newDebugFrontend(t *testing.T, db *sql.DB) v2.VFSFrontend {
	t.Helper()

	scopeResolver, err := v2.NewScopeResolver(db)
	if err != nil {
		t.Fatalf("NewScopeResolver() error = %v", err)
	}

	registry := v2.NewProviderRegistry()
	registry.Register("debug", providers.FactoryDebug)

	pool, err := v2.NewProviderPool(registry)
	if err != nil {
		t.Fatalf("NewProviderPool() error = %v", err)
	}

	frontend, err := v2.NewVFS(
		scopeResolver,
		v2.NewConnectionResolver(db),
		pool,
		allowAllAuthorizer{},
		v2.NewNoopResourceLifecycle(),
	)
	if err != nil {
		t.Fatalf("NewVFS() error = %v", err)
	}

	return frontend
}

func mustURI(t *testing.T, raw string) common.CanonURI {
	t.Helper()

	uri, err := common.CastURI(raw)
	if err != nil {
		t.Fatalf("CastURI(%q) error = %v", raw, err)
	}

	return uri
}

func TestDebugProviderThroughVFSFrontend(t *testing.T) {
	var logs bytes.Buffer
	previousLogger := slog.Default()
	writer := io.MultiWriter(&logs, os.Stderr)
	slog.SetDefault(slog.New(slog.NewTextHandler(writer, nil)))
	t.Cleanup(func() {
		slog.SetDefault(previousLogger)
	})

	frontend := newDebugFrontend(t, newDebugFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	if _, err := frontend.Stat(ctx, actor, mustURI(t, "debug@default:///hello.txt")); err != nil {
		t.Fatalf("Stat() error = %v", err)
	}
	if _, err := frontend.ReadDir(ctx, actor, mustURI(t, "debug@default[]:///")); err != nil {
		t.Fatalf("ReadDir() error = %v", err)
	}
	if _, err := frontend.Control(ctx, actor, mustURI(t, "debug@default[debug]:///control"), "ping", []byte("google.com")); err != nil {
		t.Fatalf("Control() error = %v", err)
	}

	gotLogs := logs.String()
	for _, want := range []string{
		"func=FactoryDebug()",
		"func=Stat()", "path=/hello.txt",
		"func=ReadDir()", "path=/",
		"func=Control()", "path=/control", "command=ping", "input=google.com",
	} {
		if !strings.Contains(gotLogs, want) {
			t.Fatalf("logs do not contain %q:\n%s", want, gotLogs)
		}
	}
}
