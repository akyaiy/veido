package v2

import (
	"github.com/akyaiy/veido/internal/common"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"path"
	"strings"
)

var (
	ErrLifecyclePending      = errors.New("aclv2: lifecycle operation is pending")
	ErrLifecycleMoveConflict = errors.New("aclv2: lifecycle move target already exists")
	ErrLifecycleMoveCycle    = errors.New("aclv2: lifecycle move would create a cycle")
)

// Lifecycle persists a fence before a provider mutation. It intentionally owns
// only ACL state; VFS Core remains responsible for calling the provider.
type Lifecycle struct{ store *Store }

func NewLifecycle(store *Store) (*Lifecycle, error) {
	if store == nil || store.db == nil {
		return nil, errors.New("aclv2: lifecycle store is unavailable")
	}
	return &Lifecycle{store: store}, nil
}

func (l *Lifecycle) Prepare(ctx context.Context, mutation vfs.LifecycleMutation) (vfs.LifecycleOperation, error) {
	refs, rootRef, err := lifecycleRefs(mutation)
	if err != nil {
		return nil, err
	}
	if err := l.store.prepareLifecycle(ctx, mutation, rootRef, refs); err != nil {
		return nil, err
	}
	return lifecycleOperation{lifecycle: l, mutation: mutation}, nil
}

// Recover makes all unresolved prepared intents fail closed after a restart.
func (l *Lifecycle) Recover(ctx context.Context) error {
	_, err := l.store.db.ExecContext(ctx, `UPDATE acl_lifecycle_operations SET state='recovery', updated_at=CURRENT_TIMESTAMP WHERE state='prepared'`)
	return err
}

