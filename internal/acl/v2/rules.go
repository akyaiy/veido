package v2

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"MyServer/internal/common"
)

var (
	ErrRuleNotFound = errors.New("aclv2: rule not found")
	ErrProtected    = errors.New("aclv2: protected rule")
	ErrConflict     = errors.New("aclv2: rule conflict")
)

type ManagedRule struct {
	Rule
	Target            common.ResourceRef
	CreatedByActor    string
	ManagerSubjectKey string
	ManagerMode       string
	State             string
	Protected         bool
}

type UpdateRuleInput struct {
	Effect    Effect
	Priority  int
	Recursive bool
}

func (s *Store) ListManagedRules(ctx context.Context, target common.ResourceRef) ([]ManagedRule, error) {
	if _, err := validateRef(target); err != nil {
		return nil, err
	}
	rows, err := s.db.QueryContext(ctx, `SELECT rule_id FROM acl_rules ORDER BY rule_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []int64{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	result := []ManagedRule{}
	for _, id := range ids {
		rule, err := s.GetManagedRule(ctx, id)
		if err != nil {
			return nil, err
		}
		if rule.Target == target {
			result = append(result, rule)
		}
	}
	return result, nil
}

func (s *Store) CreateManagedRule(ctx context.Context, target common.ResourceRef, input RuleInput, protected bool) (ManagedRule, error) {
	if protected {
		if input.CreatedByActor == "" {
			input.CreatedByActor = "bootstrap"
		}
	} else if input.CreatedByActor == "" || input.ManagerSubjectKey == "" {
		return ManagedRule{}, fmt.Errorf("aclv2: manager fields are required")
	}
	if input.ManagerMode == "" {
		input.ManagerMode = "full"
	}
	if input.State == "" {
		input.State = "active"
	}
	if err := validateRuleInput(input); err != nil {
		return ManagedRule{}, err
	}
	segments, err := validateRef(target)
	if err != nil {
		return ManagedRule{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ManagedRule{}, err
	}
	defer tx.Rollback()
	rootID, err := ensureRoot(ctx, tx, target)
	if err != nil {
		return ManagedRule{}, err
	}
	nodeID, err := ensurePath(ctx, tx, rootID, segments)
	if err != nil {
		return ManagedRule{}, err
	}
	rec := 0
	if input.Recursive {
		rec = 1
	}
	prot := 0
	if protected {
		prot = 1
	}
	result, err := tx.ExecContext(ctx, `INSERT INTO acl_rules(node_id, subject_key, action, effect, priority, recursive, created_by_actor, manager_subject_key, manager_mode, state, protected)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, nodeID, input.SubjectKey, input.Action, input.Effect, input.Priority, rec, input.CreatedByActor, input.ManagerSubjectKey, input.ManagerMode, input.State, prot)
	if err != nil {
		return ManagedRule{}, fmt.Errorf("%w: %v", ErrConflict, err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return ManagedRule{}, err
	}
	if err := tx.Commit(); err != nil {
		return ManagedRule{}, err
	}
	return s.GetManagedRule(ctx, id)
}

func (s *Store) GetManagedRule(ctx context.Context, id int64) (ManagedRule, error) {
	var r ManagedRule
	var rec, prot int
	var rootID, nodeID int64
	err := s.db.QueryRowContext(ctx, `SELECT r.rule_id, r.node_id, r.subject_key, r.action, r.effect, r.priority, r.recursive, r.created_by_actor, r.manager_subject_key, r.manager_mode, r.state, r.protected, n.root_id
		FROM acl_rules r JOIN acl_path_nodes n ON n.node_id = r.node_id WHERE r.rule_id = ?`, id).Scan(&r.ID, &nodeID, &r.Subject, &r.Action, &r.Effect, &r.Priority, &rec, &r.CreatedByActor, &r.ManagerSubjectKey, &r.ManagerMode, &r.State, &prot, &rootID)
	if errors.Is(err, sql.ErrNoRows) {
		return ManagedRule{}, ErrRuleNotFound
	}
	if err != nil {
		return ManagedRule{}, fmt.Errorf("aclv2: get rule: %w", err)
	}
	r.NodeID, r.Recursive, r.Protected = nodeID, rec == 1, prot == 1
	target, err := s.refForNode(ctx, rootID, nodeID)
	if err != nil {
		return ManagedRule{}, err
	}
	r.Target = target
	return r, nil
}

func (s *Store) UpdateManagedRule(ctx context.Context, id int64, input UpdateRuleInput) (ManagedRule, error) {
	if input.Effect != EffectAllow && input.Effect != EffectDeny || input.Priority < 1 || input.Priority > 100 {
		return ManagedRule{}, fmt.Errorf("aclv2: invalid rule update")
	}
	r, err := s.GetManagedRule(ctx, id)
	if err != nil {
		return ManagedRule{}, err
	}
	if r.Protected {
		return ManagedRule{}, ErrProtected
	}
	rec := 0
	if input.Recursive {
		rec = 1
	}
	_, err = s.db.ExecContext(ctx, `UPDATE acl_rules SET effect=?, priority=?, recursive=?, rule_revision=rule_revision+1, updated_at=CURRENT_TIMESTAMP WHERE rule_id=?`, input.Effect, input.Priority, rec, id)
	if err != nil {
		return ManagedRule{}, err
	}
	return s.GetManagedRule(ctx, id)
}

func (s *Store) DeleteManagedRule(ctx context.Context, id int64) error {
	r, err := s.GetManagedRule(ctx, id)
	if err != nil {
		return err
	}
	if r.Protected {
		return ErrProtected
	}
	result, err := s.db.ExecContext(ctx, `DELETE FROM acl_rules WHERE rule_id=?`, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrRuleNotFound
	}
	return nil
}

func (s *Store) SetRuleManager(ctx context.Context, id int64, manager, mode, state string) (ManagedRule, error) {
	if !validSubject(manager) || (mode != "full" && mode != "narrow_only") || (state != "active" && state != "locked") {
		return ManagedRule{}, fmt.Errorf("aclv2: invalid manager update")
	}
	r, err := s.GetManagedRule(ctx, id)
	if err != nil {
		return ManagedRule{}, err
	}
	if r.Protected {
		return ManagedRule{}, ErrProtected
	}
	_, err = s.db.ExecContext(ctx, `UPDATE acl_rules SET manager_subject_key=?, manager_mode=?, state=?, rule_revision=rule_revision+1, updated_at=CURRENT_TIMESTAMP WHERE rule_id=?`, manager, mode, state, id)
	if err != nil {
		return ManagedRule{}, err
	}
	return s.GetManagedRule(ctx, id)
}

func (s *Store) refForNode(ctx context.Context, rootID, nodeID int64) (common.ResourceRef, error) {
	var ref common.ResourceRef
	if err := s.db.QueryRowContext(ctx, `SELECT provider_key, connection_key, scope_key FROM acl_namespace_roots WHERE root_id=?`, rootID).Scan(&ref.ProviderKey, &ref.ConnectionKey, &ref.ScopeKey); err != nil {
		return ref, err
	}
	segments := []string{}
	for nodeID != 0 {
		var parent sql.NullInt64
		var segment string
		if err := s.db.QueryRowContext(ctx, `SELECT parent_id, segment FROM acl_path_nodes WHERE node_id=? AND root_id=?`, nodeID, rootID).Scan(&parent, &segment); err != nil {
			return ref, err
		}
		segments = append([]string{segment}, segments...)
		if parent.Valid {
			nodeID = parent.Int64
		} else {
			nodeID = 0
		}
	}
	ref.Path = "/" + joinSegments(segments)
	return ref, nil
}

func joinSegments(parts []string) string {
	out := ""
	for i, part := range parts {
		if i > 0 {
			out += "/"
		}
		out += part
	}
	return out
}
