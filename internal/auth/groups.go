package auth

import (
	"context"
	"fmt"
)

// GroupMembershipReader is the read-only kernel contract used by ACL to
// expand a trusted user actor into its group subjects.
type GroupMembershipReader interface {
	GroupNames(ctx context.Context, userID int64) ([]string, error)
}

// GroupNames returns the Auth-owned groups of one trusted user identity.
func (a *Auth) GroupNames(ctx context.Context, userID int64) ([]string, error) {
	if a == nil || a.db == nil {
		return nil, fmt.Errorf("auth: group membership store is unavailable")
	}
	if userID <= 0 {
		return nil, fmt.Errorf("auth: invalid user id")
	}
	rows, err := a.db.QueryContext(ctx, `
		SELECT g.name
		FROM auth_group_memberships AS m
		JOIN auth_groups AS g ON g.group_id = m.group_id
		WHERE m.user_id = ?
		ORDER BY g.name`, userID)
	if err != nil {
		return nil, fmt.Errorf("auth: list user groups: %w", err)
	}
	defer rows.Close()

	groups := make([]string, 0)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("auth: scan user group: %w", err)
		}
		groups = append(groups, name)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("auth: list user groups: %w", err)
	}
	return groups, nil
}