// Reconcile resolves local VFS operations by observing their source and target
// through safe provider metadata reads. An observation error, or an ambiguous
// shape, deliberately leaves the operation fenced in recovery.
func (l *Lifecycle) Reconcile(ctx context.Context, exists func(context.Context, common.ResourceRef) (bool, error)) error {
	if exists == nil {
		return errors.New("aclv2: lifecycle metadata probe is unavailable")
	}
	if err := l.Recover(ctx); err != nil {
		return err
	}
	rows, err := l.store.db.QueryContext(ctx, `SELECT operation_id, kind, actor_key, COALESCE(source_uri, ''), COALESCE(target_uri, '') FROM acl_lifecycle_operations WHERE state='recovery' ORDER BY root_id, sequence`)
	if err != nil {
		return err
	}
	var mutations []vfs.LifecycleMutation
	for rows.Next() {
		var operationID, kind, actorKey, sourceURI, targetURI string
		if err := rows.Scan(&operationID, &kind, &actorKey, &sourceURI, &targetURI); err != nil {
			rows.Close()
			return err
		}
		mutation, err := recoveredMutation(operationID, vfs.LifecycleKind(kind), actorKey, sourceURI, targetURI)
		if err != nil {
			rows.Close()
			return err
		}
		mutations = append(mutations, mutation)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, mutation := range mutations {
		applied, aborted, err := reconcileObservation(ctx, mutation, exists)
		if err != nil {
			continue // keep the fence: backend state is not known safely
		}
		if applied {
			if err := l.store.commitLifecycle(ctx, mutation); err != nil {
				return err
			}
		}
		if aborted {
			if err := l.store.finishLifecycle(ctx, mutation.OperationID, "aborted", true); err != nil {
				return err
			}
		}
	}
	return nil
}

func recoveredMutation(operationID string, kind vfs.LifecycleKind, actorKey, sourceURI, targetURI string) (vfs.LifecycleMutation, error) {
	actor, err := parseLifecycleActor(actorKey)
	if err != nil {
		return vfs.LifecycleMutation{}, err
	}
	mutation := vfs.LifecycleMutation{OperationID: operationID, Kind: kind, Actor: actor}
	if sourceURI != "" {
		if mutation.Source, err = refFromURI(sourceURI); err != nil {
			return vfs.LifecycleMutation{}, err
		}
	}
	if targetURI != "" {
		if mutation.Target, err = refFromURI(targetURI); err != nil {
			return vfs.LifecycleMutation{}, err
		}
	}
	return mutation, nil
}

func parseLifecycleActor(key string) (vfs.Actor, error) {
	parts := strings.SplitN(key, ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return vfs.Actor{}, fmt.Errorf("aclv2: invalid lifecycle actor %q", key)
	}
	return vfs.Actor{Kind: vfs.ActorKind(parts[0]), ID: parts[1]}, nil
}

func reconcileObservation(ctx context.Context, mutation vfs.LifecycleMutation, exists func(context.Context, common.ResourceRef) (bool, error)) (applied, aborted bool, err error) {
	sourceExists, targetExists := false, false
	if !emptyRef(mutation.Source) {
		if sourceExists, err = exists(ctx, mutation.Source); err != nil {
			return false, false, err
		}
	}
	if !emptyRef(mutation.Target) {
		if targetExists, err = exists(ctx, mutation.Target); err != nil {
			return false, false, err
		}
	}
	switch mutation.Kind {
	case vfs.LifecycleCreate:
		return targetExists, !targetExists, nil
	case vfs.LifecycleDelete:
		return !sourceExists, sourceExists, nil
	case vfs.LifecycleMove:
		return !sourceExists && targetExists, sourceExists && !targetExists, nil
	default:
		return false, false, fmt.Errorf("aclv2: unknown lifecycle mutation %q", mutation.Kind)
	}
}

type lifecycleOperation struct {
	lifecycle *Lifecycle
	mutation  vfs.LifecycleMutation
}

func (o lifecycleOperation) Commit(ctx context.Context) error {
	return o.lifecycle.store.commitLifecycle(ctx, o.mutation)
}
func (o lifecycleOperation) Abort(ctx context.Context, _ error) error {
	return o.lifecycle.store.finishLifecycle(ctx, o.mutation.OperationID, "aborted", true)
}
func (o lifecycleOperation) Recover(ctx context.Context, _ error) error {
	return o.lifecycle.store.finishLifecycle(ctx, o.mutation.OperationID, "recovery", false)
}

func (s *Store) prepareLifecycle(ctx context.Context, mutation vfs.LifecycleMutation, rootRef common.ResourceRef, refs []common.ResourceRef) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, ref := range refs {
		fenced, err := lifecycleFencedTx(ctx, tx, ref)
		if err != nil {
			return err
		}
		if fenced {
			return ErrLifecyclePending
		}
	}
	rootID, err := ensureRoot(ctx, tx, rootRef)
	if err != nil {
		return err
	}
	sourceURI, targetURI, err := lifecycleURIs(mutation)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO acl_lifecycle_operations(operation_id, root_id, sequence, kind, state, actor_key, source_uri, target_uri)
		SELECT ?, ?, COALESCE(MAX(sequence), 0) + 1, ?, 'prepared', ?, ?, ? FROM acl_lifecycle_operations WHERE root_id=?`,
		mutation.OperationID, rootID, mutation.Kind, mutation.Actor.String(), sourceURI, targetURI, rootID)
	if err != nil {
		return err
	}
	for _, ref := range refs {
		uri, err := resourceURI(ref)
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO acl_lifecycle_fences(operation_id, resource_uri) VALUES (?, ?)`, mutation.OperationID, uri); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) finishLifecycle(ctx context.Context, operationID, state string, clearFence bool) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `UPDATE acl_lifecycle_operations SET state=?, updated_at=CURRENT_TIMESTAMP WHERE operation_id=?`, state, operationID); err != nil {
		return err
	}
	if clearFence {
		if _, err = tx.ExecContext(ctx, `DELETE FROM acl_lifecycle_fences WHERE operation_id=?`, operationID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) commitLifecycle(ctx context.Context, mutation vfs.LifecycleMutation) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var state string
	if err = tx.QueryRowContext(ctx, `SELECT state FROM acl_lifecycle_operations WHERE operation_id=?`, mutation.OperationID).Scan(&state); err != nil {
		return err
	}
	if state == "acl_committed" {
		return nil
	}
	if state != "prepared" && state != "provider_committed" && state != "recovery" {
		return fmt.Errorf("aclv2: lifecycle operation %s is %s", mutation.OperationID, state)
	}
	switch mutation.Kind {
	case vfs.LifecycleCreate:
		err = grantPolicyCapability(ctx, tx, mutation.Actor, mutation.Target)
	case vfs.LifecycleDelete:
		err = tombstoneRef(ctx, tx, mutation.Source)
		if err == nil {
			err = tombstoneRef(ctx, tx, policyRef(mutation.Source))
		}
	case vfs.LifecycleMove:
		err = moveRef(ctx, tx, mutation.Source, mutation.Target)
		if err == nil {
			err = moveRef(ctx, tx, policyRef(mutation.Source), policyRef(mutation.Target))
		}
	default:
		err = errors.New("aclv2: unknown lifecycle mutation")
	}
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE acl_lifecycle_operations SET state='acl_committed', updated_at=CURRENT_TIMESTAMP WHERE operation_id=?`, mutation.OperationID); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM acl_lifecycle_fences WHERE operation_id=?`, mutation.OperationID); err != nil {
		return err
	}
	return tx.Commit()
}

