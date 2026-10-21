package vfs

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type FSProvider interface {
	ResolvePathToID(ctx context.Context, path string) (string, error)

	ReadDir(ctx context.Context, dirID string) ([]Node, error)
	OpenFile(ctx context.Context, fileID string, parentDirID, name string, flag int) (File, error)
	Stat(ctx context.Context, id string) (Node, error)

	Mkdir(ctx context.Context, parentDirID, name string) (Node, error)
	//SaveFile(ctx context.Context, parentDirID, name string, src io.Reader) (Node, error)
	Move(ctx context.Context, id string, newParentID string, newName string) error
	Delete(ctx context.Context, id string) error
}

type LocalFSProvider struct {
	db      *sql.DB
	storage StorageDriver
}

func NewLocalFSProvider(db *sql.DB, storage StorageDriver) FSProvider {
	return &LocalFSProvider{db: db, storage: storage}
}

func (p *LocalFSProvider) ResolvePathToID(ctx context.Context, path string) (string, error) {
	path = filepath.Clean(path)

	if path == "/" || path == "." || path == "" {
		return "0", nil
	}

	parts := strings.Split(strings.Trim(path, "/"), "/")

	var currentParentID any = nil
	var lastID int64

	for _, part := range parts {
		var id int64
		var err error

		if currentParentID == nil {
			err = p.db.QueryRowContext(ctx,
				"SELECT id FROM metadata WHERE parent_id IS NULL AND name = ?", part).Scan(&id)
		} else {
			err = p.db.QueryRowContext(ctx,
				"SELECT id FROM metadata WHERE parent_id = ? AND name = ?", currentParentID, part).Scan(&id)
		}

		if err == sql.ErrNoRows {
			return "", fmt.Errorf("path not found at element: %s", part)
		} else if err != nil {
			return "", err
		}

		currentParentID = id
		lastID = id
	}

	return strconv.FormatInt(lastID, 10), nil
}

func (p *LocalFSProvider) ReadDir(ctx context.Context, dirID string) ([]Node, error) {
	var nodes []Node

	isRoot := dirID == "0" || dirID == ""

	var rows *sql.Rows
	var err error

	// ИЗМЕНЕНО: Добавили LEFT JOIN к artifacts, чтобы забирать размер файла из CAS
	if isRoot {
		rows, err = p.db.QueryContext(ctx, `
			SELECT m.id, m.name, m.is_dir, COALESCE(a.size, 0), m.updated_at 
			FROM metadata m
			LEFT JOIN artifacts a ON m.artefact_id = a.id
			WHERE m.parent_id IS NULL`)
	} else {
		intID, _ := strconv.ParseInt(dirID, 10, 64)
		rows, err = p.db.QueryContext(ctx, `
			SELECT m.id, m.name, m.is_dir, COALESCE(a.size, 0), m.updated_at 
			FROM metadata m
			LEFT JOIN artifacts a ON m.artefact_id = a.id
			WHERE m.parent_id = ?`, intID)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to query metadata: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var n Node
		var idInt int64
		var updatedAtStr string

		err := rows.Scan(&idInt, &n.Name, &n.IsDir, &n.Size, &updatedAtStr)
		if err != nil {
			return nil, err
		}

		n.ID = strconv.FormatInt(idInt, 10)
		n.ParentID = dirID

		n.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
		if n.UpdatedAt.IsZero() {
			n.UpdatedAt = time.Now()
		}

		nodes = append(nodes, n)
	}

	return nodes, nil
}

