package main

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestRunMigratesWithoutStartingServer(t *testing.T) {
	path := filepath.Join(t.TempDir(), "database.sqlite3")
	if err := run(context.Background(), []string{"-db", path}); err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var users, shared bool
	if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='users')`).Scan(&users); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='vfs_shared_links')`).Scan(&shared); err != nil {
		t.Fatal(err)
	}
	if !users || shared {
		t.Fatalf("users=%v shared=%v", users, shared)
	}
	if err := run(context.Background(), []string{"-db", path}); err != nil {
		t.Fatal(err)
	}
}
