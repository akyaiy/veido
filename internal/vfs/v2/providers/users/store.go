package users

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var ErrProfileNotFound = errors.New("users profile not found")

type Store interface {
	Get(context.Context, string) (*Profile, error)
	Put(context.Context, string, ProfileUpdate) (*Profile, error)
}

type SQLiteStore struct{ db *sql.DB }

func NewSQLiteStore(db *sql.DB) (*SQLiteStore, error) {
	if db == nil {
		return nil, errors.New("users store: database is required")
	}
	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) Get(ctx context.Context, userID string) (*Profile, error) {
	var profile Profile
	err := s.db.QueryRowContext(ctx, `SELECT user_id, display_name, locale, timezone, created_at, updated_at
		FROM user_profiles WHERE user_id = ?`, strings.TrimSpace(userID)).Scan(
		&profile.UserID, &profile.DisplayName, &profile.Locale, &profile.Timezone, &profile.CreatedAt, &profile.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrProfileNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("read users profile: %w", err)
	}
	return &profile, nil
}

func (s *SQLiteStore) Put(ctx context.Context, userID string, update ProfileUpdate) (*Profile, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, errors.New("users profile: user ID is required")
	}
	update.DisplayName = strings.TrimSpace(update.DisplayName)
	update.Locale = strings.TrimSpace(update.Locale)
	update.Timezone = strings.TrimSpace(update.Timezone)
	if len(update.DisplayName) > 128 || len(update.Locale) > 32 || len(update.Timezone) > 64 {
		return nil, errors.New("users profile: field is too long")
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO user_profiles(user_id, display_name, locale, timezone)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name,
		locale = excluded.locale, timezone = excluded.timezone, updated_at = CURRENT_TIMESTAMP`,
		userID, update.DisplayName, update.Locale, update.Timezone)
	if err != nil {
		return nil, fmt.Errorf("write users profile: %w", err)
	}
	return s.Get(ctx, userID)
}

var _ Store = (*SQLiteStore)(nil)