func policyRef(target common.ResourceRef) common.ResourceRef {
	uri, _ := resourceURI(target)
	return common.ResourceRef{ProviderKey: "acl", ConnectionKey: "acl", ScopeKey: "system", Path: "/policies/" + base64.RawURLEncoding.EncodeToString([]byte(uri))}
}

func grantPolicyCapability(ctx context.Context, tx *sql.Tx, actor vfs.Actor, target common.ResourceRef) error {
	ref := policyRef(target)
	segments, err := validateRef(ref)
	if err != nil {
		return err
	}
	rootID, err := ensureRoot(ctx, tx, ref)
	if err != nil {
		return err
	}
	nodeID, err := ensurePath(ctx, tx, rootID, segments)
	if err != nil {
		return err
	}
	for _, action := range []common.Action{common.ActionRead, common.ActionExec} {
		_, err = tx.ExecContext(ctx, `INSERT INTO acl_rules(node_id, subject_key, action, effect, priority, recursive, created_by_actor, manager_subject_key, manager_mode, state, protected)
			VALUES (?, ?, ?, 'allow', 100, 0, 'service:lifecycle', 'service:lifecycle', 'full', 'active', 1)
			ON CONFLICT(node_id, subject_key, action) DO UPDATE SET effect='allow', priority=100, recursive=0, protected=1, rule_revision=acl_rules.rule_revision+1, updated_at=CURRENT_TIMESTAMP`, nodeID, actor.String(), action)
		if err != nil {
			return err
		}
	}
	return nil
}

func tombstoneRef(ctx context.Context, tx *sql.Tx, ref common.ResourceRef) error {
	nodeID, err := findNode(ctx, tx, ref)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `WITH RECURSIVE subtree(node_id) AS (
		SELECT ? UNION ALL SELECT n.node_id FROM acl_path_nodes n JOIN subtree s ON n.parent_id=s.node_id WHERE n.state='active'
	) UPDATE acl_path_nodes SET state='deleted', deleted_operation_id='lifecycle', updated_at=CURRENT_TIMESTAMP WHERE node_id IN subtree`, nodeID)
	return err
}

func moveRef(ctx context.Context, tx *sql.Tx, source, target common.ResourceRef) error {
	if source.Path == target.Path {
		return nil
	}
	nodeID, err := findNode(ctx, tx, source)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	rootID, err := rootForRef(ctx, tx, source)
	if err != nil {
		return err
	}
	targetRoot, err := rootForRef(ctx, tx, target)
	if err != nil {
		return err
	}
	if rootID != targetRoot {
		return errors.New("aclv2: cross-root lifecycle move")
	}
	if pathContains(source.Path, path.Dir(target.Path)) {
		return ErrLifecycleMoveCycle
	}
	targetNodeID, err := findNode(ctx, tx, target)
	if err == nil && targetNodeID != nodeID {
		return ErrLifecycleMoveConflict
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	parentID, err := ensureParent(ctx, tx, rootID, target.Path)
	if err != nil {
		return err
	}
	name := path.Base(target.Path)
	_, err = tx.ExecContext(ctx, `UPDATE acl_path_nodes SET parent_id=?, segment=?, segment_key=?, node_revision=node_revision+1, updated_at=CURRENT_TIMESTAMP WHERE node_id=?`, parentID, name, name, nodeID)
	return err
}

func rootForRef(ctx context.Context, tx *sql.Tx, ref common.ResourceRef) (int64, error) {
	return ensureRoot(ctx, tx, ref)
}

func ensureParent(ctx context.Context, tx *sql.Tx, rootID int64, childPath string) (*int64, error) {
	parentPath := path.Dir(childPath)
	if parentPath == "/" {
		return nil, nil
	}
	segments := strings.Split(strings.TrimPrefix(parentPath, "/"), "/")
	id, err := ensurePath(ctx, tx, rootID, segments)
	return &id, err
}

func findNode(ctx context.Context, tx *sql.Tx, ref common.ResourceRef) (int64, error) {
	segments, err := validateRef(ref)
	if err != nil {
		return 0, err
	}
	rootID, err := rootForRef(ctx, tx, ref)
	if err != nil {
		return 0, err
	}
	var parent *int64
	for _, segment := range segments {
		var id int64
		if parent == nil {
			err = tx.QueryRowContext(ctx, `SELECT node_id FROM acl_path_nodes WHERE root_id=? AND parent_id IS NULL AND segment_key=? AND state='active'`, rootID, segment).Scan(&id)
		} else {
			err = tx.QueryRowContext(ctx, `SELECT node_id FROM acl_path_nodes WHERE root_id=? AND parent_id=? AND segment_key=? AND state='active'`, rootID, *parent, segment).Scan(&id)
		}
		if err != nil {
			return 0, err
		}
		parent = &id
	}
	return *parent, nil
}

func (s *Store) LifecycleFenced(ctx context.Context, ref common.ResourceRef) (bool, error) {
	if _, err := validateRef(ref); err != nil {
		return false, err
	}
	return lifecycleFencedTx(ctx, s.db, ref)
}

type lifecycleQueryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func lifecycleFencedTx(ctx context.Context, db lifecycleQueryer, ref common.ResourceRef) (bool, error) {
	rows, err := db.QueryContext(ctx, `SELECT resource_uri FROM acl_lifecycle_fences`)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var uri string
		if err := rows.Scan(&uri); err != nil {
			return false, err
		}
		other, err := refFromURI(uri)
		if err != nil {
			return false, err
		}
		if sameRoot(ref, other) && (pathContains(ref.Path, other.Path) || pathContains(other.Path, ref.Path)) {
			return true, nil
		}
	}
	return false, rows.Err()
}

