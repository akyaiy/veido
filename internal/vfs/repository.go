package vfs

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

type Repository struct {
	db *sql.DB
}

func MustOpenRepository(dataSourceName string) *sql.DB {
	db, err := sql.Open("sqlite3", dataSourceName)
	if err != nil {
		panic(err)
	}
	return db
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Close() error {
	return r.db.Close()
}

func (r *Repository) AutoMigrate() error {
	_, err := r.db.Exec(`
	PRAGMA foreign_keys = ON;

	CREATE TABLE IF NOT EXISTS artifacts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hash TEXT NOT NULL UNIQUE,
		size INTEGER NOT NULL DEFAULT 0,
		relations_count INTEGER DEFAULT 0
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

	CREATE UNIQUE INDEX IF NOT EXISTS idx_metadata_parent_name 
	ON metadata(parent_id, name) WHERE parent_id IS NOT NULL;

	CREATE UNIQUE INDEX IF NOT EXISTS idx_metadata_root_name 
	ON metadata(name) WHERE parent_id IS NULL;

	CREATE TABLE IF NOT EXISTS mounts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		parent_metadata_id INTEGER NOT NULL UNIQUE,
		driver_type TEXT NOT NULL,
		config TEXT NOT NULL,
		FOREIGN KEY (parent_metadata_id) REFERENCES metadata(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS garbage_queue (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		hash TEXT NOT NULL,
		size INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TRIGGER IF NOT EXISTS increment_artefact_relations
	AFTER INSERT ON metadata
	FOR EACH ROW
	WHEN NEW.artefact_id IS NOT NULL
	BEGIN
		UPDATE artifacts 
		SET relations_count = relations_count + 1 
		WHERE id = NEW.artefact_id;
	END;

	CREATE TRIGGER IF NOT EXISTS decrement_or_queue_artefact
	AFTER DELETE ON metadata
	FOR EACH ROW
	WHEN OLD.artefact_id IS NOT NULL
	BEGIN
		UPDATE artifacts 
		SET relations_count = relations_count - 1 
		WHERE id = OLD.artefact_id;

		INSERT INTO garbage_queue (hash, size)
		SELECT hash, size FROM artifacts 
		WHERE id = OLD.artefact_id AND relations_count <= 0;

		DELETE FROM artifacts 
		WHERE id = OLD.artefact_id AND relations_count <= 0;
	END;

	CREATE TABLE IF NOT EXISTS global_locks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		path TEXT NOT NULL UNIQUE,
		token TEXT NOT NULL UNIQUE,
		owner_id TEXT NOT NULL,
		client_type TEXT NOT NULL,
		is_exclusive BOOLEAN NOT NULL,
		expires_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_locks_path ON global_locks(path);
	`)
	return err
}

// FIXME: This is a bit of a hack to allow access to the underlying DB for testing purposes. Consider refactoring to provide more specific methods for testing instead.
func (r *Repository) GetDB() *sql.DB {
	return r.db
}
