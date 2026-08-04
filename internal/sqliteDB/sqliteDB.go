package sqliteDB

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"time"
)

func InitDB(path string) *sql.DB {
	dirpath := filepath.Dir(path)
	err := os.MkdirAll(dirpath, 0777)
	if err != nil {
		panic(err)
	}
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		log.Fatal(err)
	}

	stmt := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'unactive'
	);
	CREATE TABLE IF NOT EXISTS refresh_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token TEXT UNIQUE NOT NULL,
		user_id INTEGER NOT NULL,
		expires_at INTEGER NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id)
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
	CREATE TABLE IF NOT EXISTS whitelist (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sub INTEGER NOT NULL,
		jti TEXT NOT NULL,
		UNIQUE(sub, jti)
		FOREIGN KEY (sub) REFERENCES users(id) ON DELETE CASCADE
	);
	CREATE TABLE IF NOT EXISTS "shares" (
		"id"	INTEGER,
		"from_id"	INTEGER,
		"to_id"	INTEGER,
		"resource_id"	TEXT,
		PRIMARY KEY("id" AUTOINCREMENT),
		FOREIGN KEY("from_id") REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY("to_id") REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS artifacts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hash TEXT NOT NULL UNIQUE,
		size INTEGER NOT NULL DEFAULT 0,
		relations_count INTEGER DEFAULT 0
	);
	
	CREATE TABLE IF NOT EXISTS garbage_queue (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hash TEXT NOT NULL,
		size INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	
	CREATE TABLE IF NOT EXISTS global_locks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		path TEXT NOT NULL UNIQUE,
		token TEXT NOT NULL UNIQUE,
		owner_id TEXT NOT NULL,
		client_type TEXT NOT NULL,
		is_exclusive BOOLEAN NOT NULL,
		expires_at DATETIME NOT NULL
	);
	
	CREATE TABLE IF NOT EXISTS metadata (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		parent_id INTEGER REFERENCES metadata(id) ON DELETE CASCADE,
		name TEXT NOT NULL,
		is_dir BOOLEAN NOT NULL DEFAULT 0,
		owner TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		artefact_id INTEGER,
		FOREIGN KEY (artefact_id) REFERENCES artifacts(id) ON DELETE SET NULL
	);
	
	CREATE TABLE IF NOT EXISTS mounts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		parent_metadata_id INTEGER NOT NULL UNIQUE,
		driver_type TEXT NOT NULL,
		config TEXT NOT NULL,
		FOREIGN KEY (parent_metadata_id) REFERENCES metadata(id) ON DELETE CASCADE
	);
	
	CREATE INDEX IF NOT EXISTS idx_locks_path ON global_locks(path);
	
	CREATE UNIQUE INDEX IF NOT EXISTS idx_metadata_parent_name ON metadata(parent_id, name) WHERE parent_id IS NOT NULL;
	
	CREATE UNIQUE INDEX IF NOT EXISTS idx_metadata_root_name ON metadata(name) WHERE parent_id IS NULL;

	-- VFS v2 tables
	CREATE TABLE IF NOT EXISTS vfs_scopes (
	    id TEXT PRIMARY KEY,
	    kind TEXT NOT NULL,
	    name TEXT NOT NULL,
	    owner_subject_key TEXT NOT NULL,
	    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		
	    UNIQUE(kind, name)
	);
	
	CREATE TABLE IF NOT EXISTS vfs_provider_connections (
	    id TEXT PRIMARY KEY,
	    scope_id TEXT NOT NULL,
	    provider TEXT NOT NULL,
	    connection_name TEXT NOT NULL,
	    config_json TEXT NOT NULL DEFAULT '{}',
	    status TEXT NOT NULL DEFAULT 'active',
	    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		
	    FOREIGN KEY (scope_id) REFERENCES vfs_scopes(id) ON DELETE CASCADE,
	    UNIQUE(scope_id, provider, connection_name)
	);
	
	CREATE TABLE IF NOT EXISTS vfs_principal_default_scopes (
    	principal_type TEXT NOT NULL,
     	principal_id TEXT NOT NULL,
      	provider TEXT NOT NULL,
       	connection_name TEXT NOT NULL,
        scope_id TEXT NOT NULL,
	
	    PRIMARY KEY (principal_type, principal_id, provider, connection_name),
	    FOREIGN KEY (scope_id) REFERENCES vfs_scopes(id) ON DELETE CASCADE
	);
	`
	_, err = db.Exec(stmt)
	if err != nil {
		log.Fatal(err)
	}

	CleanRefresh(db)

	return db
}

func CleanRefresh(db *sql.DB) {
	_, _ = db.Exec("DELETE FROM refresh_tokens WHERE expires_at <= ?", time.Now().Unix())
}
