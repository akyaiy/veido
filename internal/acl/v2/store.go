package v2

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path"
	"strings"

	"MyServer/internal/common"
)

type Effect string

const (
	EffectAllow Effect = "allow"
	EffectDeny  Effect = "deny"
)

// RuleInput is storage input for the first ACLv2 slice. Public rule-management
// authorization is deliberately left to the ACL Provider in step 3.
type RuleInput struct {
	SubjectKey        string        `json:"subject_key"`
	Action            common.Action `json:"action"`
	Effect            Effect        `json:"effect"`
	Priority          int           `json:"priority"`
	Recursive         bool          `json:"recursive"`
	CreatedByActor    string        `json:"created_by_actor"`
	ManagerSubjectKey string        `json:"manager_subject_key"`
	ManagerMode       string        `json:"manager_mode"`
	State             string        `json:"state"`
}

type Rule struct {
	ID        int64
	NodeID    int64
	Subject   string
	Action    common.Action
	Effect    Effect
	Priority  int
	Recursive bool
}

type Store struct{ db *sql.DB }

func NewStore(db *sql.DB) (*Store, error) {
	if db == nil {
		return nil, errors.New("aclv2: database is required")
	}
	return &Store{db: db}, nil
}

// UpsertRule exists for migration/bootstrap tests and for the future ACL
// Provider service. It is not injected into other VFS providers.
func (s *Store) UpsertRule(ctx context.Context, ref common.ResourceRef, input RuleInput) (Rule, error) {
	if s == nil || s.db == nil {
		return Rule{}, errors.New("aclv2: store is unavailable")
	}
	segments, err := validateRef(ref)
	if err != nil {
		return Rule{}, err
	}
	if err := validateRuleInput(input); err != nil {
		return Rule{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Rule{}, fmt.Errorf("aclv2: begin rule transaction: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	rootID, err := ensureRoot(ctx, tx, ref)
	if err != nil {
		return Rule{}, err
	}
	nodeID, err := ensurePath(ctx, tx, rootID, segments)
	if err != nil {
		return Rule{}, err
	}
	recursive := 0
	if input.Recursive {
		recursive = 1
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO acl_rules (
			node_id, subject_key, action, effect, priority, recursive,
			created_by_actor, manager_subject_key, manager_mode, state
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(node_id, subject_key, action) DO UPDATE SET
			effect = excluded.effect,
			priority = excluded.priority,
			recursive = excluded.recursive,
			rule_revision = acl_rules.rule_revision + 1,
			updated_at = CURRENT_TIMESTAMP`,
		nodeID, input.SubjectKey, input.Action, input.Effect, input.Priority, recursive,
		input.CreatedByActor, input.ManagerSubjectKey, input.ManagerMode, input.State)
	if err != nil {
		return Rule{}, fmt.Errorf("aclv2: write rule: %w", err)
	}
	var rule Rule
	var recursiveValue int
	err = tx.QueryRowContext(ctx, `SELECT rule_id, node_id, subject_key, action, effect, priority, recursive
		FROM acl_rules WHERE node_id = ? AND subject_key = ? AND action = ?`,
		nodeID, input.SubjectKey, input.Action).Scan(
		&rule.ID, &rule.NodeID, &rule.Subject, &rule.Action, &rule.Effect, &rule.Priority, &recursiveValue)
	if err != nil {
		return Rule{}, fmt.Errorf("aclv2: read written rule: %w", err)
	}
	rule.Recursive = recursiveValue == 1
	if err := tx.Commit(); err != nil {
		return Rule{}, fmt.Errorf("aclv2: commit rule transaction: %w", err)
	}
	committed = true
	return rule, nil
}

func (s *Store) ApplicableRules(ctx context.Context, ref common.ResourceRef, action common.Action, subjects map[string]struct{}) ([]Rule, error) {
	if s == nil || s.db == nil {
		return nil, errors.New("aclv2: store is unavailable")
	}
	segments, err := validateRef(ref)
	if err != nil {
		return nil, err
	}
	if !validAction(action) {
		return nil, fmt.Errorf("aclv2: invalid action %q", action)
	}
	if len(subjects) == 0 {
		return nil, nil
	}

	var rootID int64
	err = s.db.QueryRowContext(ctx, `SELECT root_id FROM acl_namespace_roots
		WHERE provider_key = ? AND connection_key = ? AND scope_key = ? AND state = 'active'`,
		ref.ProviderKey, ref.ConnectionKey, ref.ScopeKey).Scan(&rootID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("aclv2: find namespace root: %w", err)
	}

	type matchedNode struct {
		id    int64
		exact bool
	}
	nodes := make([]matchedNode, 0, len(segments))
	var parentID *int64
	for index, segment := range segments {
		var nodeID int64
		if parentID == nil {
			err = s.db.QueryRowContext(ctx, `SELECT node_id FROM acl_path_nodes
				WHERE root_id = ? AND parent_id IS NULL AND segment_key = ? AND state = 'active'`, rootID, segment).Scan(&nodeID)
		} else {
			err = s.db.QueryRowContext(ctx, `SELECT node_id FROM acl_path_nodes
				WHERE root_id = ? AND parent_id = ? AND segment_key = ? AND state = 'active'`, rootID, *parentID, segment).Scan(&nodeID)
		}
		if errors.Is(err, sql.ErrNoRows) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("aclv2: resolve namespace path: %w", err)
		}
		nodes = append(nodes, matchedNode{id: nodeID, exact: index == len(segments)-1})
		parentID = &nodeID
	}

	result := make([]Rule, 0)
	for _, node := range nodes {
		rows, err := s.db.QueryContext(ctx, `SELECT rule_id, node_id, subject_key, action, effect, priority, recursive
			FROM acl_rules WHERE node_id = ? AND action = ?`, node.id, action)
		if err != nil {
			return nil, fmt.Errorf("aclv2: read rules: %w", err)
		}
		for rows.Next() {
			var rule Rule
			var recursive int
			if err := rows.Scan(&rule.ID, &rule.NodeID, &rule.Subject, &rule.Action, &rule.Effect, &rule.Priority, &recursive); err != nil {
				_ = rows.Close()
				return nil, fmt.Errorf("aclv2: scan rule: %w", err)
			}
			rule.Recursive = recursive == 1
			if _, applies := subjects[rule.Subject]; applies && (node.exact || rule.Recursive) {
				result = append(result, rule)
			}
		}
		if err := rows.Close(); err != nil {
			return nil, fmt.Errorf("aclv2: close rules: %w", err)
		}
	}
	return result, nil
}

func ensureRoot(ctx context.Context, tx *sql.Tx, ref common.ResourceRef) (int64, error) {
	if _, err := tx.ExecContext(ctx, `INSERT INTO acl_namespace_roots(provider_key, connection_key, scope_key)
		VALUES (?, ?, ?) ON CONFLICT(provider_key, connection_key, scope_key) DO NOTHING`,
		ref.ProviderKey, ref.ConnectionKey, ref.ScopeKey); err != nil {
		return 0, fmt.Errorf("aclv2: create namespace root: %w", err)
	}
	var rootID int64
	if err := tx.QueryRowContext(ctx, `SELECT root_id FROM acl_namespace_roots
		WHERE provider_key = ? AND connection_key = ? AND scope_key = ? AND state = 'active'`,
		ref.ProviderKey, ref.ConnectionKey, ref.ScopeKey).Scan(&rootID); err != nil {
		return 0, fmt.Errorf("aclv2: load namespace root: %w", err)
	}
	return rootID, nil
}

func ensurePath(ctx context.Context, tx *sql.Tx, rootID int64, segments []string) (int64, error) {
	var parentID *int64
	for _, segment := range segments {
		var nodeID int64
		var err error
		if parentID == nil {
			err = tx.QueryRowContext(ctx, `SELECT node_id FROM acl_path_nodes
				WHERE root_id = ? AND parent_id IS NULL AND segment_key = ? AND state = 'active'`, rootID, segment).Scan(&nodeID)
		} else {
			err = tx.QueryRowContext(ctx, `SELECT node_id FROM acl_path_nodes
				WHERE root_id = ? AND parent_id = ? AND segment_key = ? AND state = 'active'`, rootID, *parentID, segment).Scan(&nodeID)
		}
		if errors.Is(err, sql.ErrNoRows) {
			if parentID == nil {
				_, err = tx.ExecContext(ctx, `INSERT INTO acl_path_nodes(root_id, parent_id, segment, segment_key)
					VALUES (?, NULL, ?, ?)`, rootID, segment, segment)
			} else {
				_, err = tx.ExecContext(ctx, `INSERT INTO acl_path_nodes(root_id, parent_id, segment, segment_key)
					VALUES (?, ?, ?, ?)`, rootID, *parentID, segment, segment)
			}
			if err != nil {
				return 0, fmt.Errorf("aclv2: create path node: %w", err)
			}
			if parentID == nil {
				err = tx.QueryRowContext(ctx, `SELECT node_id FROM acl_path_nodes
					WHERE root_id = ? AND parent_id IS NULL AND segment_key = ? AND state = 'active'`, rootID, segment).Scan(&nodeID)
			} else {
				err = tx.QueryRowContext(ctx, `SELECT node_id FROM acl_path_nodes
					WHERE root_id = ? AND parent_id = ? AND segment_key = ? AND state = 'active'`, rootID, *parentID, segment).Scan(&nodeID)
			}
		}
		if err != nil {
			return 0, fmt.Errorf("aclv2: resolve path node: %w", err)
		}
		parentID = &nodeID
	}
	return *parentID, nil
}

func validateRef(ref common.ResourceRef) ([]string, error) {
	uri, err := (common.ResourceAddress{
		ProviderKey: ref.ProviderKey, ConnectionKey: ref.ConnectionKey, ScopeKey: ref.ScopeKey, Path: ref.Path,
	}).URI()
	if err != nil || uri.Path() != ref.Path || ref.Path == "/" {
		return nil, fmt.Errorf("aclv2: invalid resource reference")
	}
	if ref.ProviderKey == "" || ref.ConnectionKey == "" || ref.ScopeKey == "" || !strings.HasPrefix(ref.Path, "/") || path.Clean(ref.Path) != ref.Path {
		return nil, fmt.Errorf("aclv2: invalid resource reference")
	}
	return strings.Split(strings.TrimPrefix(ref.Path, "/"), "/"), nil
}

func validateRuleInput(input RuleInput) error {
	if !validSubject(input.SubjectKey) || !validAction(input.Action) || (input.Effect != EffectAllow && input.Effect != EffectDeny) || input.Priority < 1 || input.Priority > 100 {
		return fmt.Errorf("aclv2: invalid rule input")
	}
	if input.CreatedByActor == "" || input.ManagerSubjectKey == "" || (input.ManagerMode != "full" && input.ManagerMode != "narrow_only") || (input.State != "active" && input.State != "locked") {
		return fmt.Errorf("aclv2: invalid rule management fields")
	}
	return nil
}

func validAction(action common.Action) bool {
	return action == common.ActionRead || action == common.ActionWrite || action == common.ActionExec
}

func validSubject(subject string) bool {
	if subject == "guest" || subject == "all" {
		return true
	}
	for _, prefix := range []string{"user:", "group:", "service:"} {
		if strings.HasPrefix(subject, prefix) && len(subject) > len(prefix) && !strings.Contains(strings.TrimPrefix(subject, prefix), ":") {
			return true
		}
	}
	return false
}
