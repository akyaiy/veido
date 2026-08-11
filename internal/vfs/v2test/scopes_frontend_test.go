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
			scope_key TEXT NOT NULL,
			provider TEXT NOT NULL,
			connection_key TEXT NOT NULL,
			config_json TEXT NOT NULL DEFAULT '{}',
			status TEXT NOT NULL DEFAULT 'active',
			PRIMARY KEY (scope_key, provider, connection_key)
		);

		CREATE TABLE vfs_principal_default_scopes (
			principal_type TEXT NOT NULL,
			principal_id TEXT NOT NULL,
			scope_key TEXT NOT NULL,
			PRIMARY KEY (principal_type, principal_id)
		);

		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES ('system', 'system', 'user:42');

		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, config_json, status)
		VALUES ('system', 'scopes', 'scopes', '{}', 'active');

		INSERT INTO vfs_provider_connections (scope_key, provider, connection_key, config_json, status)
		VALUES ('system', 'debug', 'default', '{}', 'active');
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
	assertNodeNames(t, nodes, []string{"scopes", "principals"})
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
	assertNodeNames(t, nodes, []string{"providers", "info.json"})
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

func TestScopesProviderThroughVFSFrontend_ReadDirScopeProviders(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/providers"))
	if err != nil {
		t.Fatalf("ReadDir(scope providers) error = %v", err)
	}

	logNodes(t, "VFSFrontend ReadDir(scopes@scopes[system]:///scopes/system/providers)", nodes)
	assertNodeNames(t, nodes, []string{"debug", "scopes"})
	assertDirNodes(t, nodes)
	assertNodeKinds(t, nodes, "provider")
}

func TestScopesProviderThroughVFSFrontend_ReadDirScopeProvider(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	tests := []struct {
		name         string
		uri          string
		wantNodeName string
	}{
		{
			name:         "debug provider",
			uri:          "scopes@scopes[system]:///scopes/system/providers/debug",
			wantNodeName: "default",
		},
		{
			name:         "scopes provider",
			uri:          "scopes@scopes[system]:///scopes/system/providers/scopes",
			wantNodeName: "scopes",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, tt.uri))
			if err != nil {
				t.Fatalf("ReadDir(scope provider) error = %v", err)
			}

			logNodes(t, "VFSFrontend ReadDir("+tt.uri+")", nodes)
			assertNodeNames(t, nodes, []string{tt.wantNodeName, "info.json"})
			if !nodes[0].IsDir || nodes[0].Kind != "connection" {
				t.Fatalf("nodes[0] = %+v, want connection dir", nodes[0])
			}
			if nodes[1].IsDir || nodes[1].Kind != "file" {
				t.Fatalf("nodes[1] = %+v, want info.json file", nodes[1])
			}
		})
	}
}

func TestScopesProviderThroughVFSFrontend_ReadDirScopeProviderConnection(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/system/providers/scopes/scopes"))
	if err != nil {
		t.Fatalf("ReadDir(connection dir) error = %v", err)
	}

	logNodes(t, "VFSFrontend ReadDir(scopes@scopes[system]:///scopes/system/providers/scopes/scopes)", nodes)
	assertNodeNames(t, nodes, []string{"info.json"})
	if nodes[0].IsDir || nodes[0].Kind != "file" {
		t.Fatalf("nodes[0] = %+v, want info.json file", nodes[0])
	}
}

func TestScopesProviderThroughVFSFrontend_ReadDirMissingScopeProviders(t *testing.T) {
	frontend := newScopesFrontend(t, newScopesFrontendTestDB(t))
	ctx := context.Background()
	actor := v2.Actor{Kind: v2.ActorUser, ID: "42"}

	nodes, err := frontend.ReadDir(ctx, actor, mustURI(t, "scopes@scopes[system]:///scopes/missing/providers"))
	if err != nil {
		t.Fatalf("ReadDir(missing scope providers) error = %v", err)
	}

	logNodes(t, "VFSFrontend ReadDir(scopes@scopes[system]:///scopes/missing/providers)", nodes)
	if len(nodes) != 0 {
		t.Fatalf("nodes length = %d, want 0", len(nodes))
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
			name: "provider info",
			uri:  "scopes@scopes[system]:///scopes/system/providers/scopes/info.json",
			want: map[string]string{
				"scope_key":    "system",
				"provider_key": "scopes",
			},
		},
		{
			name: "connection info",
			uri:  "scopes@scopes[system]:///scopes/system/providers/scopes/scopes/info.json",
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
