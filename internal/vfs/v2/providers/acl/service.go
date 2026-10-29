package acl

import (
	aclv2 "github.com/akyaiy/veido/internal/acl/v2"
	"github.com/akyaiy/veido/internal/common"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"errors"
	"fmt"
)

type RuleService struct {
	store      *aclv2.Store
	authorizer *aclv2.ACLAuthorizer
}

func NewRuleService(store *aclv2.Store, authorizer *aclv2.ACLAuthorizer) (*RuleService, error) {
	if store == nil || authorizer == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}
	return &RuleService{store: store, authorizer: authorizer}, nil
}

func (s *RuleService) Create(ctx context.Context, actor vfs.Actor, target common.ResourceRef, input aclv2.RuleInput) (aclv2.ManagedRule, error) {
	if err := s.requirePolicy(ctx, actor, common.ActionExec, target); err != nil {
		return aclv2.ManagedRule{}, err
	}
	input.CreatedByActor, input.ManagerSubjectKey, input.ManagerMode, input.State = actor.String(), actor.String(), "full", "active"
	return s.store.CreateManagedRule(ctx, target, input, false)
}
func (s *RuleService) Get(ctx context.Context, actor vfs.Actor, id int64) (aclv2.ManagedRule, error) {
	r, err := s.store.GetManagedRule(ctx, id)
	if err != nil {
		return r, err
	}
	if err := s.requireManager(ctx, actor, r, common.ActionExec); err != nil {
		return aclv2.ManagedRule{}, err
	}
	return r, nil
}
func (s *RuleService) List(ctx context.Context, actor vfs.Actor, target common.ResourceRef) ([]aclv2.ManagedRule, error) {
	if err := s.requirePolicy(ctx, actor, common.ActionRead, target); err != nil {
		return nil, err
	}
	return s.store.ListManagedRules(ctx, target)
}
func (s *RuleService) Update(ctx context.Context, actor vfs.Actor, id int64, input aclv2.UpdateRuleInput) (aclv2.ManagedRule, error) {
	r, err := s.store.GetManagedRule(ctx, id)
	if err != nil {
		return r, err
	}
	if err := s.requireManager(ctx, actor, r, common.ActionExec); err != nil {
		return aclv2.ManagedRule{}, err
	}
	if r.ManagerMode == "narrow_only" && expands(r, input) {
		return aclv2.ManagedRule{}, osPermission()
	}
	return s.store.UpdateManagedRule(ctx, id, input)
}
func (s *RuleService) Delete(ctx context.Context, actor vfs.Actor, id int64) error {
	r, err := s.store.GetManagedRule(ctx, id)
	if err != nil {
		return err
	}
	if err := s.requireManager(ctx, actor, r, common.ActionExec); err != nil {
		return err
	}
	if r.ManagerMode == "narrow_only" && r.Effect == aclv2.EffectDeny {
		return osPermission()
	}
	return s.store.DeleteManagedRule(ctx, id)
}
func (s *RuleService) SetManager(ctx context.Context, actor vfs.Actor, id int64, manager, mode, state string) (aclv2.ManagedRule, error) {
	if err := s.requirePolicyAdmin(ctx, actor); err != nil {
		return aclv2.ManagedRule{}, err
	}
	return s.store.SetRuleManager(ctx, id, manager, mode, state)
}

func (s *RuleService) requireManager(ctx context.Context, actor vfs.Actor, rule aclv2.ManagedRule, action common.Action) error {
	if rule.Protected {
		return aclv2.ErrProtected
	}
	if err := s.requirePolicy(ctx, actor, action, rule.Target); err != nil {
		return err
	}
	if err := s.requirePolicyAdmin(ctx, actor); err == nil {
		return nil
	}
	if rule.State != "active" {
		return osPermission()
	}
	subjects, err := s.authorizer.SubjectKeys(ctx, actor)
	if err != nil {
		return err
	}
	if _, ok := subjects[rule.ManagerSubjectKey]; !ok {
		return osPermission()
	}
	return nil
}
func (s *RuleService) requirePolicy(ctx context.Context, actor vfs.Actor, action common.Action, target common.ResourceRef) error {
	ok, err := s.authorizer.Can(ctx, actor, action, PolicyRef(target))
	if err != nil {
		return err
	}
	if !ok {
		return osPermission()
	}
	return nil
}
func (s *RuleService) requirePolicyAdmin(ctx context.Context, actor vfs.Actor) error {
	ok, err := s.authorizer.Can(ctx, actor, common.ActionExec, controlPlaneRef())
	if err != nil {
		return err
	}
	if !ok {
		return osPermission()
	}
	return nil
}
func expands(old aclv2.ManagedRule, next aclv2.UpdateRuleInput) bool {
	if old.Effect == aclv2.EffectDeny && next.Effect == aclv2.EffectAllow {
		return true
	}
	if old.Effect == aclv2.EffectAllow && next.Priority > old.Priority {
		return true
	}
	return !old.Recursive && next.Recursive
}
func osPermission() error { return fmt.Errorf("%w", vfs.ErrPermissionDenied) }

var _ = errors.Is
