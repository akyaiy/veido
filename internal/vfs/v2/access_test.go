package v2

import (
	"github.com/akyaiy/veido/internal/common"
	"context"
	"errors"
	"testing"
)

type fixedAuthorizer struct {
	allowed bool
	err     error
	calls   int
}

func (a *fixedAuthorizer) Can(context.Context, Actor, common.Action, common.ResourceRef) (bool, error) {
	a.calls++
	return a.allowed, a.err
}

func TestOwnerScopeGateAuthorizerSeedsOwnerExecGrant(t *testing.T) {
	resolver := &scopeGateTestResolver{scope: Scope{Key: "alice", OwnerSubjectKey: "user:1"}}
	delegate := &fixedAuthorizer{allowed: true}
	authorizer, err := NewOwnerScopeGateAuthorizer(resolver, delegate)
	if err != nil {
		t.Fatalf("NewOwnerScopeGateAuthorizer() error = %v", err)
	}

	ownerAllowed, err := authorizer.Can(
		context.Background(),
		Actor{Kind: ActorUser, ID: "1"},
		common.ActionExec,
		scopeGateRef("alice"),
	)
	if err != nil || !ownerAllowed {
		t.Fatalf("owner scope gate = %v, %v; want true, nil", ownerAllowed, err)
	}

	foreignAllowed, err := authorizer.Can(
		context.Background(),
		Actor{Kind: ActorUser, ID: "2"},
		common.ActionExec,
		scopeGateRef("alice"),
	)
	if err != nil || foreignAllowed {
		t.Fatalf("foreign scope gate = %v, %v; want false, nil", foreignAllowed, err)
	}
	if delegate.calls != 0 {
		t.Fatalf("delegate calls = %d, want 0 for scope gates", delegate.calls)
	}
}

func TestOwnerScopeGateAuthorizerDelegatesTargetDecision(t *testing.T) {
	resolver := &scopeGateTestResolver{scope: Scope{Key: "alice", OwnerSubjectKey: "user:1"}}
	delegateErr := errors.New("acl backend unavailable")
	delegate := &fixedAuthorizer{err: delegateErr}
	authorizer, err := NewOwnerScopeGateAuthorizer(resolver, delegate)
	if err != nil {
		t.Fatalf("NewOwnerScopeGateAuthorizer() error = %v", err)
	}

	_, err = authorizer.Can(
		context.Background(),
		Actor{Kind: ActorUser, ID: "1"},
		common.ActionRead,
		common.ResourceRef{ProviderKey: "local", ConnectionKey: "default", ScopeKey: "alice", Path: "/file"},
	)
	if !errors.Is(err, delegateErr) {
		t.Fatalf("target authorization error = %v, want delegate error", err)
	}
	if delegate.calls != 1 {
		t.Fatalf("delegate calls = %d, want 1", delegate.calls)
	}
}

func TestOwnerScopeGateAuthorizerFailsClosedWhenScopeLookupFails(t *testing.T) {
	lookupErr := errors.New("scope storage unavailable")
	resolver := &scopeGateTestResolver{err: lookupErr}
	delegate := &fixedAuthorizer{allowed: true}
	authorizer, err := NewOwnerScopeGateAuthorizer(resolver, delegate)
	if err != nil {
		t.Fatalf("NewOwnerScopeGateAuthorizer() error = %v", err)
	}

	allowed, err := authorizer.Can(
		context.Background(),
		Actor{Kind: ActorUser, ID: "1"},
		common.ActionExec,
		scopeGateRef("alice"),
	)
	if allowed || !errors.Is(err, lookupErr) {
		t.Fatalf("scope lookup failure = %v, %v; want false and lookup error", allowed, err)
	}
	if delegate.calls != 0 {
		t.Fatalf("delegate calls = %d, want 0", delegate.calls)
	}
}

