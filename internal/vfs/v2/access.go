package v2

import (
	"MyServer/internal/common"
	"context"
	"fmt"
	"strings"
)

type Authorizer interface {
	Can(ctx context.Context, actor Actor, action common.Action, ref common.ResourceRef) (bool, error)
}

type ACLAuthorizer struct {
}

func (a *ACLAuthorizer) Can(ctx context.Context, actor Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	return true, nil
}

// OwnerScopeGateAuthorizer is a migration bridge for installations that do not
// yet have an ACLv2 evaluator. It gives a scope owner the initial x grant for
// the canonical scope resource and delegates all other decisions.
//
// It must be removed when owner and system grants are stored in the real ACL
// provider. Keeping this policy in an Authorizer ensures resolution remains a
// pure address lookup during the transition.
type OwnerScopeGateAuthorizer struct {
	scopes   ScopeResolverContract
	delegate Authorizer
}

	func NewOwnerScopeGateAuthorizer(scopes ScopeResolverContract, delegate Authorizer) (Authorizer, error) {
	if scopes == nil || delegate == nil {
		return nil, ErrInvalidNewInstanceParams
	}
	return &OwnerScopeGateAuthorizer{scopes: scopes, delegate: delegate}, nil
}

func (a *OwnerScopeGateAuthorizer) Can(ctx context.Context, actor Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	scopeKey, isScopeGate := scopeGateKey(action, ref)
	if !isScopeGate {
		return a.delegate.Can(ctx, actor, action, ref)
	}
	if scopeKey == "" {
		return false, fmt.Errorf("%w: malformed scope gate resource", ErrInvalidScope)
	}

	scope, err := a.scopes.ResolveExplicitScope(ctx, scopeKey)
	if err != nil {
		return false, fmt.Errorf("resolve scope grant: %w", err)
	}
	return scope.OwnerSubjectKey == common.SubjectKey(actor.String()), nil
}

func scopeGateKey(action common.Action, ref common.ResourceRef) (string, bool) {
	if action != common.ActionExec ||
		ref.ProviderKey != "scopes" ||
		ref.ConnectionKey != "scopes" ||
		ref.ScopeKey != "system" ||
		!strings.HasPrefix(ref.Path, "/scopes/") {
		return "", false
	}

	scopeKey := strings.TrimPrefix(ref.Path, "/scopes/")
	if scopeKey == "" || strings.Contains(scopeKey, "/") {
		return "", true
	}
	return scopeKey, true
}