func lifecycleRefs(m vfs.LifecycleMutation) ([]common.ResourceRef, common.ResourceRef, error) {
	if m.OperationID == "" || m.Actor.String() == "" {
		return nil, common.ResourceRef{}, errors.New("aclv2: invalid lifecycle mutation")
	}
	source, target := m.Source, m.Target
	switch m.Kind {
	case vfs.LifecycleCreate:
		if _, err := validateRef(target); err != nil || !emptyRef(source) {
			return nil, common.ResourceRef{}, errors.New("aclv2: invalid create lifecycle mutation")
		}
		return []common.ResourceRef{target}, target, nil
	case vfs.LifecycleDelete:
		if _, err := validateRef(source); err != nil || !emptyRef(target) {
			return nil, common.ResourceRef{}, errors.New("aclv2: invalid delete lifecycle mutation")
		}
		return []common.ResourceRef{source}, source, nil
	case vfs.LifecycleMove:
		if _, err := validateRef(source); err != nil {
			return nil, common.ResourceRef{}, err
		}
		if _, err := validateRef(target); err != nil || !sameRoot(source, target) {
			return nil, common.ResourceRef{}, errors.New("aclv2: invalid move lifecycle mutation")
		}
		return []common.ResourceRef{source, target}, source, nil
	default:
		return nil, common.ResourceRef{}, errors.New("aclv2: unknown lifecycle mutation")
	}
}

func lifecycleURIs(m vfs.LifecycleMutation) (string, string, error) {
	var source, target string
	var err error
	if !emptyRef(m.Source) {
		if source, err = resourceURI(m.Source); err != nil {
			return "", "", err
		}
	}
	if !emptyRef(m.Target) {
		if target, err = resourceURI(m.Target); err != nil {
			return "", "", err
		}
	}
	return source, target, nil
}

func resourceURI(ref common.ResourceRef) (string, error) {
	uri, err := (common.ResourceAddress{ProviderKey: ref.ProviderKey, ConnectionKey: ref.ConnectionKey, ScopeKey: ref.ScopeKey, Path: ref.Path}).URI()
	return string(uri), err
}

func refFromURI(uri string) (common.ResourceRef, error) {
	parsed, err := common.CastURI(uri)
	if err != nil {
		return common.ResourceRef{}, err
	}
	ref := common.ParseResourceRef(parsed)
	if ref == nil {
		return common.ResourceRef{}, fmt.Errorf("aclv2: invalid fenced URI")
	}
	payload := ref.Payload()
	return common.ResourceRef{ProviderKey: payload.ProviderKey, ConnectionKey: payload.ConnectionKey, ScopeKey: payload.ScopeKey, Path: payload.Path}, nil
}

func emptyRef(ref common.ResourceRef) bool {
	return ref.ProviderKey == "" && ref.ConnectionKey == "" && ref.ScopeKey == "" && ref.Path == ""
}
func sameRoot(a, b common.ResourceRef) bool {
	return a.ProviderKey == b.ProviderKey && a.ConnectionKey == b.ConnectionKey && a.ScopeKey == b.ScopeKey
}
func pathContains(parent, child string) bool {
	return parent == child || strings.HasPrefix(child, parent+"/")
}

var _ vfs.ResourceLifecycleSink = (*Lifecycle)(nil)
