package vfs

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type LockParam struct {
	Path       string
	Owner      string
	ClientType string // "webdav", "api", "cron"
	Exclusive  bool
	TTL        time.Duration
}

type InternalLockSystem interface {
	AcquireLock(ctx context.Context, param LockParam) (string, error)
	ReleaseLock(ctx context.Context, token string) error
	IsLocked(ctx context.Context, path string) (bool, error)
	ExtendLock(ctx context.Context, path string, token string, ttl time.Duration) error
}

type DBLockSystem struct {
	db *sql.DB
	// TODO: Можно добавить кэш для ускорения проверки блокировок, но нужно будет следить за его консистентностью
}

func NewDBLockSystem(db *sql.DB) InternalLockSystem {
	return &DBLockSystem{db: db}
}

func (lm *DBLockSystem) isLocked(ctx context.Context, runner interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}, path string, token string) (bool, error) {
	// if token not empty, check if there's a lock with this specific token
	if token != "" {
		var exists bool
		err := runner.QueryRowContext(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM global_locks 
				WHERE path = ? AND token = ? AND expires_at > CURRENT_TIMESTAMP
			)`, path, token,
		).Scan(&exists)
		return exists, err
	}

	// Если токен пустой, проверяем просто наличие любого живого лока на этот path
	var exists bool
	err := runner.QueryRowContext(ctx, 
		"SELECT EXISTS(SELECT 1 FROM global_locks WHERE path = ? AND expires_at > CURRENT_TIMESTAMP)", 
		path,
	).Scan(&exists)
	return exists, err
}

// AcquireLock implements [InternalLockSystem].
func (lm *DBLockSystem) AcquireLock(ctx context.Context, param LockParam) (string, error) {
	param.Path = filepath.Clean("/" + param.Path)

	tx, err := lm.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	_, _ = tx.ExecContext(ctx, "DELETE FROM global_locks WHERE expires_at < CURRENT_TIMESTAMP")

	locked, err := lm.isLocked(ctx, tx, param.Path, "")
	if err != nil {
		return "", err
	}
	if locked {
		return "", ErrAlreadyLocked
	}

	var token string
	if param.ClientType == "webdav" {
		uuidToken, err := uuid.NewRandom()
		if err != nil {
			return "", fmt.Errorf("failed to generate lock token: %w", err)
		}
		token = "opaquelocktoken:" + uuidToken.String() // WebDAV requires tokens to be in this format
	} else {
		token = fmt.Sprintf("lock:%s:%d", param.ClientType, time.Now().UnixNano())
	}
	ttl := param.TTL
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	expiresAt := time.Now().Add(ttl)

	_, err = tx.ExecContext(ctx, `
		INSERT INTO global_locks (path, token, owner_id, client_type, is_exclusive, expires_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		param.Path, token, param.Owner, param.ClientType, param.Exclusive, expiresAt,
	)
	if err != nil {
		return "", err
	}

	return token, tx.Commit()
}

func (lm *DBLockSystem) ExtendLock(ctx context.Context, path string, token string, ttl time.Duration) error {
	tx, err := lm.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin extend transaction: %w", err)
	}
	defer tx.Rollback()

	_, _ = tx.ExecContext(ctx, "DELETE FROM global_locks WHERE expires_at < CURRENT_TIMESTAMP")

	var exists bool
	err = tx.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM global_locks 
			WHERE path = ? AND token = ? AND expires_at > CURRENT_TIMESTAMP
		)`, 
		path, token,
	).Scan(&exists)
	
	if err != nil {
		return fmt.Errorf("failed to verify lock: %w", err)
	}

	if !exists {
		return ErrAlreadyLocked
	}

	// TODO: add configurable max TTL to prevent too long extensions
	if ttl <= 0 {
		ttl = 15 * time.Minute
	}
	newExpiresAt := time.Now().Add(ttl)

	_, err = tx.ExecContext(ctx, `
		UPDATE global_locks 
		SET expires_at = ? 
		WHERE token = ?`, 
		newExpiresAt, token,
	)
	if err != nil {
		return fmt.Errorf("failed to extend lock time: %w", err)
	}

	return tx.Commit()
}

// IsLocked implements [InternalLockSystem].
func (lm *DBLockSystem) IsLocked(ctx context.Context, path string) (bool, error) {
	_, _ = lm.db.ExecContext(ctx, "DELETE FROM global_locks WHERE expires_at < CURRENT_TIMESTAMP")
	return lm.isLocked(ctx, lm.db, path, "")
}

// ReleaseLock implements [InternalLockSystem].
func (lm *DBLockSystem) ReleaseLock(ctx context.Context, token string) error {
     res, err := lm.db.ExecContext(ctx, "DELETE FROM global_locks WHERE token = ?", token)
     if err != nil {
          return fmt.Errorf("failed to release lock: %w", err)
     }

     _, err = res.RowsAffected()
     if err != nil {
          return err
     }

     return nil
}

var ErrAlreadyLocked = errors.New("resource is temporarily locked")