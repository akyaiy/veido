package shared

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestSQLiteStoreScopesAndFiltersActiveLinks(t *testing.T) {
	db := openStoreTestDB(t)
	ctx := context.Background()

	store, err := NewSQLiteStore(db)
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	seed := []Link{
		{
			RecipientUserID: 2,
			RecipientName:   "bob",
			GrantedByUserID: 1,
			GrantedByName:   "alice",
			TargetURI:       mustURI(t, "local@default[alice]:///projects/demo"),
			Alias:           "demo",
			AccessMode:      AccessViewer,
			Status:          StatusActive,
		},
		{
			RecipientUserID: 3,
			RecipientName:   "carol",
			GrantedByUserID: 1,
			GrantedByName:   "alice",
			TargetURI:       mustURI(t, "local@default[alice]:///projects/secret"),
			Alias:           "secret",
			AccessMode:      AccessViewer,
			Status:          StatusActive,
		},
		{
			RecipientUserID: 2,
			RecipientName:   "bob",
			GrantedByUserID: 3,
			GrantedByName:   "carol",
			TargetURI:       mustURI(t, "local@default[carol]:///draft"),
			Alias:           "draft",
			AccessMode:      AccessEditor,
			Status:          StatusPending,
		},
	}
	for _, link := range seed {
		if err := store.Create(ctx, link); err != nil {
			t.Fatalf("Create(%s): %v", link.Alias, err)
		}
	}
	incoming, err := store.ListIncomingActive(ctx, 2)
	if err != nil {
		t.Fatalf("ListIncomingActive: %v", err)
	}
	if len(incoming) != 1 || incoming[0].Alias != "demo" || incoming[0].GrantedByName != "alice" {
		t.Fatalf("incoming = %#v", incoming)
	}
	t.Logf("Bob active incoming links: %s/%s -> %s", incoming[0].GrantedByName, incoming[0].Alias, incoming[0].TargetURI)
	outgoing, err := store.ListOutgoingActive(ctx, 1)
	if err != nil {
		t.Fatalf("ListOutgoingActive: %v", err)
	}
	if len(outgoing) != 2 || outgoing[0].RecipientName != "bob" || outgoing[1].RecipientName != "carol" {
		t.Fatalf("outgoing = %#v", outgoing)
	}
	t.Logf("Alice active outgoing recipients: %s, %s", outgoing[0].RecipientName, outgoing[1].RecipientName)
	if _, err := store.FindIncomingActive(ctx, 2, "carol", "draft"); !errors.Is(err, ErrLinkNotFound) {
		t.Fatalf("pending link error = %v, want ErrLinkNotFound", err)
	} else {
		t.Logf("Pending link is not visible in incoming: %v", err)
	}
}

func TestSQLiteStoreOwnsLinkLifecycleWithoutGrantingAccess(t *testing.T) {
	db := openStoreTestDB(t)
	store, err := NewSQLiteStore(db)
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	ctx := context.Background()
	target := mustURI(t, "local@default[alice]:///projects/demo")
	link := Link{
		RecipientUserID: 2,
		RecipientName:   "bob",
		GrantedByUserID: 1,
		GrantedByName:   "alice",
		TargetURI:       target,
		Alias:           "demo",
		AccessMode:      AccessViewer,
		Status:          StatusPending,
	}
	if err := store.Create(ctx, link); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, err := store.FindIncomingActive(ctx, 2, "alice", "demo"); !errors.Is(err, ErrLinkNotFound) {
		t.Fatalf("pending link error = %v, want ErrLinkNotFound", err)
	}

	link.Status = StatusActive
	if err := store.Update(ctx, link); err != nil {
		t.Fatalf("Update: %v", err)
	}
	got, err := store.FindIncomingActive(ctx, 2, "alice", "demo")
	if err != nil {
		t.Fatalf("FindIncomingActive: %v", err)
	}
	if got.TargetURI != target || got.AccessMode != AccessViewer {
		t.Fatalf("active link = %#v", got)
	}

	if err := store.Delete(ctx, 2, target); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := store.FindIncomingActive(ctx, 2, "alice", "demo"); !errors.Is(err, ErrLinkNotFound) {
		t.Fatalf("deleted link error = %v, want ErrLinkNotFound", err)
	}
}

func TestSQLiteStoreRejectsSharedTargets(t *testing.T) {
	store, err := NewSQLiteStore(openStoreTestDB(t))
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	err = store.Create(context.Background(), Link{
		RecipientUserID: 2,
		RecipientName:   "bob",
		GrantedByUserID: 1,
		GrantedByName:   "alice",
		TargetURI:       mustURI(t, "shared@me[alice]:///incoming/bob/demo"),
		Alias:           "demo",
		AccessMode:      AccessViewer,
		Status:          StatusPending,
	})
	if err == nil {
		t.Fatal("Create accepted a shared target")
	}
}

func TestInitDBMigratesLegacyLinksWithoutReadingUsers(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.Exec(`
		CREATE TABLE vfs_shared_links (
			recipient_user_id INTEGER NOT NULL,
			granted_by_user_id INTEGER NOT NULL,
			target_uri TEXT NOT NULL,
			alias TEXT NOT NULL,
			access_mode TEXT NOT NULL,
			status TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (recipient_user_id, target_uri),
			UNIQUE (recipient_user_id, alias),
			FOREIGN KEY (recipient_user_id) REFERENCES users(id),
			FOREIGN KEY (granted_by_user_id) REFERENCES users(id)
		);
		INSERT INTO vfs_shared_links (
			recipient_user_id, granted_by_user_id, target_uri, alias, access_mode, status
		) VALUES (2, 1, 'local@default[alice]:///demo', 'demo', 'viewer', 'active');
	`); err != nil {
		t.Fatalf("create legacy schema: %v", err)
	}

	if err := InitDB(db); err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	store, err := NewSQLiteStore(db)
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	links, err := store.ListIncomingActive(context.Background(), 2)
	if err != nil {
		t.Fatalf("ListIncomingActive: %v", err)
	}
	if len(links) != 1 || links[0].RecipientName != "user-2" || links[0].GrantedByName != "user-1" {
		t.Fatalf("migrated links = %#v", links)
	}

	var foreignKeyCount int
	rows, err := db.Query(`PRAGMA foreign_key_list(vfs_shared_links)`)
	if err != nil {
		t.Fatalf("foreign_key_list: %v", err)
	}
	for rows.Next() {
		foreignKeyCount++
	}
	if err := rows.Close(); err != nil {
		t.Fatalf("close foreign_key_list: %v", err)
	}
	if foreignKeyCount != 0 {
		t.Fatalf("foreign key count = %d, want 0", foreignKeyCount)
	}
}

func openStoreTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	if err := InitDB(db); err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	return db
}
