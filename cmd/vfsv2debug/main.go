package main

import (
	"github.com/akyaiy/veido/internal/common"
	"github.com/akyaiy/veido/internal/config"
	"github.com/akyaiy/veido/internal/database/schema"
	"github.com/akyaiy/veido/internal/sqliteDB"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"github.com/akyaiy/veido/internal/vfs/v2/providers"
	"context"
	"database/sql"
	"flag"
	"log"
	"log/slog"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

type allowAllAuthorizer struct{}

func (allowAllAuthorizer) Can(ctx context.Context, actor vfs.Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	return true, nil
}

func main() {
	configPath := flag.String("config", "./data/config.yaml", "path to server config")
	actorID := flag.String("actor-id", "1", "debug actor user id")
	runSmoke := flag.Bool("smoke", true, "run a debug provider smoke check")
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))

	config.LoadData(*configPath)
	db, err := sqliteDB.InitDB("./data/db/vfs_test.sqlite3")
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()
	if err := schema.Migrate(context.Background(), db); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	if err := seedDebugVFS(db, *actorID); err != nil {
		log.Fatalf("seed debug vfs: %v", err)
	}

	frontend, err := newDebugVFS(db)
	if err != nil {
		log.Fatalf("init vfs v2: %v", err)
	}

	slog.Info("vfs v2 initialized", "provider", "debug", "connection", "default", "actor", "user:"+*actorID)

	if *runSmoke {
		if err := smokeDebugProvider(context.Background(), frontend, *actorID); err != nil {
			log.Fatalf("debug smoke check: %v", err)
		}
		slog.Info("debug smoke check completed")
	}
}

func newDebugVFS(db *sql.DB) (vfs.VFSFrontend, error) {
	scopeResolver, err := vfs.NewScopeResolver(db)
	if err != nil {
		return nil, err
	}

	registry := vfs.NewProviderRegistry()
	registry.Register("debug", providers.FactoryDebug)

	pool, err := vfs.NewProviderPool(registry)
	if err != nil {
		return nil, err
	}
	authorizer, err := vfs.NewOwnerScopeGateAuthorizer(scopeResolver, allowAllAuthorizer{})
	if err != nil {
		return nil, err
	}

	return vfs.NewVFS(
		scopeResolver,
		vfs.NewConnectionResolver(db),
		pool,
		authorizer,
		vfs.NewNoopResourceLifecycle(),
	)
}

func seedDebugVFS(db *sql.DB, actorID string) error {
	const scopeKey = "debug"

	_, err := db.Exec(`
		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES (?, 'user', ?)
		ON CONFLICT(scope_key) DO UPDATE SET
			kind = excluded.kind,
			owner_subject_key = excluded.owner_subject_key,
			updated_at = CURRENT_TIMESTAMP
	`, scopeKey, "user:"+actorID)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES (?, 'debug', 'default', 'default', '{}', 'active', 1)
		ON CONFLICT(scope_key, connection_key) DO UPDATE SET
			provider = excluded.provider,
			display_name = excluded.display_name,
			config_json = excluded.config_json,
			status = excluded.status,
			ready = excluded.ready,
			updated_at = CURRENT_TIMESTAMP
	`, scopeKey)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
		INSERT INTO vfs_principal_default_scopes (principal_type, principal_id, scope_key)
		VALUES ('user', ?, ?)
		ON CONFLICT(principal_type, principal_id) DO UPDATE SET
			scope_key = excluded.scope_key
	`, actorID, scopeKey)
	return err
}

func MustURI(uri string) common.CanonURI {
	parsed, err := common.CastURI(uri)
	if err != nil {
		panic(err)
	}
	return parsed
}

func smokeDebugProvider(ctx context.Context, frontend vfs.VFSFrontend, actorID string) error {
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: actorID}

	if _, err := frontend.ReadDir(ctx, actor, MustURI("debug@default[debug]:///")); err != nil {
		return err
	}
	_, err := frontend.Control(ctx, actor, MustURI("debug@default[debug]:///control"), "ping", []byte("debug"))
	return err
}
