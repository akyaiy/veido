package v2

import (
	"github.com/akyaiy/veido/internal/common"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"errors"
	"testing"
)

func TestLifecycleFenceClearsOnCommitAndSurvivesRecovery(t *testing.T) {
	store, _ := newTestAuthorizer(t, testGroups{})
	lifecycle, err := NewLifecycle(store)
	if err != nil {
		t.Fatal(err)
	}
	target := testRef("/docs/report.md")
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "1"}
	mutation := vfs.LifecycleMutation{OperationID: "create-1", Kind: vfs.LifecycleCreate, Actor: actor, Target: target}
	op, err := lifecycle.Prepare(context.Background(), mutation)
	if err != nil {
		t.Fatal(err)
	}
	fenced, err := store.LifecycleFenced(context.Background(), testRef("/docs/report.md/part"))
	if err != nil || !fenced {
		t.Fatalf("fenced=%v err=%v", fenced, err)
	}
	if _, err := lifecycle.Prepare(context.Background(), vfs.LifecycleMutation{OperationID: "create-2", Kind: vfs.LifecycleCreate, Actor: actor, Target: testRef("/docs")}); !errors.Is(err, ErrLifecyclePending) {
		t.Fatalf("overlapping prepare error=%v", err)
	}
	if err := op.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	authorizer, err := NewAuthorizer(store, testGroups{})
	if err != nil {
		t.Fatal(err)
	}
	allowed, err := authorizer.Can(context.Background(), actor, common.ActionExec, policyRef(target))
	if err != nil || !allowed {
		t.Fatalf("owner policy capability allowed=%v err=%v", allowed, err)
	}
	fenced, err = store.LifecycleFenced(context.Background(), target)
	if err != nil || fenced {
		t.Fatalf("fenced after commit=%v err=%v", fenced, err)
	}
	recoveryTarget := testRef("/recovery")
	if _, err := lifecycle.Prepare(context.Background(), vfs.LifecycleMutation{OperationID: "create-3", Kind: vfs.LifecycleCreate, Actor: actor, Target: recoveryTarget}); err != nil {
		t.Fatal(err)
	}
	if err := lifecycle.Recover(context.Background()); err != nil {
		t.Fatal(err)
	}
	fenced, err = store.LifecycleFenced(context.Background(), recoveryTarget)
	if err != nil || !fenced {
		t.Fatalf("fenced after recovery=%v err=%v", fenced, err)
	}
}

func TestLifecycleReconcileUsesProviderMetadata(t *testing.T) {
	store, _ := newTestAuthorizer(t, testGroups{})
	lifecycle, err := NewLifecycle(store)
	if err != nil {
		t.Fatal(err)
	}
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "1"}
	createTarget := testRef("/created")
	deleteSource := testRef("/not-deleted")
	moveSource := testRef("/old")
	moveTarget := testRef("/new")
	ambiguousSource := testRef("/ambiguous-old")
	ambiguousTarget := testRef("/ambiguous-new")
	for _, mutation := range []vfs.LifecycleMutation{
		{OperationID: "create", Kind: vfs.LifecycleCreate, Actor: actor, Target: createTarget},
		{OperationID: "delete", Kind: vfs.LifecycleDelete, Actor: actor, Source: deleteSource},
		{OperationID: "move", Kind: vfs.LifecycleMove, Actor: actor, Source: moveSource, Target: moveTarget},
		{OperationID: "ambiguous", Kind: vfs.LifecycleMove, Actor: actor, Source: ambiguousSource, Target: ambiguousTarget},
	} {
		if _, err := lifecycle.Prepare(context.Background(), mutation); err != nil {
			t.Fatal(err)
		}
	}
	existing := map[string]bool{
		createTarget.Path:    true,
		deleteSource.Path:    true,
		moveTarget.Path:      true,
		ambiguousSource.Path: true,
		ambiguousTarget.Path: true,
	}
	if err := lifecycle.Reconcile(context.Background(), func(_ context.Context, ref common.ResourceRef) (bool, error) {
		return existing[ref.Path], nil
	}); err != nil {
		t.Fatal(err)
	}
	for operationID, want := range map[string]string{"create": "acl_committed", "delete": "aborted", "move": "acl_committed", "ambiguous": "recovery"} {
		var got string
		if err := store.db.QueryRow(`SELECT state FROM acl_lifecycle_operations WHERE operation_id=?`, operationID).Scan(&got); err != nil {
			t.Fatal(err)
		}
		if got != want {
			t.Errorf("%s state=%q, want %q", operationID, got, want)
		}
	}
	for _, ref := range []common.ResourceRef{createTarget, deleteSource, moveSource, moveTarget} {
		fenced, err := store.LifecycleFenced(context.Background(), ref)
		if err != nil || fenced {
			t.Errorf("%s fenced=%v err=%v", ref.Path, fenced, err)
		}
	}
	fenced, err := store.LifecycleFenced(context.Background(), ambiguousTarget)
	if err != nil || !fenced {
		t.Fatalf("ambiguous target fenced=%v err=%v", fenced, err)
	}
}