func (p *LocalFSProvider) OpenFile(ctx context.Context, fileID string, parentDirID, name string, flag int) (File, error) {
	// 1. Если файла нет, но передан флаг создания
	if fileID == "" && (flag&os.O_CREATE != 0) {
		return &LocalFSProviderFileStream{
			ctx:         ctx,
			db:          p.db,
			storage:     p.storage,
			parentDirID: parentDirID,
			name:        name,
			flag:        flag,
			node: Node{
				Name:      name,
				IsDir:     false,
				Size:      0,
				UpdatedAt: time.Now(),
			},
			writeBuffer: new(bytes.Buffer),
			isDirty:     true,
		}, nil
	}

	// 2. Если файл есть, сначала получаем его текущую ноду
	node, err := p.Stat(ctx, fileID)
	if err != nil {
		return nil, err
	}

	if node.IsDir {
		return nil, fmt.Errorf("cannot open directory as file")
	}

	// Определяем, нужна ли нам вообще запись (проверяем WRONLY и RDWR)
	isWriteMode := (flag&os.O_WRONLY != 0) || (flag&os.O_RDWR != 0)

	// 3. Если файл открыт на запись
	if isWriteMode {
		var buf *bytes.Buffer
		isDirty := false

		if flag&os.O_TRUNC != 0 {
			// Если есть TRUNC — просто создаем пустой буфер
			buf = new(bytes.Buffer)
			isDirty = true
		} else if flag&os.O_APPEND != 0 {
			// TODO: Если есть APPEND — тут по-хорошему нужно вычитать
			// существующий файл из p.storage в buf, чтобы писать в конец.
			buf = new(bytes.Buffer)
		} else {
			// Обычная запись без очистки (запись поверх существующих байт)
			// Тоже нужен буфер, возможно с предзагрузкой старых данных
			buf = new(bytes.Buffer)
		}

		return &LocalFSProviderFileStream{
			ctx:         ctx,
			db:          p.db,
			storage:     p.storage,
			fileID:      fileID,
			parentDirID: node.ParentID,
			name:        node.Name,
			flag:        flag,
			node:        node,
			writeBuffer: buf,
			isDirty:     isDirty,
		}, nil
	}

	// 4. Обычное чтение файла (только RDONLY)
	return &LocalFSProviderFileStream{
		ctx:     ctx,
		db:      p.db,
		storage: p.storage,
		fileID:  fileID,
		flag:    flag,
		node:    node,
	}, nil
}

func (p *LocalFSProvider) Stat(ctx context.Context, fileID string) (Node, error) {
	intID, err := strconv.ParseInt(fileID, 10, 64)
	if err != nil {
		return Node{}, fmt.Errorf("invalid file id format: %w", err)
	}
	var id any
	if intID == 0 {
		id = nil
	} else {
		id = intID
	}

	var n Node
	var idInt int64
	var parentIDNullable sql.NullInt64
	var updatedAtStr string

	if id == nil {
		n = Node{
			ID:        "0",
			ParentID:  "",
			Name:      "/",
			IsDir:     true,
			Size:      0,
			UpdatedAt: time.Now(),
		}
		return n, nil
	}

	// ИЗМЕНЕНО: Забираем size через LEFT JOIN из таблицы artifacts вместо metadata
	err = p.db.QueryRowContext(ctx, `
		SELECT m.id, m.parent_id, m.name, m.is_dir, COALESCE(a.size, 0), m.updated_at 
		FROM metadata m
		LEFT JOIN artifacts a ON m.artefact_id = a.id
		WHERE m.id = ?`, id).Scan(&idInt, &parentIDNullable, &n.Name, &n.IsDir, &n.Size, &updatedAtStr)

	if err == sql.ErrNoRows {
		return Node{}, os.ErrNotExist
	} else if err != nil {
		return Node{}, fmt.Errorf("database error during Stat: %w", err)
	}

	n.ID = strconv.FormatInt(idInt, 10)

	if parentIDNullable.Valid {
		n.ParentID = strconv.FormatInt(parentIDNullable.Int64, 10)
	} else {
		n.ParentID = "0"
	}

	n.UpdatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
	if n.UpdatedAt.IsZero() {
		n.UpdatedAt = time.Now()
	}

	return n, nil
}

