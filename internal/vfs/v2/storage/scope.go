package storage

import (
	"github.com/akyaiy/veido/internal/common"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

type ScopeStorageContract interface {
	Create(ctx context.Context, setOwner common.SubjectKey, scopeKey string) error
	Get(ctx context.Context, scopeKey string) (*vfs.Scope, error)
	List(ctx context.Context, subject common.SubjectKey) ([]*vfs.Scope, error)
	Delete(ctx context.Context, scopeKey string) error
	SetDefault(ctx context.Context, principal common.SubjectKey, scopeKey string) error
	GetDefault(ctx context.Context, principal common.SubjectKey) (*vfs.Scope, error)
}

type ScopeStorage struct {
	db *sql.DB
}

func NewScopeManager(db *sql.DB) (ScopeStorageContract, error) {
	if db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}
	return &ScopeStorage{db: db}, nil
}

func (s *ScopeStorage) Create(ctx context.Context, setOwner common.SubjectKey, scopeKey string) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	scopeKey = strings.TrimSpace(scopeKey)
	if scopeKey == "" {
		return WrapError(ErrScopeNotCreated, fmt.Errorf("%w: empty scope key", vfs.ErrInvalidScope))
	}

	ownerType := strings.TrimSpace(setOwner.Type())
	ownerID := strings.TrimSpace(setOwner.ID())
	if ownerType == "" || ownerID == "" {
		return WrapError(ErrScopeNotCreated, fmt.Errorf("%w: invalid owner subject key %q", vfs.ErrInvalidScope, setOwner))
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrScopeNotCreated, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const query = `
        INSERT INTO vfs_scopes (
            scope_key,
            kind,
            owner_subject_key
        )
        VALUES (?, ?, ?)
    `

	if _, err := tx.ExecContext(ctx, query, scopeKey, ownerType, setOwner.String()); err != nil {
		return WrapError(ErrScopeNotCreated, err)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrScopeNotCreated, err)
	}

	committed = true
	return nil
}

func (s *ScopeStorage) Get(ctx context.Context, scopeKey string) (*vfs.Scope, error) {
	if s == nil || s.db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	scopeKey = strings.TrimSpace(scopeKey)
	if scopeKey == "" {
		return nil, WrapError(ErrScopeNotFound, fmt.Errorf("%w: empty scope key", vfs.ErrInvalidScope))
	}

	const query = `
		SELECT
			scope_key,
			kind,
			owner_subject_key,
			updated_at
		FROM vfs_scopes
		WHERE scope_key = ?
	`

	var scope vfs.Scope
	err := s.db.QueryRowContext(ctx, query, scopeKey).Scan(
		&scope.Key,
		&scope.Kind,
		&scope.OwnerSubjectKey,
		&scope.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, WrapError(ErrScopeNotFound, err)
	}
	if err != nil {
		return nil, WrapError(ErrScopeNotFound, err)
	}

	return &scope, nil
}

func (s *ScopeStorage) List(ctx context.Context, subject common.SubjectKey) ([]*vfs.Scope, error) {
	if s == nil || s.db == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	ownerType := strings.TrimSpace(subject.Type())
	ownerID := strings.TrimSpace(subject.ID())
	if ownerType == "" || ownerID == "" {
		return nil, WrapError(ErrScopesNotListed, fmt.Errorf("%w: invalid subject key %q", vfs.ErrInvalidScope, subject))
	}

	const query = `
		SELECT
			scope_key,
			kind,
			owner_subject_key,
			updated_at
		FROM vfs_scopes
		WHERE owner_subject_key = ?
	`

	rows, err := s.db.QueryContext(ctx, query, subject.String())
	if err != nil {
		return nil, WrapError(ErrScopesNotListed, err)
	}
	defer rows.Close()

	scopes := make([]*vfs.Scope, 0)
	for rows.Next() {
		var scope vfs.Scope
		if err := rows.Scan(&scope.Key, &scope.Kind, &scope.OwnerSubjectKey, &scope.UpdatedAt); err != nil {
			return nil, WrapError(ErrScopesNotListed, err)
		}
		scopes = append(scopes, &scope)
	}
	if err := rows.Err(); err != nil {
		return nil, WrapError(ErrScopesNotListed, err)
	}

	return scopes, nil
}

func (s *ScopeStorage) Delete(ctx context.Context, scopeKey string) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	scopeKey = strings.TrimSpace(scopeKey)
	if scopeKey == "" {
		return WrapError(ErrScopeNotDeleted, fmt.Errorf("%w: empty scope key", vfs.ErrInvalidScope))
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrScopeNotDeleted, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const query = `
		DELETE FROM vfs_scopes
		WHERE scope_key = ?
	`

	result, err := tx.ExecContext(ctx, query, scopeKey)
	if err != nil {
		return WrapError(ErrScopeNotDeleted, err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return WrapError(ErrScopeNotDeleted, err)
	}
	if affected == 0 {
		return WrapError(ErrScopeNotDeleted, ErrScopeNotFound)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrScopeNotDeleted, err)
	}

	committed = true
	return nil
}

func (s *ScopeStorage) SetDefault(ctx context.Context, principal common.SubjectKey, scopeKey string) error {
	if s == nil || s.db == nil {
		return vfs.ErrInvalidNewInstanceParams
	}

	principalType := strings.TrimSpace(principal.Type())
	principalID := strings.TrimSpace(principal.ID())
	if principalType == "" || principalID == "" {
		return WrapError(ErrDefaultNotSet, fmt.Errorf("%w: invalid principal key %q", vfs.ErrInvalidScope, principal))
	}

	scopeKey = strings.TrimSpace(scopeKey)
	if scopeKey == "" {
		return WrapError(ErrDefaultNotSet, fmt.Errorf("%w: empty scope key", vfs.ErrInvalidScope))
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return WrapError(ErrDefaultNotSet, err)
	}

	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const ensureScopeQuery = `
		SELECT 1
		FROM vfs_scopes
		WHERE scope_key = ?
	`
	var exists int
	err = tx.QueryRowContext(ctx, ensureScopeQuery, scopeKey).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return WrapError(ErrDefaultNotSet, ErrScopeNotFound)
	}
	if err != nil {
		return WrapError(ErrDefaultNotSet, err)
	}

	const deleteQuery = `
		DELETE FROM vfs_principal_default_scopes
		WHERE principal_type = ?
		  AND principal_id = ?
	`
	if _, err := tx.ExecContext(ctx, deleteQuery, principalType, principalID); err != nil {
		return WrapError(ErrDefaultNotSet, err)
	}

	const insertQuery = `
		INSERT INTO vfs_principal_default_scopes (
			principal_type,
			principal_id,
			scope_key
		)
		VALUES (?, ?, ?)
	`
	if _, err := tx.ExecContext(ctx, insertQuery, principalType, principalID, scopeKey); err != nil {
		return WrapError(ErrDefaultNotSet, err)
	}

	if err := tx.Commit(); err != nil {
		return WrapError(ErrDefaultNotSet, err)
	}

	committed = true
	return nil
}

func (s *ScopeStorage) GetDefault(ctx context.Context, principal common.SubjectKey) (*vfs.Scope, error) {
	const query = `
		SELECT scope_key
		FROM vfs_principal_default_scopes
		WHERE principal_type = ?
		  AND principal_id = ?
	`
	var scopeKey string
	err := s.db.QueryRowContext(ctx, query, principal.Type(), principal.ID()).Scan(&scopeKey)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	scope, err := s.Get(ctx, scopeKey)
	if err != nil {
		return nil, err
	}

	return scope, nil
}
