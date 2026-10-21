package auth

import (
	"context"
	"database/sql"

	"MyServer/internal/database/migrate"
)

func MigrationGroup() migrate.Group {
	return migrate.Group{
		Name: "auth",
		Migrations: []migrate.Migration{
			{Version: 1, Name: "users", Up: migrateUsers},
			{Version: 2, Name: "session_stores_compatibility", Up: migrateSessionStores},
			{Version: 3, Name: "whitelist_foreign_key", Up: migrateWhitelistForeignKey},
		},
	}
}

func migrateWhitelistForeignKey(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `SELECT "table", "from", "to" FROM pragma_foreign_key_list('whitelist')`)
	if err != nil {
		return err
	}
	hasUserFK := false
	for rows.Next() {
		var table, from, to string
		if err := rows.Scan(&table, &from, &to); err != nil {
			_ = rows.Close()
			return err
		}
		if table == "users" && from == "sub" && to == "id" {
			hasUserFK = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if hasUserFK {
		return nil
	}
	_, err = tx.ExecContext(ctx, `
		DROP INDEX IF EXISTS idx_whitelist_sub;
		ALTER TABLE whitelist RENAME TO whitelist_legacy;
		CREATE TABLE whitelist (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sub INTEGER NOT NULL,
			jti TEXT NOT NULL,
			UNIQUE(sub, jti),
			FOREIGN KEY (sub) REFERENCES users(id) ON DELETE CASCADE
		);
		INSERT INTO whitelist(id, sub, jti)
			SELECT id, sub, jti FROM whitelist_legacy;
		DROP TABLE whitelist_legacy;
		CREATE INDEX idx_whitelist_sub ON whitelist(sub)
	`)
	return err
}

func migrateUsers(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'unactive'
		)`)
	return err
}

// All three historical stores are preserved during the migration transition.
// Runtime uses sessions. Whitelist and refresh_tokens are preserved legacy
// stores until a separately audited migration can remove them.
func migrateSessionStores(ctx context.Context, tx *sql.Tx) error {
	_, err := tx.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS refresh_tokens (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			token TEXT UNIQUE NOT NULL,
			user_id INTEGER NOT NULL,
			expires_at INTEGER NOT NULL,
			FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
		);
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			refresh_token_hash TEXT NOT NULL,
			user_agent TEXT,
			ip_address TEXT,
			expires_at TIMESTAMP NOT NULL,
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			last_used_at TIMESTAMP,
			revoked BOOLEAN NOT NULL DEFAULT FALSE,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, revoked, expires_at);
		CREATE TABLE IF NOT EXISTS whitelist (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sub INTEGER NOT NULL,
			jti TEXT NOT NULL,
			UNIQUE(sub, jti),
			FOREIGN KEY (sub) REFERENCES users(id) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_whitelist_sub ON whitelist(sub)
	`)
	return err
}
