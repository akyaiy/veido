package auth

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/akyaiy/veido/internal/database/migrate"

	_ "github.com/mattn/go-sqlite3"
)

func TestGroupNamesUsesAuthOwnedMembership(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate.Run(context.Background(), db, MigrationGroup()); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO users(id, username, password_hash, status) VALUES (7, 'alice', 'hash', 'active');
		INSERT INTO auth_groups(group_id, name) VALUES (1, 'editors'), (2, 'reviewers');
		INSERT INTO auth_group_memberships(user_id, group_id) VALUES (7, 2), (7, 1)`); err != nil {
		t.Fatal(err)
	}
	authn, err := NewAuth(db, Config{Secret: make([]byte, 32), Issuer: "test", Audience: "test", AccessTTL: time.Minute, RefreshTTL: time.Hour})
	if err != nil {
		t.Fatal(err)
	}
	groups, err := authn.GroupNames(context.Background(), 7)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 2 || groups[0] != "editors" || groups[1] != "reviewers" {
		t.Fatalf("GroupNames() = %#v", groups)
	}
}
