package migrate

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestRunIsOrderedIdempotentAndTransactional(t *testing.T) {
	db, err := sql.Open("sqlite3", "file:migrate-runner?mode=memory&cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	group := Group{Name: "test", Migrations: []Migration{
		{Version: 1, Name: "create_items", Up: func(ctx context.Context, tx *sql.Tx) error {
			_, err := tx.ExecContext(ctx, `CREATE TABLE items(id INTEGER PRIMARY KEY, value TEXT)`)
			return err
		}},
		{Version: 2, Name: "add_item", Up: func(ctx context.Context, tx *sql.Tx) error {
			_, err := tx.ExecContext(ctx, `INSERT INTO items(value) VALUES ('kept')`)
			return err
		}},
	}}
	if err := Run(context.Background(), db, group); err != nil {
		t.Fatal(err)
	}
	if err := Run(context.Background(), db, group); err != nil {
		t.Fatalf("second run: %v", err)
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM items`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("items count = %d, err=%v", count, err)
	}

	failing := Group{Name: "failure", Migrations: []Migration{{Version: 1, Name: "rollback", Up: func(ctx context.Context, tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `CREATE TABLE must_rollback(id INTEGER)`); err != nil {
			return err
		}
		return errors.New("stop")
	}}}}
	if err := Run(context.Background(), db, failing); err == nil {
		t.Fatal("failing migration succeeded")
	}
	var exists bool
	if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='must_rollback')`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if exists {
		t.Fatal("failed migration was not rolled back")
	}
}

func TestRunRejectsUnknownAppliedVersion(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := ensureTable(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO schema_migrations(group_name, version, name) VALUES ('test', 99, 'future')`); err != nil {
		t.Fatal(err)
	}
	err = Run(context.Background(), db, Group{Name: "test", Migrations: []Migration{{Version: 1, Name: "known", Up: func(context.Context, *sql.Tx) error { return nil }}}})
	if !errors.Is(err, ErrNewerSchema) {
		t.Fatalf("error = %v, want ErrNewerSchema", err)
	}
}
