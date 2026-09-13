package v2test

import (
	v2 "MyServer/internal/vfs/v2"
	systemscopes "MyServer/internal/vfs/v2/providers/system/scopes"
	"MyServer/internal/vfs/v2/storage"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"os"
	"reflect"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func newScopesFrontendTestDB(t *testing.T) *sql.DB {
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
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE vfs_provider_connections (
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
			UNIQUE(scope_key, connection_key)
		);
		CREATE UNIQUE INDEX idx_vfs_provider_connections_scope_display_name
		ON vfs_provider_connections(scope_key, display_name)
		WHERE display_name != '';

		CREATE TABLE vfs_principal_default_scopes (
			principal_type TEXT NOT NULL,
			principal_id TEXT NOT NULL,
			scope_key TEXT NOT NULL,
			PRIMARY KEY (principal_type, principal_id)
		);

		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES ('system', 'system', 'user:42');

		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES ('system', 'scopes', 'scopes', 'scopes', '{}', 'active', 1);

		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES ('system', 'debug', 'default', 'default', '{}', 'active', 1);
	`

	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("db.Exec(schema) error = %v", err)
	}

	return db
}

func newScopesFrontend(t *testing.T, db *sql.DB) v2.VFSFrontend {
	t.Helper()

	scopeResolver, err := v2.NewScopeResolver(db)
	if err != nil {
		t.Fatalf("NewScopeResolver() error = %v", err)
	}

	registry := v2.NewProviderRegistry()
	scopeStorage, err := storage.NewScopeManager(db)
	if err != nil {
		t.Fatalf("NewScopeManager() error = %v", err)
	}
	connectionStorage, err := storage.NewConnectionStorage(db)
	if err != nil {
		t.Fatalf("NewConnectionStorage() error = %v", err)
	}
	registry.Register("scopes", systemscopes.Factory(context.Background(), systemscopes.DI{
		Connections: connectionStorage,
		Scopes:      scopeStorage,
	}))

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

func TestScopesProviderThroughVFSFrontend_ReadDirRoot(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///"))
	if err != nil {
		t.Fatalf("ReadDir(scopes root) error = %v", err)
	}

	logNodes(t, "VFSFrontend ReadDir(scopes@scopes[system]:///)", nodes)
	assertNodeNames(t, nodes, []string{"scopes", "me"})
	assertDirNodes(t, nodes)
}

func TestScopesProviderThroughVFSFrontend_ReadDirScopes(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes"))
	if err != nil {
		t.Fatalf("ReadDir(scopes list) error = %v", err)
	}

	logNodes(t, "VFSFrontend ReadDir(scopes@scopes[system]:///scopes)", nodes)
	assertNodeNames(t, nodes, []string{"system"})
	assertDirNodes(t, nodes)
	if nodes[0].Kind != "scope" {
		t.Fatalf("nodes[0].Kind = %q, want %q", nodes[0].Kind, "scope")
	}
}

func TestScopesProviderThroughVFSFrontend_ReadDirScope(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system"))
	if err != nil {
		t.Fatalf("ReadDir(scope dir) error = %v", err)
	}

	logNodes(t, "VFSFrontend ReadDir(scopes@scopes[system]:///scopes/system)", nodes)
	assertNodeNames(t, nodes, []string{"connections", "info.json"})
	if nodes[0].Kind != "dir" {
		t.Fatalf("nodes[0].Kind = %q, want %q", nodes[0].Kind, "dir")
	}
	if !nodes[0].IsDir {
		t.Fatalf("nodes[0].IsDir = false, want true")
	}
	if nodes[1].Kind != "file" || nodes[1].IsDir {
		t.Fatalf("nodes[1] = %+v, want info.json file", nodes[1])
	}
}

func TestScopesProviderThroughVFSFrontend_ReadDirScopeConnections(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections"))
	if err != nil {
		t.Fatalf("ReadDir(scope connections) error = %v", err)
	}

	logNodes(t, "VFSFrontend ReadDir(scopes@scopes[system]:///scopes/system/connections)", nodes)
	assertNodeNames(t, nodes, []string{"debug@default", "scopes@scopes"})
	assertDirNodes(t, nodes)
	assertNodeKinds(t, nodes, "connection")
}

func TestScopesProviderThroughVFSFrontend_ReadDirScopeConnectionsIncludesInactiveAndNotReady(t *testing.T) {
	db := newScopesFrontendTestDB(t)
	_, err := db.Exec(`
		UPDATE vfs_provider_connections
		SET status = 'inactive', ready = 0
		WHERE scope_key = 'system'
		  AND provider = 'debug'
		  AND connection_key = 'default'
	`)
	if err != nil {
		t.Fatalf("db.Exec(disable debug connection) error = %v", err)
	}

	frontend := newScopesFrontend(t, db)
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections"))
	if err != nil {
		t.Fatalf("ReadDir(scope connections) error = %v", err)
	}

	assertNodeNames(t, nodes, []string{"debug@default", "scopes@scopes"})
	assertNodeKinds(t, nodes, "connection")
}

func TestScopesProviderThroughVFSFrontend_ReadDirScopeConnection(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/scopes@scopes"))
	if err != nil {
		t.Fatalf("ReadDir(connection dir) error = %v", err)
	}

	logNodes(t, "VFSFrontend ReadDir(scopes@scopes[system]:///scopes/system/connections/scopes@scopes)", nodes)
	assertNodeNames(t, nodes, []string{"info.json", "profile.json", "config.json", "status.json"})
	if nodes[0].IsDir || nodes[0].Kind != "file" {
		t.Fatalf("nodes[0] = %+v, want info.json file", nodes[0])
	}
}

func TestScopesProviderThroughVFSFrontend_CreateConfigureAndReadyConnection(t *testing.T) {
	db := newScopesFrontendTestDB(t)
	frontend := newScopesFrontend(t, db)
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	node, err := frontend.Mkdir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/webdav@nextcloud"))
	if err != nil {
		t.Fatalf("Mkdir(connection) error = %v", err)
	}
	if node.Name != "webdav@nextcloud" || node.Kind != "connection" || !node.IsDir {
		t.Fatalf("created connection node = %+v, want webdav@nextcloud connection dir", node)
	}

	configFile, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/webdav@nextcloud/config.json"), os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(config.json write) error = %v", err)
	}
	if _, err := configFile.Write([]byte(`{"base_url":"https://cloud.example.test","username":"alice"}`)); err != nil {
		t.Fatalf("Write(config.json) error = %v", err)
	}
	if err := configFile.Close(); err != nil {
		t.Fatalf("Close(config.json) error = %v", err)
	}

	statusFile, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/webdav@nextcloud/status.json"), os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(status.json write) error = %v", err)
	}
	if _, err := statusFile.Write([]byte(`{"ready":true}`)); err != nil {
		t.Fatalf("Write(status.json) error = %v", err)
	}
	if err := statusFile.Close(); err != nil {
		t.Fatalf("Close(status.json) error = %v", err)
	}

	connection := readConnection(t, db, "system", "webdav", "nextcloud")
	if connection.Status != "active" || !connection.Ready {
		t.Fatalf("connection status/ready = %q/%v, want active/true", connection.Status, connection.Ready)
	}
	if connection.DisplayName != "nextcloud" {
		t.Fatalf("connection display_name = %q, want nextcloud", connection.DisplayName)
	}
	if string(connection.Config) != `{"base_url":"https://cloud.example.test","username":"alice"}` {
		t.Fatalf("connection config = %s", connection.Config)
	}
}

func TestScopesProviderThroughVFSFrontend_CreatesConnectionWithDisplayName(t *testing.T) {
	db := newScopesFrontendTestDB(t)
	frontend := newScopesFrontend(t, db)
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	node, err := frontend.Mkdir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@Мои файлы"))
	if err != nil {
		t.Fatalf("Mkdir(connection with display name) error = %v", err)
	}
	if node.Name == "debug@Мои файлы" {
		t.Fatalf("created node name = %q, want generated internal connection name", node.Name)
	}

	connection := readConnectionByDisplayName(t, db, "system", "Мои файлы")
	if connection.ProviderKey != "debug" {
		t.Fatalf("connection provider = %q, want debug", connection.ProviderKey)
	}
	if connection.ConnectionKey == "" || connection.ConnectionKey == "Мои файлы" {
		t.Fatalf("connection key = %q, want generated technical key", connection.ConnectionKey)
	}
	if connection.DisplayName != "Мои файлы" {
		t.Fatalf("connection display_name = %q, want Мои файлы", connection.DisplayName)
	}

	infoFile, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/"+node.Name+"/info.json"), os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(info.json) error = %v", err)
	}
	data, readErr := io.ReadAll(infoFile)
	closeErr := infoFile.Close()
	if readErr != nil {
		t.Fatalf("ReadAll(info.json) error = %v", readErr)
	}
	if closeErr != nil {
		t.Fatalf("Close(info.json) error = %v", closeErr)
	}
	if !strings.Contains(string(data), `"display_name": "Мои файлы"`) {
		t.Fatalf("info.json = %s, want display_name", data)
	}
}

func TestScopesProviderThroughVFSFrontend_RenamesConnectionDisplayName(t *testing.T) {
	db := newScopesFrontendTestDB(t)
	frontend := newScopesFrontend(t, db)
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	source := mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@default")
	target := mustURI(t, "scopes@scopes[system]:///scopes/system/connections/Работа")
	if err := frontend.Move(ctx, actor, source, target); err != nil {
		t.Fatalf("Move(connection display name) error = %v", err)
	}

	connection := readConnection(t, db, "system", "debug", "default")
	if connection.DisplayName != "Работа" {
		t.Fatalf("connection display_name = %q, want Работа", connection.DisplayName)
	}
}

func TestScopesProviderThroughVFSFrontend_WritesConnectionProfile(t *testing.T) {
	db := newScopesFrontendTestDB(t)
	frontend := newScopesFrontend(t, db)
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	profileFile, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@default/profile.json"), os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(profile.json write) error = %v", err)
	}
	if _, err := profileFile.Write([]byte(`{"display_name":"Рабочие файлы"}`)); err != nil {
		t.Fatalf("Write(profile.json) error = %v", err)
	}
	if err := profileFile.Close(); err != nil {
		t.Fatalf("Close(profile.json) error = %v", err)
	}

	connection := readConnection(t, db, "system", "debug", "default")
	if connection.DisplayName != "Рабочие файлы" {
		t.Fatalf("connection display_name = %q, want Рабочие файлы", connection.DisplayName)
	}

	file, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@default/profile.json"), os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(profile.json read) error = %v", err)
	}
	data, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if readErr != nil {
		t.Fatalf("ReadAll(profile.json) error = %v", readErr)
	}
	if closeErr != nil {
		t.Fatalf("Close(profile.json) error = %v", closeErr)
	}
	if !strings.Contains(string(data), `"display_name": "Рабочие файлы"`) {
		t.Fatalf("profile.json = %s, want updated display_name", data)
	}
}

func TestScopesProviderThroughVFSFrontend_RejectsInvalidConnectionConfig(t *testing.T) {
	db := newScopesFrontendTestDB(t)
	frontend := newScopesFrontend(t, db)
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	if _, err := frontend.Mkdir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/webdav@nextcloud")); err != nil {
		t.Fatalf("Mkdir(connection) error = %v", err)
	}

	configFile, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/connections/webdav@nextcloud/config.json"), os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(config.json write) error = %v", err)
	}
	if _, err := configFile.Write([]byte(`{"base_url":`)); err != nil {
		t.Fatalf("Write(config.json) error = %v", err)
	}
	err = configFile.Close()
	if !errors.Is(err, os.ErrInvalid) {
		t.Fatalf("Close(config.json) error = %v, want %v", err, os.ErrInvalid)
	}

	connection := readConnection(t, db, "system", "webdav", "nextcloud")
	if string(connection.Config) != "{}" || connection.Ready {
		t.Fatalf("connection after rejected config = config:%s ready:%v, want {}/false", connection.Config, connection.Ready)
	}
}

func TestScopesProviderThroughVFSFrontend_ReadDirMissingScopeConnections(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	_, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/missing/connections"))
	if !errors.Is(err, storage.ErrScopeNotFound) {
		t.Fatalf("ReadDir(missing scope connections) error = %v, want scope not found", err)
	}
}

func TestScopesProviderThroughVFSFrontend_ReadDirMissing(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	_, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///missing"))
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("ReadDir(missing) error = %v, want %v", err, os.ErrNotExist)
	}
}

func TestScopesProviderThroughVFSFrontend_CreateAndDeleteUserScope(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	node, err := frontend.Mkdir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/work"))
	if err != nil {
		t.Fatalf("Mkdir(scope) error = %v", err)
	}
	if node.Name != "ea3fd4-work" || node.Kind != "scope" || !node.IsDir {
		t.Fatalf("created scope node = %+v, want scope dir named ea3fd4-work", node)
	}

	stat, err := frontend.Stat(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/ea3fd4-work"))
	if err != nil {
		t.Fatalf("Stat(created scope) error = %v", err)
	}
	if stat.Name != "ea3fd4-work" || stat.Kind != "scope" {
		t.Fatalf("created scope stat = %+v, want ea3fd4-work scope", stat)
	}

	file, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/ea3fd4-work/info.json"), os.O_RDONLY)
	if err != nil {
		t.Fatalf("OpenFile(created scope info) error = %v", err)
	}
	data, err := io.ReadAll(file)
	if closeErr := file.Close(); closeErr != nil {
		t.Fatalf("Close(created scope info) error = %v", closeErr)
	}
	if err != nil {
		t.Fatalf("ReadAll(created scope info) error = %v", err)
	}
	var info map[string]any
	if err := json.Unmarshal(data, &info); err != nil {
		t.Fatalf("Unmarshal(created scope info) error = %v; body=%s", err, data)
	}
	if info["kind"] != "user" || info["owner_subject_key"] != "user:42" {
		t.Fatalf("created scope info = %#v, want kind=user owner_subject_key=user:42", info)
	}

	if err := frontend.Delete(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/ea3fd4-work")); err != nil {
		t.Fatalf("Delete(created scope) error = %v", err)
	}

	_, err = frontend.Stat(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/ea3fd4-work"))
	if err == nil {
		t.Fatalf("Stat(deleted scope) error = nil, want missing scope error")
	}
}

func TestScopesProviderThroughVFSFrontend_CreateScopeRejectsSpecialChars(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	_, err := frontend.Mkdir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/bad.name"))
	if !errors.Is(err, v2.ErrInvalidScope) {
		t.Fatalf("Mkdir(scope with special chars) error = %v, want %v", err, v2.ErrInvalidScope)
	}
}

func TestScopesProviderThroughVFSFrontend_WriteDefaultScopeJSON(t *testing.T) {
	db := newScopesFrontendTestDB(t)
	_, err := db.Exec(`
		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES ('ea3fd4-work', 'user', 'user:42');

		INSERT INTO vfs_principal_default_scopes (principal_type, principal_id, scope_key)
		VALUES ('user', '42', 'system');
	`)
	if err != nil {
		t.Fatalf("seed default scope test data error = %v", err)
	}

	frontend := newScopesFrontend(t, db)
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	file, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///me/default_scope.json"), os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		t.Fatalf("OpenFile(default_scope.json write) error = %v", err)
	}
	if _, err := file.Write([]byte(`{"scope_key":"ea3fd4-work"}`)); err != nil {
		t.Fatalf("Write(default_scope.json) error = %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("Close(default_scope.json) error = %v", err)
	}

	got := readDefaultScopeKey(t, db, "user", "42")
	if got != "ea3fd4-work" {
		t.Fatalf("default scope = %q, want %q", got, "ea3fd4-work")
	}
}

func TestScopesProviderThroughVFSFrontend_WriteDefaultScopeJSONRejectsInvalidPayload(t *testing.T) {
	db := newScopesFrontendTestDB(t)
	_, err := db.Exec(`
		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES ('ea3fd4-work', 'user', 'user:42');

		INSERT INTO vfs_principal_default_scopes (principal_type, principal_id, scope_key)
		VALUES ('user', '42', 'system');
	`)
	if err != nil {
		t.Fatalf("seed default scope test data error = %v", err)
	}

	frontend := newScopesFrontend(t, db)
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	tests := []struct {
		name    string
		body    string
		wantErr error
	}{
		{
			name:    "broken json",
			body:    `{"scope_key":`,
			wantErr: os.ErrInvalid,
		},
		{
			name:    "invalid scope key chars",
			body:    `{"scope_key":"bad.scope"}`,
			wantErr: v2.ErrInvalidScope,
		},
		{
			name:    "missing scope",
			body:    `{"scope_key":"missing"}`,
			wantErr: v2.ErrInvalidScope,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			file, err := frontend.OpenFile(ctx, actor, mustURI(t, "scopes@scopes[system]:///me/default_scope.json"), os.O_WRONLY|os.O_TRUNC)
			if err != nil {
				t.Fatalf("OpenFile(default_scope.json write) error = %v", err)
			}
			if _, err := file.Write([]byte(tt.body)); err != nil {
				t.Fatalf("Write(default_scope.json) error = %v", err)
			}
			err = file.Close()
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Close(default_scope.json) error = %v, want %v", err, tt.wantErr)
			}

			got := readDefaultScopeKey(t, db, "user", "42")
			if got != "system" {
				t.Fatalf("default scope after rejected write = %q, want system", got)
			}
		})
	}
}

func TestScopesProviderThroughVFSFrontend_DeleteSystemScopeDenied(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	err := frontend.Delete(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system"))
	if !errors.Is(err, os.ErrPermission) {
		t.Fatalf("Delete(system scope) error = %v, want %v", err, os.ErrPermission)
	}

	if _, err := frontend.Stat(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system")); err != nil {
		t.Fatalf("Stat(system scope after denied delete) error = %v", err)
	}
}

func TestScopesProviderThroughVFSFrontend_OpenInfoJSON(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	tests := []struct {
		name string
		uri  string
		want map[string]string
	}{
		{
			name: "scope info",
			uri:  "scopes@scopes[system]:///scopes/system/info.json",
			want: map[string]string{
				"scope_key":         "system",
				"kind":              "system",
				"owner_subject_key": "user:42",
			},
		},
		{
			name: "connection info",
			uri:  "scopes@scopes[system]:///scopes/system/connections/scopes@scopes/info.json",
			want: map[string]string{
				"scope_key":      "system",
				"provider_key":   "scopes",
				"connection_key": "scopes",
				"status":         "active",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			file, err := frontend.OpenFile(ctx, actor, mustURI(t, tt.uri), os.O_RDONLY)
			if err != nil {
				t.Fatalf("OpenFile(%s) error = %v", tt.uri, err)
			}
			defer file.Close()

			data, err := io.ReadAll(file)
			if err != nil {
				t.Fatalf("ReadAll(%s) error = %v", tt.uri, err)
			}

			var got map[string]any
			if err := json.Unmarshal(data, &got); err != nil {
				t.Fatalf("Unmarshal(%s) error = %v; body=%s", tt.uri, err, data)
			}
			for key, wantValue := range tt.want {
				if got[key] != wantValue {
					t.Fatalf("json[%q] = %#v, want %q; body=%s", key, got[key], wantValue, data)
				}
			}
			if tt.name == "connection info" && got["id"] != float64(1) {
				t.Fatalf("json[id] = %#v, want 1; body=%s", got["id"], data)
			}
		})
	}
}

func logNodes(t *testing.T, label string, nodes []*v2.Node) {
	t.Helper()

	out, err := json.MarshalIndent(nodes, "", "  ")
	if err != nil {
		t.Fatalf("MarshalIndent() error = %v", err)
	}
	t.Logf("%s:\n%s", label, out)
}

func assertNodeNames(t *testing.T, nodes []*v2.Node, want []string) {
	t.Helper()

	got := make([]string, 0, len(nodes))
	for _, node := range nodes {
		got = append(got, node.Name)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("node names = %+v, want %+v", got, want)
	}
}

func assertDirNodes(t *testing.T, nodes []*v2.Node) {
	t.Helper()

	for _, node := range nodes {
		if !node.IsDir {
			t.Fatalf("node %q IsDir = false, want true", node.Name)
		}
		if node.UpdatedAt.IsZero() {
			t.Fatalf("node %q UpdatedAt is zero", node.Name)
		}
	}
}

func assertNodeKinds(t *testing.T, nodes []*v2.Node, want string) {
	t.Helper()

	for _, node := range nodes {
		if node.Kind != want {
			t.Fatalf("node %q Kind = %q, want %q", node.Name, node.Kind, want)
		}
	}
}

func readDefaultScopeKey(t *testing.T, db *sql.DB, principalType string, principalID string) string {
	t.Helper()

	var got string
	err := db.QueryRow(
		`SELECT scope_key FROM vfs_principal_default_scopes WHERE principal_type = ? AND principal_id = ?`,
		principalType,
		principalID,
	).Scan(&got)
	if err != nil {
		t.Fatalf("QueryRow(default scope) error = %v", err)
	}
	return got
}

func readConnection(t *testing.T, db *sql.DB, scopeKey string, providerKey string, connectionKey string) v2.ProviderConnection {
	t.Helper()

	var connection v2.ProviderConnection
	var config string
	err := db.QueryRow(
		`SELECT id, scope_key, provider, connection_key, display_name, config_json, config_version, status, ready
		 FROM vfs_provider_connections
		 WHERE scope_key = ? AND provider = ? AND connection_key = ?`,
		scopeKey,
		providerKey,
		connectionKey,
	).Scan(
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
	if err != nil {
		t.Fatalf("QueryRow(connection) error = %v", err)
	}
	connection.Config = []byte(config)
	return connection
}

func readConnectionByDisplayName(t *testing.T, db *sql.DB, scopeKey string, displayName string) v2.ProviderConnection {
	t.Helper()

	var connection v2.ProviderConnection
	var config string
	err := db.QueryRow(
		`SELECT id, scope_key, provider, connection_key, display_name, config_json, config_version, status, ready
		 FROM vfs_provider_connections
		 WHERE scope_key = ? AND display_name = ?`,
		scopeKey,
		displayName,
	).Scan(
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
	if err != nil {
		t.Fatalf("QueryRow(connection by display name) error = %v", err)
	}
	connection.Config = []byte(config)
	return connection
}
