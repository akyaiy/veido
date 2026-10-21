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

// SystemAndOwnerScopeAuthorizer is the temporary policy before ACLv2. Every
// trusted guest or user can use the shared system scope; a user can additionally
// use a personal scope which names that user as its owner.
type SystemAndOwnerScopeAuthorizer struct {
	scopes       ScopeResolverContract
	publicScopes map[string]struct{}
}

func NewSystemAndOwnerScopeAuthorizer(scopes ScopeResolverContract) (Authorizer, error) {
	return NewSystemOwnerAndPublicScopeAuthorizer(scopes, nil)
}

// NewSystemOwnerAndPublicScopeAuthorizer is the explicit pre-ACL bridge used
// while ACL grants are not yet persisted. Public scopes are configured by the
// application composition root, never inferred from a URI in an HTTP request.
// ACLv2 will replace this policy with grant evaluation.
func NewSystemOwnerAndPublicScopeAuthorizer(scopes ScopeResolverContract, publicScopes []string) (Authorizer, error) {
	if scopes == nil {
		return nil, ErrInvalidNewInstanceParams
	}
	configured := make(map[string]struct{}, len(publicScopes))
	for _, scope := range publicScopes {
		scope = strings.TrimSpace(scope)
		if scope == "" || scope == "system" || strings.Contains(scope, "/") {
			return nil, ErrInvalidScope
		}
		configured[scope] = struct{}{}
	}
	return &SystemAndOwnerScopeAuthorizer{scopes: scopes, publicScopes: configured}, nil
}

func (a *SystemAndOwnerScopeAuthorizer) Can(ctx context.Context, actor Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	if actor.ID == "" || (actor.Kind != ActorUser && actor.Kind != ActorGuest) {
		return false, nil
	}
	if scopeKey, scopeGate := scopeGateKey(action, ref); scopeGate {
		return a.canAccessScope(ctx, actor, scopeKey)
	}
	return a.canAccessScope(ctx, actor, ref.ScopeKey)
}

func (a *SystemAndOwnerScopeAuthorizer) canAccessScope(ctx context.Context, actor Actor, scopeKey string) (bool, error) {
	if scopeKey == "system" {
		return true, nil
	}
	if _, ok := a.publicScopes[scopeKey]; ok {
		return true, nil
	}
	if actor.Kind != ActorUser {
		return false, nil
	}
	scope, err := a.scopes.ResolveExplicitScope(ctx, scopeKey)
	if err != nil {
		return false, err
	}
	return scope.OwnerSubjectKey == common.SubjectKey(actor.String()), nil
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
