package v2

import (
	"github.com/akyaiy/veido/internal/common"
	"context"
	"errors"
	"log/slog"
	"os"
)

type LifecycleKind string

const (
	LifecycleCreate LifecycleKind = "create"
	LifecycleMove   LifecycleKind = "move"
	LifecycleDelete LifecycleKind = "delete"
)

// LifecycleMutation is the durable intent that brackets one provider mutation.
// Source is empty only for create; Target is empty only for delete.
type LifecycleMutation struct {
	OperationID string
	Kind        LifecycleKind
	Actor       Actor
	Source      common.ResourceRef
	Target      common.ResourceRef
}

type lifecycleMutationContextKey struct{}

// ContextWithLifecycleMutation passes the prepared operation identity to the
// owning provider so it can make its mutation idempotent or recoverable.
func ContextWithLifecycleMutation(ctx context.Context, mutation LifecycleMutation) context.Context {
	return context.WithValue(ctx, lifecycleMutationContextKey{}, mutation)
}

func LifecycleMutationFromContext(ctx context.Context) (LifecycleMutation, bool) {
	mutation, ok := ctx.Value(lifecycleMutationContextKey{}).(LifecycleMutation)
	return mutation, ok && mutation.OperationID != ""
}

// LifecycleOperation is created before the provider is called. A failed Commit
// must leave the operation recoverable and fail closed for its affected range.
type LifecycleOperation interface {
	Commit(ctx context.Context) error
	Abort(ctx context.Context, cause error) error
	Recover(ctx context.Context, cause error) error
}

type ResourceLifecycleSink interface {
	Prepare(ctx context.Context, mutation LifecycleMutation) (LifecycleOperation, error)
	Recover(ctx context.Context) error
}

type NoopResourceLifecycle struct{}

type noopLifecycleOperation struct{}

func NewNoopResourceLifecycle() ResourceLifecycleSink {
	return NoopResourceLifecycle{}
}

func (NoopResourceLifecycle) Prepare(_ context.Context, mutation LifecycleMutation) (LifecycleOperation, error) {
	slog.Debug("lifecycle prepare", "operation_id", mutation.OperationID, "kind", mutation.Kind, "source", mutation.Source, "target", mutation.Target)
	return noopLifecycleOperation{}, nil
}

func (NoopResourceLifecycle) Recover(context.Context) error { return nil }

func (noopLifecycleOperation) Commit(context.Context) error         { return nil }
func (noopLifecycleOperation) Abort(context.Context, error) error   { return nil }
func (noopLifecycleOperation) Recover(context.Context, error) error { return nil }

// LifecycleMetadataProbe reads provider metadata without applying user ACL.
// It is a kernel-only probe for reconciliation of an already fenced lifecycle
// operation; it is not exposed as a user-facing VFS operation.
type LifecycleMetadataProbe struct {
	scopes      ScopeResolverContract
	connections ConnectionResolverContract
	providers   ProviderPool
}

func NewLifecycleMetadataProbe(scopes ScopeResolverContract, connections ConnectionResolverContract, providers ProviderPool) *LifecycleMetadataProbe {
	return &LifecycleMetadataProbe{scopes: scopes, connections: connections, providers: providers}
}

// Exists returns false only for a provider-confirmed missing resource. Any
// resolution or provider failure is returned so the caller remains fail-closed.
func (p *LifecycleMetadataProbe) Exists(ctx context.Context, ref common.ResourceRef) (bool, error) {
	scope, err := p.scopes.ResolveExplicitScope(ctx, ref.ScopeKey)
	if err != nil {
		return false, err
	}
	connection, err := p.connections.ResolveConnection(ctx, *scope, ref.ProviderKey, ref.ConnectionKey)
	if err != nil {
		return false, err
	}
	provider, err := p.providers.Get(ctx, *connection)
	if err != nil {
		return false, err
	}
	_, err = provider.Stat(ctx, ref.Path)
	if err == nil {
		return true, nil
	}
	if errors.Is(err, ErrNotFound) || errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	return false, err
}
