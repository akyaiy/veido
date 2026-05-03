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
