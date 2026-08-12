package storage

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"context"
	"database/sql"
	"errors"
	"reflect"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func newStorageTestDB(t *testing.T) *sql.DB {
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
		PRAGMA foreign_keys = ON;

		CREATE TABLE vfs_scopes (
			scope_key TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			owner_subject_key TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(scope_key)
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
			FOREIGN KEY (scope_key) REFERENCES vfs_scopes(scope_key) ON DELETE CASCADE,
			UNIQUE(scope_key, connection_key)
		);
		CREATE UNIQUE INDEX idx_vfs_provider_connections_scope_display_name
		ON vfs_provider_connections(scope_key, display_name)
		WHERE display_name != '';

		CREATE TABLE vfs_principal_default_scopes (
			principal_type TEXT NOT NULL,
			principal_id TEXT NOT NULL,
			scope_key TEXT NOT NULL,
			PRIMARY KEY (principal_type, principal_id),
			FOREIGN KEY (scope_key) REFERENCES vfs_scopes(scope_key) ON DELETE CASCADE
		);
	`
	if _, err := db.Exec(schema); err != nil {
		t.Fatalf("db.Exec(schema) error = %v", err)
	}

	return db
}

func newScopeStorageForTest(t *testing.T) ScopeStorageContract {
	t.Helper()

	storage, err := NewScopeManager(newStorageTestDB(t))
	if err != nil {
		t.Fatalf("NewScopeManager() error = %v", err)
	}
	return storage
}

func newConnectionStorageForTest(t *testing.T, db *sql.DB) ConnectionStorageContract {
	t.Helper()

	storage, err := NewConnectionStorage(db)
	if err != nil {
		t.Fatalf("NewConnectionStorage() error = %v", err)
	}
	return storage
}

func TestNewScopeManager_NilDB(t *testing.T) {
	got, err := NewScopeManager(nil)
	if !errors.Is(err, vfs.ErrInvalidNewInstanceParams) {
		t.Fatalf("NewScopeManager(nil) error = %v, want %v", err, vfs.ErrInvalidNewInstanceParams)
	}
	if got != nil {
		t.Fatalf("NewScopeManager(nil) = %#v, want nil", got)
	}
}

func TestScopeStorage_CreateGetListDelete(t *testing.T) {
	ctx := context.Background()
	storage := newScopeStorageForTest(t)
	owner := common.SubjectKey("user:42")

	if err := storage.Create(ctx, owner, "  alice-home  "); err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if err := storage.Create(ctx, common.SubjectKey("group:staff"), "shared-docs"); err != nil {
		t.Fatalf("Create(shared) error = %v", err)
	}

	got, err := storage.Get(ctx, " alice-home ")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	want := &vfs.Scope{
		Key:             "alice-home",
		Kind:            "user",
		OwnerSubjectKey: owner,
	}
	if got.Key != want.Key ||
		got.Kind != want.Kind ||
		got.OwnerSubjectKey != want.OwnerSubjectKey ||
		got.UpdatedAt == nil {
		t.Fatalf("Get() = %+v, want %+v", got, want)
	}

	list, err := storage.List(ctx, owner)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(list) != 1 ||
		list[0].Key != want.Key ||
		list[0].Kind != want.Kind ||
		list[0].OwnerSubjectKey != want.OwnerSubjectKey ||
		list[0].UpdatedAt == nil {
		t.Fatalf("List() = %+v, want [%+v]", list, want)
	}

	if err := storage.Delete(ctx, "alice-home"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	_, err = storage.Get(ctx, "alice-home")
	if !errors.Is(err, ErrScopeNotFound) {
		t.Fatalf("Get(deleted) error = %v, want %v", err, ErrScopeNotFound)
	}
}

func TestScopeStorage_SetDefault_ReplacesExistingDefault(t *testing.T) {
	ctx := context.Background()
	db := newStorageTestDB(t)
	storage, err := NewScopeManager(db)
	if err != nil {
		t.Fatalf("NewScopeManager() error = %v", err)
	}
	principal := common.SubjectKey("user:42")

	if err := storage.Create(ctx, principal, "alice-home"); err != nil {
		t.Fatalf("Create(alice-home) error = %v", err)
	}
	if err := storage.Create(ctx, principal, "alice-work"); err != nil {
		t.Fatalf("Create(alice-work) error = %v", err)
	}

	if err := storage.SetDefault(ctx, principal, "alice-home"); err != nil {
		t.Fatalf("SetDefault(alice-home) error = %v", err)
	}
	if err := storage.SetDefault(ctx, principal, "alice-work"); err != nil {
		t.Fatalf("SetDefault(alice-work) error = %v", err)
	}

	var got string
	err = db.QueryRowContext(
		ctx,
		`SELECT scope_key FROM vfs_principal_default_scopes WHERE principal_type = ? AND principal_id = ?`,
		"user",
		"42",
	).Scan(&got)
	if err != nil {
		t.Fatalf("QueryRow(default scope) error = %v", err)
	}
	if got != "alice-work" {
		t.Fatalf("default scope = %q, want %q", got, "alice-work")
	}
}

func TestScopeStorage_Errors(t *testing.T) {
	ctx := context.Background()
	storage := newScopeStorageForTest(t)

	tests := []struct {
		name string
		run  func() error
		want error
	}{
		{
			name: "create empty scope",
			run:  func() error { return storage.Create(ctx, common.SubjectKey("user:42"), " ") },
			want: ErrScopeNotCreated,
		},
		{
			name: "create invalid owner",
			run:  func() error { return storage.Create(ctx, common.SubjectKey("user"), "alice-home") },
			want: ErrScopeNotCreated,
		},
		{
			name: "get empty scope",
			run: func() error {
				_, err := storage.Get(ctx, " ")
				return err
			},
			want: ErrScopeNotFound,
		},
		{
			name: "list invalid subject",
			run: func() error {
				_, err := storage.List(ctx, common.SubjectKey("user"))
				return err
			},
			want: ErrScopesNotListed,
		},
		{
			name: "delete missing scope",
			run:  func() error { return storage.Delete(ctx, "missing") },
			want: ErrScopeNotDeleted,
		},
		{
			name: "set default missing scope",
			run:  func() error { return storage.SetDefault(ctx, common.SubjectKey("user:42"), "missing") },
			want: ErrDefaultNotSet,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.run(); !errors.Is(err, tt.want) {
				t.Fatalf("error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestNewConnectionStorage_NilDB(t *testing.T) {
	got, err := NewConnectionStorage(nil)
	if !errors.Is(err, vfs.ErrInvalidNewInstanceParams) {
		t.Fatalf("NewConnectionStorage(nil) error = %v, want %v", err, vfs.ErrInvalidNewInstanceParams)
	}
	if got != nil {
		t.Fatalf("NewConnectionStorage(nil) = %#v, want nil", got)
	}
}

func TestConnectionStorage_CreateGetListUpdateDelete(t *testing.T) {
	ctx := context.Background()
	db := newStorageTestDB(t)
	scopeStorage, err := NewScopeManager(db)
	if err != nil {
		t.Fatalf("NewScopeManager() error = %v", err)
	}
	connectionStorage := newConnectionStorageForTest(t, db)

	if err := scopeStorage.Create(ctx, common.SubjectKey("user:42"), "alice-home"); err != nil {
		t.Fatalf("Create(scope) error = %v", err)
	}

	if err := connectionStorage.Create(ctx, vfs.ProviderConnection{
		ScopeKey:      " alice-home ",
		ProviderKey:   " filesystem ",
		ConnectionKey: " local ",
		Config:        []byte(`{"root":"/tmp/a"}`),
	}); err != nil {
		t.Fatalf("Create(local) error = %v", err)
	}
	if err := connectionStorage.Create(ctx, vfs.ProviderConnection{
		ScopeKey:      "alice-home",
		ProviderKey:   "memory",
		ConnectionKey: "cache",
		Status:        "paused",
	}); err != nil {
		t.Fatalf("Create(cache) error = %v", err)
	}

	got, err := connectionStorage.Get(ctx, "alice-home", "filesystem", "local")
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	want := &vfs.ProviderConnection{
		ID:            1,
		ScopeKey:      "alice-home",
		ProviderKey:   "filesystem",
		ConnectionKey: "local",
		DisplayName:   "local",
		Config:        []byte(`{"root":"/tmp/a"}`),
		ConfigVersion: 1,
		Status:        "active",
		Ready:         false,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Get() = %+v, want %+v", got, want)
	}

	all, err := connectionStorage.List(ctx, "alice-home", "")
	if err != nil {
		t.Fatalf("List(all) error = %v", err)
	}
	if gotKeys := connectionKeys(all); !reflect.DeepEqual(gotKeys, []string{"filesystem/local", "memory/cache"}) {
		t.Fatalf("List(all) keys = %+v, want %+v", gotKeys, []string{"filesystem/local", "memory/cache"})
	}

	filtered, err := connectionStorage.List(ctx, "alice-home", "filesystem")
	if err != nil {
		t.Fatalf("List(filtered) error = %v", err)
	}
	if gotKeys := connectionKeys(filtered); !reflect.DeepEqual(gotKeys, []string{"filesystem/local"}) {
		t.Fatalf("List(filtered) keys = %+v, want %+v", gotKeys, []string{"filesystem/local"})
	}

	if err := connectionStorage.UpdateConfig(ctx, "alice-home", "filesystem", "local", nil); err != nil {
		t.Fatalf("UpdateConfig() error = %v", err)
	}
	got, err = connectionStorage.Get(ctx, "alice-home", "filesystem", "local")
	if err != nil {
		t.Fatalf("Get(after UpdateConfig) error = %v", err)
	}
	if string(got.Config) != "{}" {
		t.Fatalf("updated config = %q, want %q", got.Config, "{}")
	}
	if got.ConfigVersion != 2 {
		t.Fatalf("config version after UpdateConfig = %d, want 2", got.ConfigVersion)
	}

	if err := connectionStorage.SetStatus(ctx, "alice-home", "filesystem", "local", "disabled"); err != nil {
		t.Fatalf("SetStatus() error = %v", err)
	}
	got, err = connectionStorage.Get(ctx, "alice-home", "filesystem", "local")
	if err != nil {
		t.Fatalf("Get(after SetStatus) error = %v", err)
	}
	if got.Status != "disabled" {
		t.Fatalf("updated status = %q, want %q", got.Status, "disabled")
	}
	if err := connectionStorage.SetReady(ctx, "alice-home", "filesystem", "local", true); err != nil {
		t.Fatalf("SetReady() error = %v", err)
	}
	got, err = connectionStorage.Get(ctx, "alice-home", "filesystem", "local")
	if err != nil {
		t.Fatalf("Get(after SetReady) error = %v", err)
	}
	if !got.Ready {
		t.Fatalf("updated ready = false, want true")
	}

	if err := connectionStorage.Delete(ctx, "alice-home", "filesystem", "local"); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}
	_, err = connectionStorage.Get(ctx, "alice-home", "filesystem", "local")
	if !errors.Is(err, ErrConnectionNotFound) {
		t.Fatalf("Get(deleted) error = %v, want %v", err, ErrConnectionNotFound)
	}
}

func TestConnectionStorage_CreateRejectsDuplicateConnectionKeyInScope(t *testing.T) {
	ctx := context.Background()
	db := newStorageTestDB(t)
	scopeStorage, err := NewScopeManager(db)
	if err != nil {
		t.Fatalf("NewScopeManager() error = %v", err)
	}
	connectionStorage := newConnectionStorageForTest(t, db)

	if err := scopeStorage.Create(ctx, common.SubjectKey("user:42"), "alice-home"); err != nil {
		t.Fatalf("Create(scope) error = %v", err)
	}
	if err := scopeStorage.Create(ctx, common.SubjectKey("user:42"), "alice-work"); err != nil {
		t.Fatalf("Create(second scope) error = %v", err)
	}

	if err := connectionStorage.Create(ctx, vfs.ProviderConnection{
		ScopeKey:      "alice-home",
		ProviderKey:   "filesystem",
		ConnectionKey: "default",
	}); err != nil {
		t.Fatalf("Create(first connection) error = %v", err)
	}

	err = connectionStorage.Create(ctx, vfs.ProviderConnection{
		ScopeKey:      "alice-home",
		ProviderKey:   "memory",
		ConnectionKey: "default",
	})
	if !errors.Is(err, ErrConnectionNotCreated) {
		t.Fatalf("Create(duplicate connection key in scope) error = %v, want %v", err, ErrConnectionNotCreated)
	}

	if err := connectionStorage.Create(ctx, vfs.ProviderConnection{
		ScopeKey:      "alice-work",
		ProviderKey:   "memory",
		ConnectionKey: "default",
	}); err != nil {
		t.Fatalf("Create(same connection key in different scope) error = %v", err)
	}
}

func TestConnectionStorage_Errors(t *testing.T) {
	ctx := context.Background()
	db := newStorageTestDB(t)
	scopeStorage, err := NewScopeManager(db)
	if err != nil {
		t.Fatalf("NewScopeManager() error = %v", err)
	}
	connectionStorage := newConnectionStorageForTest(t, db)
	if err := scopeStorage.Create(ctx, common.SubjectKey("user:42"), "alice-home"); err != nil {
		t.Fatalf("Create(scope) error = %v", err)
	}

	tests := []struct {
		name string
		run  func() error
		want error
	}{
		{
			name: "create missing scope",
			run: func() error {
				return connectionStorage.Create(ctx, vfs.ProviderConnection{
					ScopeKey:      "missing",
					ProviderKey:   "filesystem",
					ConnectionKey: "local",
				})
			},
			want: ErrConnectionNotCreated,
		},
		{
			name: "create empty provider",
			run: func() error {
				return connectionStorage.Create(ctx, vfs.ProviderConnection{
					ScopeKey:      "alice-home",
					ConnectionKey: "local",
				})
			},
			want: ErrConnectionNotCreated,
		},
		{
			name: "get empty connection",
			run: func() error {
				_, err := connectionStorage.Get(ctx, "alice-home", "filesystem", " ")
				return err
			},
			want: ErrConnectionNotFound,
		},
		{
			name: "list empty scope",
			run: func() error {
				_, err := connectionStorage.List(ctx, " ", "filesystem")
				return err
			},
			want: ErrConnectionsNotListed,
		},
		{
			name: "delete missing connection",
			run:  func() error { return connectionStorage.Delete(ctx, "alice-home", "filesystem", "missing") },
			want: ErrConnectionNotDeleted,
		},
		{
			name: "update missing connection",
			run: func() error {
				return connectionStorage.UpdateConfig(ctx, "alice-home", "filesystem", "missing", []byte("{}"))
			},
			want: ErrConnectionNotUpdated,
		},
		{
			name: "set empty status",
			run:  func() error { return connectionStorage.SetStatus(ctx, "alice-home", "filesystem", "missing", " ") },
			want: ErrConnectionNotUpdated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.run(); !errors.Is(err, tt.want) {
				t.Fatalf("error = %v, want %v", err, tt.want)
			}
		})
	}
}

func TestStorage_NilReceiver(t *testing.T) {
	ctx := context.Background()

	var scopeStorage *ScopeStorage
	if err := scopeStorage.Create(ctx, common.SubjectKey("user:42"), "alice-home"); !errors.Is(err, vfs.ErrInvalidNewInstanceParams) {
		t.Fatalf("ScopeStorage.Create() error = %v, want %v", err, vfs.ErrInvalidNewInstanceParams)
	}
	if _, err := scopeStorage.Get(ctx, "alice-home"); !errors.Is(err, vfs.ErrInvalidNewInstanceParams) {
		t.Fatalf("ScopeStorage.Get() error = %v, want %v", err, vfs.ErrInvalidNewInstanceParams)
	}

	var connectionStorage *ConnectionStorage
	if err := connectionStorage.Create(ctx, vfs.ProviderConnection{}); !errors.Is(err, vfs.ErrInvalidNewInstanceParams) {
		t.Fatalf("ConnectionStorage.Create() error = %v, want %v", err, vfs.ErrInvalidNewInstanceParams)
	}
	if _, err := connectionStorage.Get(ctx, "scope", "provider", "connection"); !errors.Is(err, vfs.ErrInvalidNewInstanceParams) {
		t.Fatalf("ConnectionStorage.Get() error = %v, want %v", err, vfs.ErrInvalidNewInstanceParams)
	}
}

func connectionKeys(connections []*vfs.ProviderConnection) []string {
	keys := make([]string, 0, len(connections))
	for _, connection := range connections {
		keys = append(keys, connection.ProviderKey+"/"+connection.ConnectionKey)
	}
	return keys
}
