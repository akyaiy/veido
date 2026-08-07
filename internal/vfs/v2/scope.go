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
	ID              string
	Kind            string
	Name            string
	OwnerSubjectKey common.SubjectKey
}

type ScopeResolverContract interface {
	ResolveScope(ctx context.Context, actor Actor, uri common.CanonURI) (Scope, error)
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

func (sr *ScopeResolver) ResolveScope(ctx context.Context, actor Actor, uri common.CanonURI) (Scope, error) {
	if !common.IsCanonURI(uri) {
		return Scope{}, common.ErrNotURI
	}

	if uri.HasScope() {
		return sr.ResolveExplicitScope(ctx, actor, uri.ScopeName())
	}

	return sr.DefaultScopeForActor(ctx, actor)
}

func (sr *ScopeResolver) DefaultScopeForActor(ctx context.Context, actor Actor) (Scope, error) {
	if actor.Kind != ActorUser || actor.ID == "" {
		slog.Error(
			"actor is not a user or has no ID",
			"kind", actor.Kind,
			"id", actor.ID,
		)
		return Scope{}, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, 
			fmt.Errorf("actor is not a user or has no ID"))
	}

	const query = `
		SELECT
			s.id,
			s.kind,
			s.name,
			s.owner_subject_key
		FROM vfs_principal_default_scopes AS ds
		JOIN vfs_scopes AS s
			ON s.id = ds.scope_id
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
		&scope.ID,
		&scope.Kind,
		&scope.Name,
		&scope.OwnerSubjectKey,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			slog.Warn(
				"default scope not found for actor",
				"kind", actor.Kind,
				"id", actor.ID,
			)
			return Scope{}, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, err)
		}

		slog.Error(
			"failed to resolve default scope",
			"error", err,
			"kind", actor.Kind,
			"id", actor.ID,
		)
		return Scope{}, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, err)
	}

	return scope, nil
}

func (sr *ScopeResolver) ResolveExplicitScope(ctx context.Context, actor Actor, scopeName string) (Scope, error) {
	if actor.Kind != ActorUser || actor.ID == "" {
		slog.Error(
			"actor is not a user or has no ID",
			"kind", actor.Kind,
			"id", actor.ID,
		)
		return Scope{}, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, 
			fmt.Errorf("actor is not a user or has no ID"))
	}

	const query = `
		SELECT
			s.id,
			s.kind,
			s.name,
			s.owner_subject_key
		FROM vfs_scopes AS s
		WHERE s.name = ?
	`

	var scope Scope

	err := sr.db.QueryRowContext(
		ctx,
		query,
		scopeName,
	).Scan(
		&scope.ID,
		&scope.Kind,
		&scope.Name,
		&scope.OwnerSubjectKey,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			slog.Warn(
				"scope not found",
				"name", scopeName,
			)
			return Scope{}, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, err)
		}

		slog.Error(
			"failed to resolve scope",
			"error", err,
			"name", scopeName,
		)
		return Scope{}, fmt.Errorf("%w: %v", ErrScopeResolutionFailed, err)
	}

	return scope, nil
}
