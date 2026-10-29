package sqliteDB

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/akyaiy/veido/internal/database/migrate"

	_ "github.com/mattn/go-sqlite3"
)

const DefaultBusyTimeout = 5 * time.Second

type Options struct {
	BusyTimeout  time.Duration
	MaxOpenConns int
}

// Open configures SQLite before it is handed to application code. The DSN
// options are applied by the driver to every physical connection in the pool.
func Open(ctx context.Context, path string, options Options) (*sql.DB, error) {
	if path == "" {
		return nil, errors.New("sqlite: empty database path")
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("sqlite: resolve path: %w", err)
	}
	directory := filepath.Dir(absolute)
	if err := os.MkdirAll(directory, 0o750); err != nil {
		return nil, fmt.Errorf("sqlite: create directory %q: %w", directory, err)
	}
	file, err := os.OpenFile(absolute, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("sqlite: create database file: %w", err)
	}
	if err := file.Close(); err != nil {
		return nil, fmt.Errorf("sqlite: close created database file: %w", err)
	}
	if options.BusyTimeout <= 0 {
		options.BusyTimeout = DefaultBusyTimeout
	}
	if options.MaxOpenConns <= 0 {
		options.MaxOpenConns = 8
	}

	query := url.Values{}
	query.Set("_busy_timeout", strconv.FormatInt(options.BusyTimeout.Milliseconds(), 10))
	query.Set("_foreign_keys", "on")
	query.Set("_journal_mode", "WAL")
	dsn := (&url.URL{Scheme: "file", Path: absolute, RawQuery: query.Encode()}).String()
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("sqlite: open: %w", err)
	}
	db.SetMaxOpenConns(options.MaxOpenConns)
	db.SetMaxIdleConns(options.MaxOpenConns)

	closeOnError := func(openErr error) (*sql.DB, error) {
		_ = db.Close()
		return nil, openErr
	}
	if err := db.PingContext(ctx); err != nil {
		return closeOnError(fmt.Errorf("sqlite: ping: %w", err))
	}
	if err := os.Chmod(absolute, 0o600); err != nil {
		return closeOnError(fmt.Errorf("sqlite: set database permissions: %w", err))
	}
	var foreignKeys int
	if err := db.QueryRowContext(ctx, `PRAGMA foreign_keys`).Scan(&foreignKeys); err != nil {
		return closeOnError(fmt.Errorf("sqlite: verify foreign keys: %w", err))
	}
	if foreignKeys != 1 {
		return closeOnError(errors.New("sqlite: foreign key enforcement is disabled"))
	}
	var journalMode string
	if err := db.QueryRowContext(ctx, `PRAGMA journal_mode`).Scan(&journalMode); err != nil {
		return closeOnError(fmt.Errorf("sqlite: verify journal mode: %w", err))
	}
	if journalMode != "wal" {
		return closeOnError(fmt.Errorf("sqlite: journal mode is %q, want wal", journalMode))
	}
	return db, nil
}

// InitDB is retained as a compatibility name for callers while initialization
// is moved to the composition root. It opens and verifies SQLite but creates no
// application tables.
func InitDB(path string) (*sql.DB, error) {
	return Open(context.Background(), path, Options{})
}

func MigrationGroup() migrate.Group {
	return migrate.Group{
		Name: "core/database",
		Migrations: []migrate.Migration{{
			Version: 1,
			Name:    "database_metadata",
			Up: func(ctx context.Context, tx *sql.Tx) error {
				_, err := tx.ExecContext(ctx, `
					CREATE TABLE IF NOT EXISTS database_metadata (
						key TEXT PRIMARY KEY,
						value TEXT NOT NULL,
						updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
					)`)
				return err
			},
		}},
	}
}