func TestOwnerScopeGateAuthorizerRejectsMalformedScopeResource(t *testing.T) {
	resolver := &scopeGateTestResolver{scope: Scope{Key: "alice", OwnerSubjectKey: "user:1"}}
	delegate := &fixedAuthorizer{allowed: true}
	authorizer, err := NewOwnerScopeGateAuthorizer(resolver, delegate)
	if err != nil {
		t.Fatalf("NewOwnerScopeGateAuthorizer() error = %v", err)
	}

	allowed, err := authorizer.Can(
		context.Background(),
		Actor{Kind: ActorUser, ID: "1"},
		common.ActionExec,
		common.ResourceRef{ProviderKey: "scopes", ConnectionKey: "scopes", ScopeKey: "system", Path: "/scopes/alice/private"},
	)
	if allowed || !errors.Is(err, ErrInvalidScope) {
		t.Fatalf("malformed scope gate = %v, %v; want false and invalid scope", allowed, err)
	}
	if delegate.calls != 0 {
		t.Fatalf("delegate calls = %d, want 0", delegate.calls)
	}
}

func TestSystemAndOwnerScopeAuthorizerAllowsSystemAndOwnScope(t *testing.T) {
	resolver := &scopeGateTestResolver{scope: Scope{Key: "alice", OwnerSubjectKey: "user:1"}}
	authorizer, err := NewSystemAndOwnerScopeAuthorizer(resolver)
	if err != nil {
		t.Fatal(err)
	}
	guest := Actor{Kind: ActorGuest, ID: "guest-id"}

	allowed, err := authorizer.Can(context.Background(), guest, common.ActionRead, common.ResourceRef{ProviderKey: "users", ConnectionKey: "account", ScopeKey: "system", Path: "/actor.json"})
	if err != nil || !allowed {
		t.Fatalf("system resource = %v, %v; want true, nil", allowed, err)
	}
	allowed, err = authorizer.Can(context.Background(), guest, common.ActionRead, common.ResourceRef{ProviderKey: "users", ConnectionKey: "account", ScopeKey: "other", Path: "/actor.json"})
	if err != nil || allowed {
		t.Fatalf("foreign resource = %v, %v; want false, nil", allowed, err)
	}
	allowed, err = authorizer.Can(context.Background(), guest, common.ActionExec, scopeGateRef("system"))
	if err != nil || !allowed {
		t.Fatalf("system scope gate = %v, %v; want true, nil", allowed, err)
	}
	allowed, err = authorizer.Can(context.Background(), Actor{Kind: ActorUser, ID: "1"}, common.ActionRead, common.ResourceRef{ScopeKey: "alice"})
	if err != nil || !allowed {
		t.Fatalf("owner scope = %v, %v; want true, nil", allowed, err)
	}
}

func TestSystemOwnerAndPublicScopeAuthorizerAllowsConfiguredPublicScope(t *testing.T) {
	resolver := &scopeGateTestResolver{scope: Scope{Key: "site-acme", OwnerSubjectKey: "user:1"}}
	authorizer, err := NewSystemOwnerAndPublicScopeAuthorizer(resolver, []string{"site-acme"})
	if err != nil {
		t.Fatal(err)
	}
	guest := Actor{Kind: ActorGuest, ID: "guest-id"}
	allowed, err := authorizer.Can(context.Background(), guest, common.ActionRead, common.ResourceRef{ProviderKey: "html", ConnectionKey: "site", ScopeKey: "site-acme", Path: "/tree.json"})
	if err != nil || !allowed {
		t.Fatalf("public site resource = %v, %v; want true, nil", allowed, err)
	}
	allowed, err = authorizer.Can(context.Background(), guest, common.ActionRead, common.ResourceRef{ProviderKey: "html", ConnectionKey: "site", ScopeKey: "private", Path: "/tree.json"})
	if err != nil || allowed {
		t.Fatalf("private resource = %v, %v; want false, nil", allowed, err)
	}
}
