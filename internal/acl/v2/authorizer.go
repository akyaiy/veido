package v2

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/akyaiy/veido/internal/auth"
	"github.com/akyaiy/veido/internal/common"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
)

// ACLAuthorizer is the VFS Authorizer adapter for ACLv2.
type ACLAuthorizer struct {
	store  *Store
	groups auth.GroupMembershipReader
}

func NewAuthorizer(store *Store, groups auth.GroupMembershipReader) (*ACLAuthorizer, error) {
	if store == nil || groups == nil {
		return nil, fmt.Errorf("aclv2: store and group membership reader are required")
	}
	return &ACLAuthorizer{store: store, groups: groups}, nil
}

func (a *ACLAuthorizer) Can(ctx context.Context, actor vfs.Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	if a == nil || a.store == nil || a.groups == nil {
		return false, fmt.Errorf("aclv2: authorizer is unavailable")
	}
	if _, err := validateRef(ref); err != nil || !validAction(action) {
		return false, fmt.Errorf("aclv2: invalid authorization request")
	}
	fenced, err := a.store.LifecycleFenced(ctx, ref)
	if err != nil {
		return false, err
	}
	if fenced {
		return false, ErrLifecyclePending
	}
	subjects, err := a.subjects(ctx, actor)
	if err != nil {
		return false, err
	}
	rules, err := a.store.ApplicableRules(ctx, ref, action, subjects)
	if err != nil {
		return false, err
	}
	maxPriority := 0
	for _, rule := range rules {
		if rule.Priority > maxPriority {
			maxPriority = rule.Priority
		}
	}
	if maxPriority == 0 {
		return false, nil
	}
	for _, rule := range rules {
		if rule.Priority == maxPriority && rule.Effect == EffectDeny {
			return false, nil
		}
	}
	return true, nil
}

func (a *ACLAuthorizer) subjects(ctx context.Context, actor vfs.Actor) (map[string]struct{}, error) {
	subjects := make(map[string]struct{})
	switch actor.Kind {
	case vfs.ActorGuest:
		subjects["guest"] = struct{}{}
		subjects["all"] = struct{}{}
	case vfs.ActorService:
		if actor.ID == "" || strings.Contains(actor.ID, ":") {
			return nil, fmt.Errorf("aclv2: invalid service actor")
		}
		subjects["service:"+actor.ID] = struct{}{}
	case vfs.ActorUser:
		userID, err := strconv.ParseInt(actor.ID, 10, 64)
		if err != nil || userID <= 0 {
			return nil, fmt.Errorf("aclv2: invalid user actor")
		}
		subjects["user:"+actor.ID] = struct{}{}
		subjects["all"] = struct{}{}
		groups, err := a.groups.GroupNames(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("aclv2: expand user groups: %w", err)
		}
		for _, group := range groups {
			if !validSubject("group:" + group) {
				return nil, fmt.Errorf("aclv2: invalid trusted group name")
			}
			subjects["group:"+group] = struct{}{}
		}
	default:
		return nil, fmt.Errorf("aclv2: unknown actor kind")
	}
	return subjects, nil
}

// SubjectKeys exposes the trusted subject expansion needed by ACL's own rule
// manager checks. It is not exported to other providers.
func (a *ACLAuthorizer) SubjectKeys(ctx context.Context, actor vfs.Actor) (map[string]struct{}, error) {
	if a == nil || a.groups == nil {
		return nil, fmt.Errorf("aclv2: authorizer is unavailable")
	}
	return a.subjects(ctx, actor)
}

var _ vfs.Authorizer = (*ACLAuthorizer)(nil)
