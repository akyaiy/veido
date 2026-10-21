// Package migrate provides ordered, transactional schema migrations.
package migrate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
)

const migrationTable = "schema_migrations"

type Migration struct {
	Version int
	Name    string
	Up      func(context.Context, *sql.Tx) error
}

type Group struct {
	Name       string
	Migrations []Migration
}

type Applied struct {
	Group   string
	Version int
	Name    string
}

var ErrNewerSchema = errors.New("database schema is newer than this binary")

// Run applies groups and migrations in the supplied order. Each migration and
// its version record are committed atomically in one transaction.
func Run(ctx context.Context, db *sql.DB, groups ...Group) error {
	if db == nil {
		return errors.New("migrate: nil database")
	}
	if err := validateGroups(groups); err != nil {
		return err
	}
	if err := ensureTable(ctx, db); err != nil {
		return err
	}

	for _, group := range groups {
		applied, err := appliedForGroup(ctx, db, group.Name)
		if err != nil {
			return err
		}
		known := make(map[int]Migration, len(group.Migrations))
		for _, migration := range group.Migrations {
			known[migration.Version] = migration
		}
		for version, record := range applied {
			migration, ok := known[version]
			if !ok {
				return fmt.Errorf("%w: group %q has applied version %d", ErrNewerSchema, group.Name, version)
			}
			if record.Name != migration.Name {
				return fmt.Errorf("migrate: group %q version %d name mismatch: database=%q binary=%q", group.Name, version, record.Name, migration.Name)
			}
		}
		for index, migration := range group.Migrations {
			_, isApplied := applied[migration.Version]
			if index < len(applied) && !isApplied {
				return fmt.Errorf("migrate: group %q has non-contiguous history before version %d", group.Name, migration.Version)
			}
			if index >= len(applied) && isApplied {
				return fmt.Errorf("migrate: group %q has non-contiguous history at version %d", group.Name, migration.Version)
			}
		}

		for _, migration := range group.Migrations {
			if _, ok := applied[migration.Version]; ok {
				continue
			}
			if err := applyOne(ctx, db, group.Name, migration); err != nil {
				return err
			}
		}
	}
	return nil
}

func AppliedMigrations(ctx context.Context, db *sql.DB) ([]Applied, error) {
	if db == nil {
		return nil, errors.New("migrate: nil database")
	}
	if err := ensureTable(ctx, db); err != nil {
		return nil, err
	}
	rows, err := db.QueryContext(ctx, `SELECT group_name, version, name FROM schema_migrations ORDER BY group_name, version`)
	if err != nil {
		return nil, fmt.Errorf("migrate: list applied migrations: %w", err)
	}
	defer rows.Close()
	var result []Applied
	for rows.Next() {
		var item Applied
		if err := rows.Scan(&item.Group, &item.Version, &item.Name); err != nil {
			return nil, fmt.Errorf("migrate: scan applied migration: %w", err)
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("migrate: list applied migrations: %w", err)
	}
	return result, nil
}

func ensureTable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			group_name TEXT NOT NULL,
			version INTEGER NOT NULL CHECK (version > 0),
			name TEXT NOT NULL,
			applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (group_name, version)
		)`)
	if err != nil {
		return fmt.Errorf("migrate: initialize version table: %w", err)
	}
	return nil
}

func appliedForGroup(ctx context.Context, db *sql.DB, group string) (map[int]Applied, error) {
	rows, err := db.QueryContext(ctx, `SELECT version, name FROM schema_migrations WHERE group_name = ? ORDER BY version`, group)
	if err != nil {
		return nil, fmt.Errorf("migrate: read group %q: %w", group, err)
	}
	defer rows.Close()
	result := make(map[int]Applied)
	for rows.Next() {
		var item Applied
		item.Group = group
		if err := rows.Scan(&item.Version, &item.Name); err != nil {
			return nil, fmt.Errorf("migrate: scan group %q: %w", group, err)
		}
		result[item.Version] = item
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("migrate: read group %q: %w", group, err)
	}
	return result, nil
}

func applyOne(ctx context.Context, db *sql.DB, group string, migration Migration) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("migrate: begin %s/%d: %w", group, migration.Version, err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()
	if err := migration.Up(ctx, tx); err != nil {
		return fmt.Errorf("migrate: apply %s/%d (%s): %w", group, migration.Version, migration.Name, err)
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations(group_name, version, name) VALUES (?, ?, ?)`, group, migration.Version, migration.Name); err != nil {
		return fmt.Errorf("migrate: record %s/%d: %w", group, migration.Version, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("migrate: commit %s/%d: %w", group, migration.Version, err)
	}
	committed = true
	return nil
}

func validateGroups(groups []Group) error {
	seenGroups := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		if strings.TrimSpace(group.Name) == "" {
			return errors.New("migrate: empty group name")
		}
		if _, exists := seenGroups[group.Name]; exists {
			return fmt.Errorf("migrate: duplicate group %q", group.Name)
		}
		seenGroups[group.Name] = struct{}{}
		versions := make([]int, 0, len(group.Migrations))
		seenVersions := make(map[int]struct{}, len(group.Migrations))
		for _, migration := range group.Migrations {
			if migration.Version <= 0 || strings.TrimSpace(migration.Name) == "" || migration.Up == nil {
				return fmt.Errorf("migrate: invalid migration in group %q", group.Name)
			}
			if _, exists := seenVersions[migration.Version]; exists {
				return fmt.Errorf("migrate: duplicate version %d in group %q", migration.Version, group.Name)
			}
			seenVersions[migration.Version] = struct{}{}
			versions = append(versions, migration.Version)
		}
		if !sort.IntsAreSorted(versions) {
			return fmt.Errorf("migrate: migrations in group %q are not ordered", group.Name)
		}
		for index, version := range versions {
			if version != index+1 {
				return fmt.Errorf("migrate: group %q versions must be contiguous from 1", group.Name)
			}
		}
	}
	return nil
}