func (p *LocalFSProvider) Mkdir(ctx context.Context, parentDirID, name string) (Node, error) {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return Node{}, err
	}
	defer tx.Rollback()

	var parentDBValue any
	if parentDirID == "0" || parentDirID == "" {
		parentDBValue = nil
	} else {
		parentDBValue = parentDirID
	}

	safeName, err := resolveUniqueName(ctx, tx, parentDBValue, name)
	if err != nil {
		return Node{}, fmt.Errorf("failed to resolve unique folder name: %w", err)
	}

	// ИЗМЕНЕНО: Убрали поле size из INSERT, так как для папок в metadata его больше нет
	res, err := tx.ExecContext(ctx, `
		INSERT INTO metadata (parent_id, name, is_dir, artefact_id, owner) 
		VALUES (?, ?, 1, NULL, ?)`,
		parentDBValue, safeName, "current_user",
	)
	if err != nil {
		return Node{}, fmt.Errorf("failed to insert folder metadata: %w", err)
	}

	metadataID, _ := res.LastInsertId()

	if err := tx.Commit(); err != nil {
		return Node{}, err
	}

	return Node{
		ID:        strconv.FormatInt(metadataID, 10),
		ParentID:  parentDirID,
		Name:      safeName,
		IsDir:     true,
		Size:      0,
		UpdatedAt: time.Now(),
	}, nil
}

// FIXME
func (p *LocalFSProvider) SaveFile(ctx context.Context, parentDirID, name string, src io.Reader) (Node, error) {
	data, err := io.ReadAll(src)
	if err != nil {
		return Node{}, err
	}
	size := int64(len(data))

	h := sha256.New()
	h.Write(data)
	hash := fmt.Sprintf("%x", h.Sum(nil))

	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return Node{}, err
	}
	defer tx.Rollback()

	var parentDBValue any
	if parentDirID == "0" || parentDirID == "" {
		parentDBValue = nil
	} else {
		parentDBValue = parentDirID
	}

	var existingMetadataID sql.NullInt64
	var oldArtifactID sql.NullInt64
	var oldHash sql.NullString

	if parentDBValue == nil {
		err = tx.QueryRowContext(ctx, `
			SELECT m.id, m.artefact_id, a.hash 
			FROM metadata m
			LEFT JOIN artifacts a ON m.artefact_id = a.id
			WHERE m.parent_id IS NULL AND m.name = ? AND m.is_dir = 0`, name).Scan(&existingMetadataID, &oldArtifactID, &oldHash)
	} else {
		err = tx.QueryRowContext(ctx, `
			SELECT m.id, m.artefact_id, a.hash 
			FROM metadata m
			LEFT JOIN artifacts a ON m.artefact_id = a.id
			WHERE m.parent_id = ? AND m.name = ? AND m.is_dir = 0`, parentDBValue, name).Scan(&existingMetadataID, &oldArtifactID, &oldHash)
	}

	isOverwrite := err == nil

	if err != nil && err != sql.ErrNoRows {
		return Node{}, err
	}

	if isOverwrite && oldHash.Valid && oldHash.String == hash {
		tx.Rollback()
		return Node{
			ID:       strconv.FormatInt(existingMetadataID.Int64, 10),
			ParentID: parentDirID,
			Name:     name,
			IsDir:    false,
			Size:     size,
		}, nil
	}

	var artifactID int64
	err = tx.QueryRowContext(ctx, "SELECT id FROM artifacts WHERE hash = ?", hash).Scan(&artifactID)

	switch err {
	case sql.ErrNoRows:
		buffer := bytes.NewReader(data)
		err = p.storage.Save(ctx, hash, buffer)
		if err != nil {
			return Node{}, fmt.Errorf("failed to save bytes to storage: %w", err)
		}
		// ИЗМЕНЕНО: Записываем размер (size) в таблицу artifacts при создании
		res, err := tx.ExecContext(ctx, "INSERT INTO artifacts (hash, size, relations_count) VALUES (?, ?, 0)", hash, size)
		if err != nil {
			return Node{}, err
		}
		artifactID, _ = res.LastInsertId()

	case nil:
		// Файл уже есть в CAS, ничего делать не нужно. Сработает триггер инкремента в БД.
	default:
		return Node{}, err
	}

	var targetMetadataID int64

	if isOverwrite {
		targetMetadataID = existingMetadataID.Int64

		// ИЗМЕНЕНО: Полностью убрали ручной апдейт artifacts с RETURNING.
		// Вместо этого делаем DELETE старых метаданных — база сама вызовет триггер декремента/очистки.
		_, err = tx.ExecContext(ctx, "DELETE FROM metadata WHERE id = ?", targetMetadataID)
		if err != nil {
			return Node{}, err
		}

		// Вставляем свежую запись с тем же ID под новый артефакт (убрали size из полей)
		_, err := tx.ExecContext(ctx, `
			INSERT INTO metadata (id, parent_id, name, is_dir, artefact_id, owner) 
			VALUES (?, ?, ?, 0, ?, ?)`,
			targetMetadataID, parentDBValue, name, artifactID, "current_user",
		)
		if err != nil {
			return Node{}, err
		}

	} else {
		// ИЗМЕНЕНО: Убрали поле size из INSERT для новых файлов
		res, err := tx.ExecContext(ctx, `
			INSERT INTO metadata (parent_id, name, is_dir, artefact_id, owner) 
			VALUES (?, ?, 0, ?, ?)`,
			parentDBValue, name, artifactID, "current_user",
		)
		if err != nil {
			return Node{}, err
		}
		targetMetadataID, _ = res.LastInsertId()
	}

	if err := tx.Commit(); err != nil {
		return Node{}, err
	}

	return Node{
		ID:       strconv.FormatInt(targetMetadataID, 10),
		ParentID: parentDirID,
		Name:     name,
		IsDir:    false,
		Size:     size,
	}, nil
}

