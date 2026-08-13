package local

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"io"
)

type artifactStore struct {
	db      *sql.DB
	storage StorageDriver
}

func newArtifactStore(db *sql.DB, storage StorageDriver) *artifactStore {
	return &artifactStore{db: db, storage: storage}
}

func (s *artifactStore) put(ctx context.Context, data []byte) (id int64, hash string, size int64, err error) {
	sum := sha256.Sum256(data)
	hash = hex.EncodeToString(sum[:])
	size = int64(len(data))

	err = s.db.QueryRowContext(ctx, `SELECT id FROM artifacts WHERE hash = ?`, hash).Scan(&id)
	if err == nil {
		return id, hash, size, nil
	}
	if err != sql.ErrNoRows {
		return 0, "", 0, err
	}

	exists, err := s.storage.Exists(ctx, hash)
	if err != nil {
		return 0, "", 0, err
	}
	if !exists {
		if err := s.storage.Save(ctx, hash, bytes.NewReader(data)); err != nil {
			return 0, "", 0, err
		}
	}

	result, err := s.db.ExecContext(ctx,
		`INSERT INTO artifacts (hash, size, relations_count) VALUES (?, ?, 0)`,
		hash,
		size,
	)
	if err != nil {
		return 0, "", 0, err
	}
	id, err = result.LastInsertId()
	if err != nil {
		return 0, "", 0, err
	}
	return id, hash, size, nil
}

func (s *artifactStore) readAll(ctx context.Context, hash string) ([]byte, error) {
	reader, err := s.storage.Read(ctx, hash)
	if err != nil {
		return nil, err
	}
	defer reader.Close()
	return io.ReadAll(reader)
}
