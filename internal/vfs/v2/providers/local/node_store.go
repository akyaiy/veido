package local

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type metadataNode struct {
	ID         int64
	ParentID   sql.NullInt64
	Name       string
	IsDir      bool
	Size       int64
	ArtifactID sql.NullInt64
	Hash       sql.NullString
	UpdatedAt  time.Time
}

type nodeStore struct {
	db *sql.DB
}

func newNodeStore(db *sql.DB) *nodeStore {
	return &nodeStore{db: db}
}

func (s *nodeStore) root(ctx context.Context, rootID int64) (*metadataNode, error) {
	node, err := s.byID(ctx, rootID)
	if err != nil {
		return nil, err
	}
	if !node.IsDir {
		return nil, fmt.Errorf("%w: local account root is not a directory", os.ErrInvalid)
	}
	return node, nil
}

func (s *nodeStore) byID(ctx context.Context, id int64) (*metadataNode, error) {
	var node metadataNode
	var updatedAt string
	err := s.db.QueryRowContext(ctx, `
		SELECT m.id, m.parent_id, m.name, m.is_dir, COALESCE(a.size, 0), m.artefact_id, a.hash, m.updated_at
		FROM metadata m
		LEFT JOIN artifacts a ON m.artefact_id = a.id
		WHERE m.id = ?`, id).Scan(
		&node.ID,
		&node.ParentID,
		&node.Name,
		&node.IsDir,
		&node.Size,
		&node.ArtifactID,
		&node.Hash,
		&updatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, os.ErrNotExist
	}
	if err != nil {
		return nil, err
	}
	node.UpdatedAt = parseDBTime(updatedAt)
	return &node, nil
}

func (s *nodeStore) child(ctx context.Context, parentID int64, name string) (*metadataNode, error) {
	var node metadataNode
	var updatedAt string
	err := s.db.QueryRowContext(ctx, `
		SELECT m.id, m.parent_id, m.name, m.is_dir, COALESCE(a.size, 0), m.artefact_id, a.hash, m.updated_at
		FROM metadata m
		LEFT JOIN artifacts a ON m.artefact_id = a.id
		WHERE m.parent_id = ? AND m.name = ?`, parentID, name).Scan(
		&node.ID,
		&node.ParentID,
		&node.Name,
		&node.IsDir,
		&node.Size,
		&node.ArtifactID,
		&node.Hash,
		&updatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, os.ErrNotExist
	}
	if err != nil {
		return nil, err
	}
	node.UpdatedAt = parseDBTime(updatedAt)
	return &node, nil
}