func (p *LocalFSProvider) Move(ctx context.Context, id string, newParentID string, newName string) error {
	intID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid id format: %w", err)
	}

	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentParentID sql.NullInt64
	var currentName string
	err = tx.QueryRowContext(ctx, "SELECT parent_id, name FROM metadata WHERE id = ?", intID).Scan(&currentParentID, &currentName)
	if err == sql.ErrNoRows {
		return os.ErrNotExist
	} else if err != nil {
		return err
	}

	if newName == "" {
		newName = currentName
	}

	var targetParentDB any
	if newParentID == "0" || newParentID == "" {
		targetParentDB = nil
	} else {
		targetParentDB, err = strconv.ParseInt(newParentID, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid new parent id format: %w", err)
		}
	}

	safeName, err := resolveUniqueName(ctx, tx, targetParentDB, newName)
	if err != nil {
		return fmt.Errorf("failed to resolve unique name in target dir: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE metadata 
		SET parent_id = ?, name = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?`,
		targetParentDB, safeName, intID,
	)
	if err != nil {
		return fmt.Errorf("failed to update metadata on move/rename: %w", err)
	}

	return tx.Commit()
}

func (p *LocalFSProvider) Delete(ctx context.Context, id string) error {
	intID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid id format: %w", err)
	}

	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, "DELETE FROM metadata WHERE id = ?", intID)
	if err != nil {
		return fmt.Errorf("failed to delete metadata: %w", err)
	}

	affected, _ := res.RowsAffected()
	if affected == 0 {
		return os.ErrNotExist
	}

	return tx.Commit()
}

func resolveUniqueName(ctx context.Context, tx *sql.Tx, parentID any, originalName string) (string, error) {
	ext := filepath.Ext(originalName)
	base := originalName[:len(originalName)-len(ext)]

	name := originalName
	counter := 1

	for {
		var exists bool
		var err error

		if parentID == nil {
			err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM metadata WHERE parent_id IS NULL AND name = ?)", name).Scan(&exists)
		} else {
			err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM metadata WHERE parent_id = ? AND name = ?)", parentID, name).Scan(&exists)
		}

		if err != nil {
			return "", err
		}

		if !exists {
			return name, nil
		}

		name = fmt.Sprintf("%s (%d)%s", base, counter, ext)
		counter++
	}
}
