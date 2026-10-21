package vfs

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"io"
	"os"
)

type LocalFSProviderFileStream struct {
	ctx     context.Context
	db      *sql.DB
	storage StorageDriver
	node    Node
	fileID  string
	flag    int

	// Для чтения
	readCloser io.ReadCloser
	seekReader *bytes.Reader

	// Для записи
	parentDirID string
	name        string
	writeBuffer *bytes.Buffer
	isDirty     bool
}

func (s *LocalFSProviderFileStream) artifactHash() (string, error) {
	var hash string
	err := s.db.QueryRowContext(s.ctx, `
		SELECT a.hash FROM metadata m
		JOIN artifacts a ON m.artefact_id = a.id
		WHERE m.id = ? AND m.is_dir = 0`, s.fileID).Scan(&hash)
	if err != nil {
		return "", err
	}
	return hash, nil
}

func (s *LocalFSProviderFileStream) Read(p []byte) (int, error) {
	if s.seekReader != nil {
		return s.seekReader.Read(p)
	}
	if s.readCloser == nil {
		hash, err := s.artifactHash()
		if err != nil {
			return 0, fmt.Errorf("failed to get file hash for reading: %w", err)
		}

		rc, err := s.storage.Read(s.ctx, hash)
		if err != nil {
			return 0, err
		}
		s.readCloser = rc
	}
	return s.readCloser.Read(p)
}

func (s *LocalFSProviderFileStream) Write(p []byte) (int, error) {
	if s.writeBuffer == nil {
		s.writeBuffer = new(bytes.Buffer)
	}
	s.isDirty = true
	return s.writeBuffer.Write(p)
}

func (s *LocalFSProviderFileStream) Seek(offset int64, whence int) (int64, error) {
	if s.isDirty && s.writeBuffer != nil {
		if whence == io.SeekEnd && offset == 0 {
			return int64(s.writeBuffer.Len()), nil
		}
		return 0, fmt.Errorf("random seek during write is not supported")
	}

	if s.seekReader == nil {
		hash, err := s.artifactHash()
		if err != nil {
			return 0, err
		}
		if s.readCloser != nil {
			_ = s.readCloser.Close()
			s.readCloser = nil
		}
		rc, err := s.storage.Read(s.ctx, hash)
		if err != nil {
			return 0, err
		}
		defer rc.Close()

		data, err := io.ReadAll(rc)
		if err != nil {
			return 0, err
		}
		s.seekReader = bytes.NewReader(data)
	}
	return s.seekReader.Seek(offset, whence)
}

func (s *LocalFSProviderFileStream) Stat() (os.FileInfo, error) {
	return &FileInfo{n: s.node}, nil
}

func (s *LocalFSProviderFileStream) Close() error {
	if s.readCloser != nil {
		s.readCloser.Close()
	}

	// Если в файл писали — запускаем твою тяжелую логику сохранения в БД и CAS
	if s.isDirty && s.writeBuffer != nil {
		data := s.writeBuffer.Bytes()
		size := int64(len(data))

		h := sha256.New()
		h.Write(data)
		hash := fmt.Sprintf("%x", h.Sum(nil))

		tx, err := s.db.BeginTx(s.ctx, nil)
		if err != nil {
			return err
		}
		defer tx.Rollback()

		var parentDBValue any = s.parentDirID
		if s.parentDirID == "0" || s.parentDirID == "" {
			parentDBValue = nil
		}

		// Проверяем существование файла (перезапись)
		var existingMetadataID sql.NullInt64
		var oldHash sql.NullString
		if parentDBValue == nil {
			err = tx.QueryRowContext(s.ctx, `
				SELECT m.id, a.hash FROM metadata m
				LEFT JOIN artifacts a ON m.artefact_id = a.id
				WHERE m.parent_id IS NULL AND m.name = ? AND m.is_dir = 0`, s.name).Scan(&existingMetadataID, &oldHash)
		} else {
			err = tx.QueryRowContext(s.ctx, `
				SELECT m.id, a.hash FROM metadata m
				LEFT JOIN artifacts a ON m.artefact_id = a.id
				WHERE m.parent_id = ? AND m.name = ? AND m.is_dir = 0`, parentDBValue, s.name).Scan(&existingMetadataID, &oldHash)
		}

		isOverwrite := err == nil

		if isOverwrite && oldHash.Valid && oldHash.String == hash {
			tx.Rollback()
			return nil // Файл не изменился, выходим
		}

		// Сохраняем физический файл в CAS
		var artifactID int64
		err = tx.QueryRowContext(s.ctx, "SELECT id FROM artifacts WHERE hash = ?", hash).Scan(&artifactID)
		if err == sql.ErrNoRows {
			err = s.storage.Save(s.ctx, hash, bytes.NewReader(data))
			if err != nil {
				return err
			}
			res, err := tx.ExecContext(s.ctx, "INSERT INTO artifacts (hash, size, relations_count) VALUES (?, ?, 0)", hash, size)
			if err != nil {
				return err
			}
			artifactID, _ = res.LastInsertId()
		} else if err != nil {
			return err
		}

		// Обновляем метаданные
		if isOverwrite {
			_, err = tx.ExecContext(s.ctx, "DELETE FROM metadata WHERE id = ?", existingMetadataID.Int64)
			if err != nil {
				return err
			}
			_, err = tx.ExecContext(s.ctx, `
				INSERT INTO metadata (id, parent_id, name, is_dir, artefact_id, owner) 
				VALUES (?, ?, ?, 0, ?, ?)`, existingMetadataID.Int64, parentDBValue, s.name, artifactID, "current_user")
			if err != nil {
				return err
			}
		} else {
			_, err = tx.ExecContext(s.ctx, `
				INSERT INTO metadata (parent_id, name, is_dir, artefact_id, owner) 
				VALUES (?, ?, 0, ?, ?)`, parentDBValue, s.name, artifactID, "current_user")
			if err != nil {
				return err
			}
		}

		if err := tx.Commit(); err != nil {
			return err
		}
		s.isDirty = false
		s.writeBuffer = nil
	}
	return nil
}
