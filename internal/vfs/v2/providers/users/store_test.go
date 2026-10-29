package users

import (
	"github.com/akyaiy/veido/internal/database/migrate"
	"github.com/akyaiy/veido/internal/vfs/v2/storage"
	"context"
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestSQLiteStoreOwnsProfileData(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	if err := migrate.Run(context.Background(), db, storage.MigrationGroup(), MigrationGroup()); err != nil {
		t.Fatal(err)
	}
	store, err := NewSQLiteStore(db)
	if err != nil {
		t.Fatal(err)
	}
	profile, err := store.Put(context.Background(), "42", ProfileUpdate{DisplayName: "Alice", Locale: "en", Timezone: "Europe/Riga"})
	if err != nil {
		t.Fatal(err)
	}
	if profile.UserID != "42" || profile.DisplayName != "Alice" || profile.Timezone != "Europe/Riga" {
		t.Fatalf("profile = %+v", profile)
	}
	updated, err := store.Put(context.Background(), "42", ProfileUpdate{DisplayName: "Alicia", Locale: "lv", Timezone: "Europe/Riga"})
	if err != nil {
		t.Fatal(err)
	}
	if updated.DisplayName != "Alicia" || updated.Locale != "lv" || updated.CreatedAt.IsZero() || updated.UpdatedAt.IsZero() {
		t.Fatalf("updated profile = %+v", updated)
	}
}
