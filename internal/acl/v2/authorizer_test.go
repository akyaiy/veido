package v2

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/akyaiy/veido/internal/common"
	"github.com/akyaiy/veido/internal/database/migrate"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"

	_ "github.com/mattn/go-sqlite3"
)

type testGroups struct {
	groups map[int64][]string
	err    error
}

func (g testGroups) GroupNames(_ context.Context, userID int64) ([]string, error) {
	if g.err != nil {
		return nil, g.err
	}
	return g.groups[userID], nil
}

func newTestAuthorizer(t *testing.T, groups testGroups) (*Store, *ACLAuthorizer) {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	if err := migrate.Run(context.Background(), db, MigrationGroup()); err != nil {
		t.Fatal(err)
	}
	store, err := NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	authorizer, err := NewAuthorizer(store, groups)
	if err != nil {
		t.Fatal(err)
	}
	return store, authorizer
}

func testRef(path string) common.ResourceRef {
	return common.ResourceRef{ProviderKey: "local", ConnectionKey: "default", ScopeKey: "alice", Path: path}
}

func grant(t *testing.T, store *Store, ref common.ResourceRef, subject string, action common.Action, effect Effect, priority int, recursive bool) {
	t.Helper()
	_, err := store.UpsertRule(context.Background(), ref, RuleInput{
		SubjectKey: subject, Action: action, Effect: effect, Priority: priority, Recursive: recursive,
		CreatedByActor: "user:1", ManagerSubjectKey: "user:1", ManagerMode: "full", State: "active",
	})
	if err != nil {
		t.Fatalf("UpsertRule() error = %v", err)
	}
}

func TestSubjectsGuestUserAndGroups(t *testing.T) {
	store, authorizer := newTestAuthorizer(t, testGroups{groups: map[int64][]string{42: {"editors"}}})
	ref := testRef("/doc")
	grant(t, store, ref, "guest", common.ActionRead, EffectAllow, 50, false)
	grant(t, store, ref, "group:editors", common.ActionWrite, EffectAllow, 50, false)
	grant(t, store, ref, "all", common.ActionExec, EffectAllow, 50, false)

	allowed, err := authorizer.Can(context.Background(), vfs.Actor{Kind: vfs.ActorGuest}, common.ActionRead, ref)
	if err != nil || !allowed {
		t.Fatalf("guest read = %v, %v; want true, nil", allowed, err)
	}
	allowed, err = authorizer.Can(context.Background(), vfs.Actor{Kind: vfs.ActorGuest}, common.ActionWrite, ref)
	if err != nil || allowed {
		t.Fatalf("guest write = %v, %v; want false, nil", allowed, err)
	}
	allowed, err = authorizer.Can(context.Background(), vfs.Actor{Kind: vfs.ActorUser, ID: "42"}, common.ActionWrite, ref)
	if err != nil || !allowed {
		t.Fatalf("group user write = %v, %v; want true, nil", allowed, err)
	}
	allowed, err = authorizer.Can(context.Background(), vfs.Actor{Kind: vfs.ActorUser, ID: "42"}, common.ActionExec, ref)
	if err != nil || !allowed {
		t.Fatalf("user all exec = %v, %v; want true, nil", allowed, err)
	}
}

func TestRecursiveAndDirectRuleApplicability(t *testing.T) {
	store, authorizer := newTestAuthorizer(t, testGroups{})
	grant(t, store, testRef("/docs"), "user:7", common.ActionRead, EffectAllow, 50, true)
	grant(t, store, testRef("/plain"), "user:7", common.ActionRead, EffectAllow, 50, false)
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "7"}

	allowed, err := authorizer.Can(context.Background(), actor, common.ActionRead, testRef("/docs/a.txt"))
	if err != nil || !allowed {
		t.Fatalf("recursive child = %v, %v; want true, nil", allowed, err)
	}
	allowed, err = authorizer.Can(context.Background(), actor, common.ActionRead, testRef("/plain/a.txt"))
	if err != nil || allowed {
		t.Fatalf("non-recursive child = %v, %v; want false, nil", allowed, err)
	}
}

func TestPriorityBeatsDepthAndEqualPriorityDenyWins(t *testing.T) {
	store, authorizer := newTestAuthorizer(t, testGroups{groups: map[int64][]string{9: {"staff"}}})
	ref := testRef("/docs/report")
	grant(t, store, testRef("/docs"), "group:staff", common.ActionRead, EffectDeny, 80, true)
	grant(t, store, ref, "user:9", common.ActionRead, EffectAllow, 60, false)
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "9"}

	allowed, err := authorizer.Can(context.Background(), actor, common.ActionRead, ref)
	if err != nil || allowed {
		t.Fatalf("higher-priority ancestor deny = %v, %v; want false, nil", allowed, err)
	}
	grant(t, store, ref, "user:9", common.ActionRead, EffectAllow, 80, false)
	allowed, err = authorizer.Can(context.Background(), actor, common.ActionRead, ref)
	if err != nil || allowed {
		t.Fatalf("equal-priority deny = %v, %v; want false, nil", allowed, err)
	}
}

func TestFailClosedOnGroupLookupAndMissingRule(t *testing.T) {
	_, authorizer := newTestAuthorizer(t, testGroups{err: errors.New("membership unavailable")})
	ref := testRef("/doc")
	allowed, err := authorizer.Can(context.Background(), vfs.Actor{Kind: vfs.ActorUser, ID: "3"}, common.ActionRead, ref)
	if err == nil || allowed {
		t.Fatalf("failed membership lookup = %v, %v; want false, error", allowed, err)
	}

	_, authorizer = newTestAuthorizer(t, testGroups{})
	allowed, err = authorizer.Can(context.Background(), vfs.Actor{Kind: vfs.ActorUser, ID: "3"}, common.ActionRead, ref)
	if err != nil || allowed {
		t.Fatalf("missing rule = %v, %v; want false, nil", allowed, err)
	}
}

func TestMigrationCreatesOnlyACLv2Tables(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err := migrate.Run(context.Background(), db, MigrationGroup()); err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"acl_namespace_roots", "acl_path_nodes", "acl_rules", "acl_lifecycle_operations"} {
		var exists bool
		if err := db.QueryRow(`SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?)`, table).Scan(&exists); err != nil || !exists {
			t.Fatalf("table %s exists=%v err=%v", table, exists, err)
		}
	}
}
