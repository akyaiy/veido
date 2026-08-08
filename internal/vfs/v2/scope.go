package v2

import (
	"MyServer/internal/common"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
)

type Scope struct {
	Key             string
	Kind            string
	OwnerSubjectKey common.SubjectKey
}

type ScopeResolverContract interface {
	// ResolveScope resolves the scope for the given actor and scope key.
	// If scopeKey is empty, the default scope for the actor is returned.
	ResolveScope(ctx context.Context, actor Actor, scopeKey string) (*Scope, error)
}

type ScopeResolver struct {
	db *sql.DB
}

func NewScopeResolver(db *sql.DB) (ScopeResolverContract, error) {
	if db == nil {
		return nil, ErrInvalidNewInstanceParams
	}
	newSR := &ScopeResolver{
		db: db,
	}
	return newSR, nil
}

// ResolveScope resolves the scope for the given actor and scope key.
// If scopeKey is empty, the default scope for the actor is returned.
func (sr *ScopeResolver) ResolveScope(ctx context.Context, actor Actor, scopeKey string) (*Scope, error) {
	if scopeKey == "" {
		return sr.DefaultScopeForActor(ctx, actor)
	}

	return sr.ResolveExplicitScope(ctx, actor, scopeKey)
}

func (sr *ScopeResolver) DefaultScopeForActor(ctx context.Context, actor Actor) (*Scope, error) {
	if actor.Kind != ActorUser || actor.ID == "" {
		slog.Error(
			"actor is not a user or has no ID",
			"kind", actor.Kind,
			"id", actor.ID,
		)
		return nil, fmt.Errorf("%w: %v", ErrScopeResolutionFailed,
			fmt.Errorf("actor is not a user or has no ID"))
	}

	const query = `
		SELECT
			s.scope_key,
			s.kind,
			s.owner_subject_key
		FROM vfs_principal_default_scopes AS ds
		JOIN vfs_scopes AS s
			ON s.scope_key = ds.scope_key
		WHERE ds.principal_type = ?
		  AND ds.principal_id = ?
	`

	var scope Scope

	err := sr.db.QueryRowContext(
		ctx,
		query,
		string(actor.Kind),
		actor.ID,
	).Scan(
		&scope.Key,
		&scope.Kind,
		&scope.OwnerSubjectKey,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			slog.Warn(
				"default scope not found for actor",
				"kind", actor.Kind,
				"id", actor.ID,
			)
			return nil, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, err)
		}

		slog.Error(
			"failed to resolve default scope",
			"error", err,
			"kind", actor.Kind,
			"id", actor.ID,
		)
		return nil, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, err)
	}

	return &scope, nil
}

func (sr *ScopeResolver) ResolveExplicitScope(ctx context.Context, actor Actor, scopeKey string) (*Scope, error) {
	if actor.Kind != ActorUser || actor.ID == "" {
		slog.Error(
			"actor is not a user or has no ID",
			"kind", actor.Kind,
			"id", actor.ID,
		)
		return nil, fmt.Errorf("%w: %v", ErrScopeResolutionFailed,
			fmt.Errorf("actor is not a user or has no ID"))
	}

	const query = `
		SELECT
			s.scope_key,
			s.kind,
			s.owner_subject_key
		FROM vfs_scopes AS s
		WHERE s.scope_key = ?
		AND s.owner_subject_key = ?
	`

	var scope Scope

	err := sr.db.QueryRowContext(
		ctx,
		query,
		scopeKey,
		actor.String(),
	).Scan(
		&scope.Key,
		&scope.Kind,
		&scope.OwnerSubjectKey,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			slog.Warn(
				"scope not found",
				"key", scopeKey,
			)
			return nil, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, err)
		}

		slog.Error(
			"failed to resolve scope",
			"error", err,
			"key", scopeKey,
		)
		return nil, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, err)
	}

	return &scope, nil
}