func (s *nodeStore) children(ctx context.Context, rootID int64, parentID int64) ([]*metadataNode, error) {
	if ok, err := s.isInsideRoot(ctx, rootID, parentID); err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, os.ErrPermission
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT m.id, m.parent_id, m.name, m.is_dir, COALESCE(a.size, 0), m.artefact_id, a.hash, m.updated_at
		FROM metadata m
		LEFT JOIN artifacts a ON m.artefact_id = a.id
		WHERE m.parent_id = ?
		ORDER BY m.is_dir DESC, lower(m.name), m.name`, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	nodes := make([]*metadataNode, 0)
	for rows.Next() {
		var node metadataNode
		var updatedAt string
		if err := rows.Scan(
			&node.ID,
			&node.ParentID,
			&node.Name,
			&node.IsDir,
			&node.Size,
			&node.ArtifactID,
			&node.Hash,
			&updatedAt,
		); err != nil {
			return nil, err
		}
		node.UpdatedAt = parseDBTime(updatedAt)
		nodes = append(nodes, &node)
	}
	return nodes, rows.Err()
}

func (s *nodeStore) stats(ctx context.Context, rootID int64) (*AccountStats, error) {
	if _, err := s.root(ctx, rootID); err != nil {
		return nil, err
	}

	stats := &AccountStats{}
	err := s.db.QueryRowContext(ctx, `
		WITH RECURSIVE tree(id, is_dir, artefact_id) AS (
			SELECT id, is_dir, artefact_id
			FROM metadata
			WHERE id = ?
			UNION ALL
			SELECT m.id, m.is_dir, m.artefact_id
			FROM metadata m
			JOIN tree t ON m.parent_id = t.id
		)
		SELECT
			COALESCE(SUM(CASE WHEN tree.is_dir = 0 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tree.is_dir = 1 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN tree.is_dir = 0 THEN a.size ELSE 0 END), 0),
			COALESCE((
				SELECT SUM(distinct_artifacts.size)
				FROM (
					SELECT DISTINCT artifacts.id, artifacts.size
					FROM tree
					JOIN artifacts ON artifacts.id = tree.artefact_id
				) distinct_artifacts
			), 0)
		FROM tree
		LEFT JOIN artifacts a ON a.id = tree.artefact_id`, rootID).Scan(
		&stats.Files,
		&stats.Directories,
		&stats.LogicalBytes,
		&stats.PhysicalBytes,
	)
	if err != nil {
		return nil, err
	}
	return stats, nil
}

func (s *nodeStore) createDir(ctx context.Context, rootID int64, parentID int64, name string, owner string) (*metadataNode, error) {
	if err := validateEntryName(name); err != nil {
		return nil, err
	}
	parent, err := s.byID(ctx, parentID)
	if err != nil {
		return nil, err
	}
	if !parent.IsDir {
		return nil, os.ErrInvalid
	}
	if ok, err := s.isInsideRoot(ctx, rootID, parentID); err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, os.ErrPermission
	}

	result, err := s.db.ExecContext(ctx, `
		INSERT INTO metadata (parent_id, name, is_dir, artefact_id, owner)
		VALUES (?, ?, 1, NULL, ?)`, parentID, name, owner)
	if isUniqueViolation(err) {
		return nil, os.ErrExist
	}
	if err != nil {
		return nil, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}
	return s.byID(ctx, id)
}

func (s *nodeStore) delete(ctx context.Context, rootID int64, id int64) error {
	if id == rootID {
		return os.ErrPermission
	}
	if ok, err := s.isInsideRoot(ctx, rootID, id); err != nil || !ok {
		if err != nil {
			return err
		}
		return os.ErrPermission
	}
	result, err := s.db.ExecContext(ctx, `DELETE FROM metadata WHERE id = ?`, id)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return os.ErrNotExist
	}
	return nil
}

func (s *nodeStore) move(ctx context.Context, rootID int64, id int64, targetParentID int64, newName string) error {
	if id == rootID {
		return os.ErrPermission
	}
	if err := validateEntryName(newName); err != nil {
		return err
	}
	targetParent, err := s.byID(ctx, targetParentID)
	if err != nil {
		return err
	}
	if !targetParent.IsDir {
		return os.ErrInvalid
	}
	if ok, err := s.isInsideRoot(ctx, rootID, id); err != nil || !ok {
		if err != nil {
			return err
		}
		return os.ErrPermission
	}
	if ok, err := s.isInsideRoot(ctx, rootID, targetParentID); err != nil || !ok {
		if err != nil {
			return err
		}
		return os.ErrPermission
	}
	if ok, err := s.isInsideRoot(ctx, id, targetParentID); err != nil || ok {
		if err != nil {
			return err
		}
		return os.ErrPermission
	}

	_, err = s.db.ExecContext(ctx, `
		UPDATE metadata
		SET parent_id = ?, name = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?`, targetParentID, newName, id)
	if isUniqueViolation(err) {
		return os.ErrExist
	}
	return err
}

func (s *nodeStore) saveFile(ctx context.Context, rootID int64, parentID int64, name string, owner string, data []byte, artifacts *artifactStore) (*metadataNode, error) {
	if err := validateEntryName(name); err != nil {
		return nil, err
	}
	parent, err := s.byID(ctx, parentID)
	if err != nil {
		return nil, err
	}
	if !parent.IsDir {
		return nil, os.ErrInvalid
	}
	if ok, err := s.isInsideRoot(ctx, rootID, parentID); err != nil || !ok {
		if err != nil {
			return nil, err
		}
		return nil, os.ErrPermission
	}

	artifactID, hash, size, err := artifacts.put(ctx, data)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	existingID, existingIsDir, err := childIDTx(ctx, tx, parentID, name)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if err == nil && existingIsDir {
		return nil, os.ErrExist
	}

	var id int64
	if err == nil {
		id = existingID
		if _, err := tx.ExecContext(ctx, `DELETE FROM metadata WHERE id = ?`, id); err != nil {
			return nil, err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO metadata (id, parent_id, name, is_dir, artefact_id, owner)
			VALUES (?, ?, ?, 0, ?, ?)`, id, parentID, name, artifactID, owner); err != nil {
			return nil, err
		}
	} else {
		result, err := tx.ExecContext(ctx, `
			INSERT INTO metadata (parent_id, name, is_dir, artefact_id, owner)
			VALUES (?, ?, 0, ?, ?)`, parentID, name, artifactID, owner)
		if isUniqueViolation(err) {
			return nil, os.ErrExist
		}
		if err != nil {
			return nil, err
		}
		id, err = result.LastInsertId()
		if err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	committed = true

	node, err := s.byID(ctx, id)
	if err != nil {
		return nil, err
	}
	node.Hash = sql.NullString{String: hash, Valid: true}
	node.Size = size
	return node, nil
}

func childIDTx(ctx context.Context, tx *sql.Tx, parentID int64, name string) (int64, bool, error) {
	var id int64
	var isDir bool
	err := tx.QueryRowContext(ctx,
		`SELECT id, is_dir FROM metadata WHERE parent_id = ? AND name = ?`,
		parentID,
		name,
	).Scan(&id, &isDir)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, os.ErrNotExist
	}
	return id, isDir, err
}

func (s *nodeStore) isInsideRoot(ctx context.Context, rootID int64, id int64) (bool, error) {
	for current := id; ; {
		if current == rootID {
			return true, nil
		}
		var parent sql.NullInt64
		err := s.db.QueryRowContext(ctx, `SELECT parent_id FROM metadata WHERE id = ?`, current).Scan(&parent)
		if errors.Is(err, sql.ErrNoRows) {
			return false, os.ErrNotExist
		}
		if err != nil {
			return false, err
		}
		if !parent.Valid {
			return false, nil
		}
		current = parent.Int64
	}
}

func nodeToVFS(node *metadataNode) *vfs.Node {
	if node == nil {
		return nil
	}
	kind := "file"
	if node.IsDir {
		kind = "dir"
	}
	return &vfs.Node{
		Name:      node.Name,
		Kind:      kind,
		IsDir:     node.IsDir,
		Size:      node.Size,
		UpdatedAt: node.UpdatedAt,
	}
}

func parseDBTime(value string) time.Time {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05", "2006-01-02T15:04:05Z07:00"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed
		}
	}
	return time.Now()
}

func validateEntryName(name string) error {
	name = strings.TrimSpace(name)
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "/\x00") {
		return os.ErrInvalid
	}
	return nil
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "unique")
}

func cleanLocalPath(resourcePath string) string {
	if resourcePath == "" || resourcePath == "." {
		return "/"
	}
	return filepath.ToSlash(filepath.Clean("/" + resourcePath))
}
