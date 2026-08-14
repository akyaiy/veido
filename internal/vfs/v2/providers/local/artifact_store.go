package local

import (
	"context"
	"database/sql"
)

type artifactStore struct {
	db      *sql.DB
	storage StorageDriver
}

func newArtifactStore(db *sql.DB, storage StorageDriver) *artifactStore {
	return &artifactStore{db: db, storage: storage}
}

type artifactWriter interface {
	Write(p []byte) (int, error)
	Close() error
	Commit(ctx context.Context) (artifactID int64, hash string, size int64, err error)
	Abort() error
}

type storageArtifactWriter struct {
	store  *artifactStore
	writer StorageWriter
}

func (s *artifactStore) createWriter(ctx context.Context) (artifactWriter, error) {
	writer, err := s.storage.Create(ctx)
	if err != nil {
		return nil, err
	}
	return &storageArtifactWriter{store: s, writer: writer}, nil
}

func (s *artifactStore) open(ctx context.Context, hash string) (StorageFile, error) {
	return s.storage.Open(ctx, hash)
}

func (w *storageArtifactWriter) Write(p []byte) (int, error) {
	return w.writer.Write(p)
}

func (w *storageArtifactWriter) Close() error {
	return w.writer.Close()
}

func (w *storageArtifactWriter) Abort() error {
	return w.writer.Abort()
}

func (w *storageArtifactWriter) Commit(ctx context.Context) (int64, string, int64, error) {
	hash, size, err := w.writer.Commit(ctx)
	if err != nil {
		return 0, "", 0, err
	}
	id, err := w.store.registerCommitted(ctx, hash, size)
	if err != nil {
		return 0, "", 0, err
	}
	return id, hash, size, nil
}

func (s *artifactStore) registerCommitted(ctx context.Context, hash string, size int64) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx, `SELECT id FROM artifacts WHERE hash = ?`, hash).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}

	exists, err := s.storage.Exists(ctx, hash)
	if err != nil {
		return 0, err
	}
	if !exists {
		return 0, sql.ErrNoRows
	}

	result, err := s.db.ExecContext(ctx,
		`INSERT INTO artifacts (hash, size, relations_count) VALUES (?, ?, 0)`,
		hash,
		size,
	)
	if err != nil {
		return 0, err
	}
	id, err = result.LastInsertId()
	if err != nil {
		return 0, err
	}
	return id, nil
}
