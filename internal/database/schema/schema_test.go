package schema

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"MyServer/internal/database/migrate"
	"MyServer/internal/sqliteDB"
	htmlprovider "MyServer/internal/vfs/v2/providers/html"
	localprovider "MyServer/internal/vfs/v2/providers/local"
)

func migratePreprod(ctx context.Context, db *sql.DB) error {
	return Migrate(ctx, db, localprovider.MigrationGroup(), htmlprovider.MigrationGroup())
}

func TestSystemGroupsDoNotRegisterProviders(t *testing.T) {
	groups := SystemGroups()
	want := []string{"core/database", "auth", "vfs/core"}
	if len(groups) != len(want) {
		t.Fatalf("system groups = %d, want %d", len(groups), len(want))
	}
	for index := range want {
		if groups[index].Name != want[index] {
			t.Fatalf("system group %d = %q, want %q", index, groups[index].Name, want[index])
		}
	}
}

func openTestDatabase(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sqliteDB.Open(context.Background(), filepath.Join(t.TempDir(), "database.sqlite3"), sqliteDB.Options{MaxOpenConns: 4})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestMigrateCleanDatabaseAndRepeat(t *testing.T) {
	db := openTestDatabase(t)
	ctx := context.Background()
	if err := migratePreprod(ctx, db); err != nil {
		t.Fatal(err)
	}
	applied, err := migrate.AppliedMigrations(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	if len(applied) != 12 {
		t.Fatalf("applied migrations = %d, want 12", len(applied))
	}
	if err := migratePreprod(ctx, db); err != nil {
		t.Fatalf("second migration: %v", err)
	}
	var after int
	if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if after != len(applied) {
		t.Fatalf("migration rows after repeat = %d, want %d", after, len(applied))
	}
	var sharedExists bool
	if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='vfs_shared_links')`).Scan(&sharedExists); err != nil {
		t.Fatal(err)
	}
	if sharedExists {
		t.Fatal("optional shared migration ran by default")
	}
	for _, table := range []string{"users", "vfs_scopes", "vfs_provider_connections"} {
		var rows int
		if err := db.QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&rows); err != nil {
			t.Fatal(err)
		}
		if rows != 0 {
			t.Fatalf("migration seeded %s with %d rows", table, rows)
		}
	}
}

func TestMigrateUpgradesExistingSchemaWithoutLosingData(t *testing.T) {
	db := openTestDatabase(t)
	if _, err := db.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'unactive'
		);
		INSERT INTO users(username, password_hash, status) VALUES ('existing', 'hash', 'active');
		CREATE TABLE whitelist (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sub INTEGER NOT NULL,
			jti TEXT NOT NULL,
			UNIQUE(sub, jti)
		);
		INSERT INTO whitelist(sub, jti) VALUES (1, 'preserved');
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
			config_json TEXT NOT NULL DEFAULT '{}',
			FOREIGN KEY(scope_key) REFERENCES vfs_scopes(scope_key) ON DELETE CASCADE,
			UNIQUE(scope_key, connection_key)
		);
		CREATE TABLE vfs_principal_default_scopes (
			principal_type TEXT NOT NULL,
			principal_id TEXT NOT NULL,
			scope_key TEXT NOT NULL,
			PRIMARY KEY(principal_type, principal_id),
			FOREIGN KEY(scope_key) REFERENCES vfs_scopes(scope_key) ON DELETE CASCADE
		)
	`); err != nil {
		t.Fatal(err)
	}
	if err := migratePreprod(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	var username string
	if err := db.QueryRow(`SELECT username FROM users WHERE id=1`).Scan(&username); err != nil || username != "existing" {
		t.Fatalf("existing user = %q, err=%v", username, err)
	}
	var displayNameExists bool
	if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM pragma_table_info('vfs_provider_connections') WHERE name='display_name')`).Scan(&displayNameExists); err != nil {
		t.Fatal(err)
	}
	if !displayNameExists {
		t.Fatal("upgrade did not add display_name")
	}
	var jti string
	if err := db.QueryRow(`SELECT jti FROM whitelist WHERE sub=1`).Scan(&jti); err != nil || jti != "preserved" {
		t.Fatalf("preserved whitelist jti = %q, err=%v", jti, err)
	}
	if _, err := db.Exec(`INSERT INTO whitelist(sub, jti) VALUES (9999, 'orphan-after-upgrade')`); err == nil {
		t.Fatal("upgraded whitelist has no enforced user foreign key")
	}
}

func TestForeignKeysApplyToEveryConnection(t *testing.T) {
	db := openTestDatabase(t)
	if err := migratePreprod(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	connections := make([]*sql.Conn, 0, 3)
	for i := 0; i < 3; i++ {
		conn, err := db.Conn(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		connections = append(connections, conn)
		defer conn.Close()
		var enabled int
		if err := conn.QueryRowContext(context.Background(), `PRAGMA foreign_keys`).Scan(&enabled); err != nil || enabled != 1 {
			t.Fatalf("connection %d foreign_keys=%d err=%v", i, enabled, err)
		}
		var busyTimeout int
		if err := conn.QueryRowContext(context.Background(), `PRAGMA busy_timeout`).Scan(&busyTimeout); err != nil || busyTimeout != 5000 {
			t.Fatalf("connection %d busy_timeout=%d err=%v", i, busyTimeout, err)
		}
	}
	_, err := connections[0].ExecContext(context.Background(), `INSERT INTO whitelist(sub, jti) VALUES (9999, 'orphan')`)
	if err == nil {
		t.Fatal("foreign key allowed orphan whitelist row")
	}
}

func TestDatabasePermissionsAndNewerVersion(t *testing.T) {
	path := filepath.Join(t.TempDir(), "private", "database.sqlite3")
	db, err := sqliteDB.Open(context.Background(), path, sqliteDB.Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("database permissions = %o, want 600", info.Mode().Perm())
	}
	directoryInfo, err := os.Stat(filepath.Dir(path))
	if err != nil {
		t.Fatal(err)
	}
	if directoryInfo.Mode().Perm() != 0o750 {
		t.Fatalf("database directory permissions = %o, want 750", directoryInfo.Mode().Perm())
	}
	if err := migratePreprod(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO schema_migrations(group_name, version, name) VALUES ('auth', 99, 'future')`); err != nil {
		t.Fatal(err)
	}
	err = migratePreprod(context.Background(), db)
	if !errors.Is(err, migrate.ErrNewerSchema) {
		t.Fatalf("newer version error = %v", err)
	}
}