func TestLifecycleMovePreservesSubtreeAndRejectsInvalidTarget(t *testing.T) {
	store, _ := newTestAuthorizer(t, testGroups{})
	lifecycle, err := NewLifecycle(store)
	if err != nil {
		t.Fatal(err)
	}
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "1"}
	source := testRef("/docs")
	child := testRef("/docs/report.md")
	if _, err := store.CreateManagedRule(context.Background(), child, RuleInput{SubjectKey: "user:2", Action: "r", Effect: "allow", Priority: 50, CreatedByActor: actor.String(), ManagerSubjectKey: actor.String(), ManagerMode: "full", State: "active"}, false); err != nil {
		t.Fatal(err)
	}
	var sourceNode, childNode int64
	if err := store.db.QueryRow(`SELECT node_id FROM acl_path_nodes WHERE segment='docs' AND state='active'`).Scan(&sourceNode); err != nil {
		t.Fatal(err)
	}
	if err := store.db.QueryRow(`SELECT node_id FROM acl_path_nodes WHERE segment='report.md' AND state='active'`).Scan(&childNode); err != nil {
		t.Fatal(err)
	}
	op, err := lifecycle.Prepare(context.Background(), vfs.LifecycleMutation{OperationID: "move-docs", Kind: vfs.LifecycleMove, Actor: actor, Source: source, Target: testRef("/archive/docs")})
	if err != nil {
		t.Fatal(err)
	}
	if err := op.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	var movedSource, movedChild int64
	if err := store.db.QueryRow(`SELECT node_id FROM acl_path_nodes WHERE node_id=? AND state='active'`, sourceNode).Scan(&movedSource); err != nil {
		t.Fatal(err)
	}
	if err := store.db.QueryRow(`SELECT node_id FROM acl_path_nodes WHERE node_id=? AND state='active'`, childNode).Scan(&movedChild); err != nil {
		t.Fatal(err)
	}
	if movedSource != sourceNode || movedChild != childNode {
		t.Fatalf("node IDs changed: source=%d child=%d", movedSource, movedChild)
	}
	cycle, err := lifecycle.Prepare(context.Background(), vfs.LifecycleMutation{OperationID: "cycle", Kind: vfs.LifecycleMove, Actor: actor, Source: testRef("/archive"), Target: testRef("/archive/docs/again")})
	if err != nil {
		t.Fatal(err)
	}
	if err := cycle.Commit(context.Background()); !errors.Is(err, ErrLifecycleMoveCycle) {
		t.Fatalf("cycle move error=%v", err)
	}
	if err := cycle.Abort(context.Background(), ErrLifecycleMoveCycle); err != nil {
		t.Fatal(err)
	}
	conflict, err := lifecycle.Prepare(context.Background(), vfs.LifecycleMutation{OperationID: "conflict", Kind: vfs.LifecycleMove, Actor: actor, Source: testRef("/archive/docs"), Target: testRef("/archive")})
	if err != nil {
		t.Fatal(err)
	}
	if err := conflict.Commit(context.Background()); !errors.Is(err, ErrLifecycleMoveConflict) {
		t.Fatalf("conflicting move error=%v", err)
	}
}

func TestLifecycleDeleteThenRecreateDoesNotRestoreOldDataRule(t *testing.T) {
	store, _ := newTestAuthorizer(t, testGroups{})
	lifecycle, err := NewLifecycle(store)
	if err != nil {
		t.Fatal(err)
	}
	owner := vfs.Actor{Kind: vfs.ActorUser, ID: "1"}
	other := vfs.Actor{Kind: vfs.ActorUser, ID: "2"}
	target := testRef("/report.md")
	if _, err := store.CreateManagedRule(context.Background(), target, RuleInput{SubjectKey: other.String(), Action: "r", Effect: "allow", Priority: 50, CreatedByActor: owner.String(), ManagerSubjectKey: owner.String(), ManagerMode: "full", State: "active"}, false); err != nil {
		t.Fatal(err)
	}
	deleteOp, err := lifecycle.Prepare(context.Background(), vfs.LifecycleMutation{OperationID: "delete-report", Kind: vfs.LifecycleDelete, Actor: owner, Source: target})
	if err != nil {
		t.Fatal(err)
	}
	if err := deleteOp.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	recreateOp, err := lifecycle.Prepare(context.Background(), vfs.LifecycleMutation{OperationID: "recreate-report", Kind: vfs.LifecycleCreate, Actor: owner, Target: target})
	if err != nil {
		t.Fatal(err)
	}
	if err := recreateOp.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	authorizer, err := NewAuthorizer(store, testGroups{})
	if err != nil {
		t.Fatal(err)
	}
	allowed, err := authorizer.Can(context.Background(), other, common.ActionRead, target)
	if err != nil || allowed {
		t.Fatalf("recreated target restored user rule: allowed=%v err=%v", allowed, err)
	}
	ownerAllowed, err := authorizer.Can(context.Background(), owner, common.ActionExec, policyRef(target))
	if err != nil || !ownerAllowed {
		t.Fatalf("owner policy capability allowed=%v err=%v", ownerAllowed, err)
	}
	otherAllowed, err := authorizer.Can(context.Background(), other, common.ActionExec, policyRef(target))
	if err != nil || otherAllowed {
		t.Fatalf("unrelated actor policy capability allowed=%v err=%v", otherAllowed, err)
	}
}
