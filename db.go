package main

import (
	"database/sql"
	"log"
	"time"
)

func InitDB(path string) *sql.DB {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		log.Fatal(err)
	}

	stmt := `
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL
	);
	CREATE TABLE IF NOT EXISTS refresh_tokens (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		token TEXT UNIQUE NOT NULL,
		user_id INTEGER NOT NULL,
		expires_at INTEGER NOT NULL,
		FOREIGN KEY(user_id) REFERENCES users(id)
	);`
	_, err = db.Exec(stmt)
	if err != nil {
		log.Fatal(err)
	}

	CleanRefresh(db)

	return db
}

func CleanRefresh(db *sql.DB) {
	// Example cleanup call (one-time): remove expired tokens
	_, _ = db.Exec("DELETE FROM refresh_tokens WHERE expires_at <= ?", time.Now().Unix())

}
