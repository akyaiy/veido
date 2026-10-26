// Package v2 implements the sparse-tree ACLv2 evaluator and its storage.
package v2

import (
	"context"
	"database/sql"

	"MyServer/internal/database/migrate"
)

func MigrationGroup() migrate.Group {
	return migrate.Group{Name: "acl/v2", Migrations: []migrate.Migration{
		{Version: 1, Name: "sparse_namespace", Up: migrateSparseNamespace},
		{Version: 2, Name: "protected_rules", Up: migrateProtectedRules},
	}}
}

func migrateProtectedRules(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `ALTER TABLE acl_rules ADD COLUMN protected INTEGER NOT NULL DEFAULT 0 CHECK (protected IN (0, 1))`)
	return err
}

func migrateSparseNamespace(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `
		CREATE TABLE acl_namespace_roots (
			root_id INTEGER PRIMARY KEY AUTOINCREMENT,
			provider_key TEXT NOT NULL,
			connection_key TEXT NOT NULL,
			scope_key TEXT NOT NULL,
			state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'disabled')),
			namespace_revision INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (provider_key, connection_key, scope_key)
		);
		CREATE TABLE acl_path_nodes (
			node_id INTEGER PRIMARY KEY AUTOINCREMENT,
			root_id INTEGER NOT NULL,
			parent_id INTEGER,
			segment TEXT NOT NULL,
			segment_key TEXT NOT NULL,
			state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'moving', 'deleted')),
			node_revision INTEGER NOT NULL DEFAULT 1,
			created_operation_id TEXT,
			deleted_operation_id TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			UNIQUE (root_id, node_id),
			FOREIGN KEY (root_id) REFERENCES acl_namespace_roots(root_id),
			FOREIGN KEY (root_id, parent_id) REFERENCES acl_path_nodes(root_id, node_id),
			CHECK (parent_id IS NULL OR parent_id <> node_id)
		);
		CREATE UNIQUE INDEX uq_acl_root_child ON acl_path_nodes(root_id, segment_key)
			WHERE parent_id IS NULL AND state = 'active';
		CREATE UNIQUE INDEX uq_acl_node_child ON acl_path_nodes(root_id, parent_id, segment_key)
			WHERE parent_id IS NOT NULL AND state = 'active';
		CREATE INDEX idx_acl_nodes_parent ON acl_path_nodes(root_id, parent_id, state);
		CREATE TABLE acl_rules (
			rule_id INTEGER PRIMARY KEY AUTOINCREMENT,
			node_id INTEGER NOT NULL,
			subject_key TEXT NOT NULL,
			action TEXT NOT NULL CHECK (action IN ('r', 'w', 'x')),
			effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
			priority INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 1 AND 100),
			recursive INTEGER NOT NULL DEFAULT 0 CHECK (recursive IN (0, 1)),
			created_by_actor TEXT NOT NULL,
			manager_subject_key TEXT NOT NULL,
			manager_mode TEXT NOT NULL DEFAULT 'full' CHECK (manager_mode IN ('full', 'narrow_only')),
			state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'locked')),
			rule_revision INTEGER NOT NULL DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (node_id) REFERENCES acl_path_nodes(node_id),
			UNIQUE (node_id, subject_key, action)
		);
		CREATE TABLE acl_lifecycle_operations (
			operation_id TEXT PRIMARY KEY,
			root_id INTEGER NOT NULL,
			sequence INTEGER NOT NULL,
			kind TEXT NOT NULL CHECK (kind IN ('create', 'rename', 'move', 'delete', 'resync')),
			source_node_id INTEGER,
			source_parent_id INTEGER,
			target_parent_id INTEGER,
			old_segment TEXT,
			new_segment TEXT,
			expected_node_revision INTEGER,
			state TEXT NOT NULL CHECK (state IN ('prepared', 'provider_committed', 'acl_committed', 'aborted', 'recovery')),
			actor_key TEXT NOT NULL,
			provider_event_id TEXT,
			provider_revision TEXT,
			error_code TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (root_id) REFERENCES acl_namespace_roots(root_id),
			UNIQUE (root_id, sequence)
		);
		CREATE INDEX idx_acl_lifecycle_provider_event ON acl_lifecycle_operations(provider_event_id);
		CREATE INDEX idx_acl_lifecycle_incomplete ON acl_lifecycle_operations(root_id, state, sequence);
	`)
	return err
}
