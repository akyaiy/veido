package acl

import (
	aclv2 "github.com/akyaiy/veido/internal/acl/v2"
	"github.com/akyaiy/veido/internal/common"
	"github.com/akyaiy/veido/internal/database/migrate"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

type groups map[int64][]string

func (g groups) GroupNames(_ context.Context, id int64) ([]string, error) { return g[id], nil }

func newService(t *testing.T) (*RuleService, *aclv2.Store) {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	if err := migrate.Run(context.Background(), db, aclv2.MigrationGroup()); err != nil {
		t.Fatal(err)
	}
	store, err := aclv2.NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	authz, err := aclv2.NewAuthorizer(store, groups{})
	if err != nil {
		t.Fatal(err)
	}
	svc, err := NewRuleService(store, authz)
	if err != nil {
		t.Fatal(err)
	}
	admin := vfs.Actor{Kind: vfs.ActorUser, ID: "1"}
	policyRoot := common.ResourceRef{ProviderKey: "acl", ConnectionKey: "acl", ScopeKey: "system", Path: "/policies"}
	for _, grant := range []struct {
		ref       common.ResourceRef
		action    common.Action
		recursive bool
	}{
		{controlPlaneRef(), common.ActionExec, false}, {policyRoot, common.ActionRead, true}, {policyRoot, common.ActionExec, true},
	} {
		_, err := store.CreateManagedRule(context.Background(), grant.ref, aclv2.RuleInput{SubjectKey: admin.String(), Action: grant.action, Effect: aclv2.EffectAllow, Priority: 100, Recursive: grant.recursive, CreatedByActor: "bootstrap", ManagerSubjectKey: "service:bootstrap", ManagerMode: "full", State: "active"}, true)
		if err != nil {
			t.Fatal(err)
		}
	}
	return svc, store
}

func TestRuleServiceManagerAndProtectedRules(t *testing.T) {
	svc, store := newService(t)
	ctx := context.Background()
	admin := vfs.Actor{Kind: vfs.ActorUser, ID: "1"}
	target := common.ResourceRef{ProviderKey: "local", ConnectionKey: "default", ScopeKey: "alice", Path: "/doc"}
	rule, err := svc.Create(ctx, admin, target, aclv2.RuleInput{SubjectKey: "user:2", Action: common.ActionRead, Effect: aclv2.EffectAllow, Priority: 50})
	if err != nil {
		t.Fatal(err)
	}
	if rule.ManagerSubjectKey != "user:1" || rule.Protected {
		t.Fatalf("created rule=%+v", rule)
	}
	updated, err := svc.Update(ctx, admin, rule.ID, aclv2.UpdateRuleInput{Effect: aclv2.EffectDeny, Priority: 40})
	if err != nil || updated.Effect != aclv2.EffectDeny {
		t.Fatalf("Update=%+v err=%v", updated, err)
	}
	if _, err := svc.SetManager(ctx, admin, rule.ID, "user:2", "narrow_only", "active"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Update(ctx, vfs.Actor{Kind: vfs.ActorUser, ID: "2"}, rule.ID, aclv2.UpdateRuleInput{Effect: aclv2.EffectAllow, Priority: 90, Recursive: true}); !errors.Is(err, vfs.ErrPermissionDenied) {
		t.Fatalf("narrow update=%v", err)
	}
	protected, err := store.CreateManagedRule(ctx, target, aclv2.RuleInput{SubjectKey: "user:3", Action: common.ActionRead, Effect: aclv2.EffectAllow, Priority: 80, CreatedByActor: "bootstrap", ManagerSubjectKey: "service:bootstrap", ManagerMode: "full", State: "active"}, true)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.DeleteManagedRule(ctx, protected.ID); !errors.Is(err, aclv2.ErrProtected) {
		t.Fatalf("protected delete=%v", err)
	}
}

func TestProviderControlDecodesPublicRuleJSON(t *testing.T) {
	svc, _ := newService(t)
	provider := &Provider{service: svc}
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "1"}
	ctx := vfs.ContextWithRequestContext(context.Background(), vfs.RequestContext{ActorKey: actor})
	target := common.ResourceRef{ProviderKey: "local", ConnectionKey: "default", ScopeKey: "alice", Path: "/doc"}
	policy := PolicyRef(target)
	_, err := provider.Control(ctx, policy.Path, "create", []byte(`{"subject_key":"user:2","action":"r","effect":"allow","priority":50,"recursive":false}`))
	if err != nil {
		t.Fatalf("Control(create) error = %v", err)
	}
	rules, err := svc.List(ctx, actor, target)
	if err != nil || len(rules) != 1 {
		t.Fatalf("List() rules=%v err=%v", rules, err)
	}
	if rules[0].Subject != "user:2" {
		encoded, _ := json.Marshal(rules[0])
		t.Fatalf("subject = %q, rule=%s", rules[0].Subject, encoded)
	}
}
