package vfs

import (
	"MyServer/internal/auth"
	"context"

	"os"
	"path/filepath"
)

type FSManager struct {
	provider     FSProvider
	accessSystem AccessSystem
}

type FileManager interface {
	Stat(ctx context.Context, path string) (os.FileInfo, error)
	ReadDir(ctx context.Context, path string) ([]os.FileInfo, error)
	Mkdir(ctx context.Context, path string) (os.FileInfo, error)
	Delete(ctx context.Context, path string) error
	Move(ctx context.Context, oldPath, newPath string) error
	OpenFile(ctx context.Context, path string, flag int) (File, error)
}

func NewFSManager(provider FSProvider, access AccessSystem) *FSManager {
	return &FSManager{
		provider:     provider,
		accessSystem: access,
	}
}

func userIDFromCtx(ctx context.Context) int {
	uid, ok := ctx.Value(auth.CONTEXT_USER_ID_KEY).(int)
	if !ok {
		return 0
	}
	return uid
}

func (m *FSManager) Stat(ctx context.Context, path string) (os.FileInfo, error) {
	userID := userIDFromCtx(ctx)
	if userID == 0 {
		return nil, os.ErrPermission
	}

	homeID, err := m.accessSystem.GetUserHomeNodeID(ctx, userID)
	if err != nil {
		return nil, os.ErrPermission
	}

	enrichedCtx := context.WithValue(ctx, "relative_node_id", homeID)

	id, err := m.provider.ResolvePathToID(enrichedCtx, path)
	if err != nil {
		return nil, os.ErrNotExist
	}

	allowed, err := m.accessSystem.CanRead(ctx, userID, id)
	if err != nil || !allowed {
		return nil, os.ErrPermission
	}

	node, err := m.provider.Stat(ctx, id)
	if err != nil {
		return nil, err
	}

	return &FileInfo{n: node}, nil
}

func (m *FSManager) ReadDir(ctx context.Context, path string) ([]os.FileInfo, error) {
	userID := userIDFromCtx(ctx)
	homeID, err := m.accessSystem.GetUserHomeNodeID(ctx, userID)
	if err != nil {
		return nil, os.ErrPermission
	}

	// Передаем контекст с зафиксированным хоумом
	enrichedCtx := context.WithValue(ctx, "relative_node_id", homeID)
	id, err := m.provider.ResolvePathToID(enrichedCtx, path)
	if err != nil {
		return nil, os.ErrNotExist
	}

	// Проверяем, имеет ли право юзер читать саму ЛИСТИМЫЙ директорию
	allowed, err := m.accessSystem.CanRead(ctx, userID, id)
	if err != nil || !allowed {
		return nil, os.ErrPermission
	}

	// Достаем ВСЕ ноды из провайдера
	nodes, err := m.provider.ReadDir(ctx, id)
	if err != nil {
		return nil, err
	}

	// Заранее выделяем слайс под результат (максимум — длина всех нод)
	infos := make([]os.FileInfo, 0, len(nodes))

	for _, n := range nodes {
		// Проверяем доступ к КАЖДОЙ конкретной дочерней ноде.
		// Передаем n.ID, чтобы система ACL проверила права на этот вложенный объект.
		nodeAllowed, err := m.accessSystem.CanRead(ctx, userID, n.ID)
		if err != nil {
			return nil, err // Если легла база/ошибка ACL — лучше упасть
		}

		// Если доступ запрещен ("deny" или нет правила), просто тихо пропускаем файл
		if !nodeAllowed {
			continue
		}

		// Если доступ есть — добавляем в итоговый список
		infos = append(infos, &FileInfo{n: n})
	}

	return infos, nil
}

func (m *FSManager) Mkdir(ctx context.Context, path string) (os.FileInfo, error) {
	parentDir := filepath.Dir(path)
	baseName := filepath.Base(path)

	userID := userIDFromCtx(ctx)
	homeID, err := m.accessSystem.GetUserHomeNodeID(ctx, userID)
	if err != nil {
		return nil, os.ErrPermission
	}
	enrichedCtx := context.WithValue(ctx, "relative_node_id", homeID)

	parentID, err := m.provider.ResolvePathToID(enrichedCtx, parentDir)
	if err != nil {
		return nil, os.ErrNotExist
	}

	stat, err := m.provider.Stat(ctx, parentID)
	if err != nil {
		return nil, os.ErrNotExist
	}
	if !stat.IsDir {
		return nil, os.ErrInvalid
	}

	allowed, err := m.accessSystem.CanWrite(ctx, userID, parentID)
	if err != nil || !allowed {
		return nil, os.ErrPermission
	}

	node, err := m.provider.Mkdir(ctx, parentID, baseName)
	if err != nil {
		return nil, err
	}
	return &FileInfo{n: node}, nil
}

func (m *FSManager) Delete(ctx context.Context, path string) error {
	userID := userIDFromCtx(ctx)
	homeID, err := m.accessSystem.GetUserHomeNodeID(ctx, userID)
	if err != nil {
		return os.ErrPermission
	}
	enrichedCtx := context.WithValue(ctx, "relative_node_id", homeID)
	id, err := m.provider.ResolvePathToID(enrichedCtx, path)
	if err != nil {
		return os.ErrNotExist
	}
	allowed, err := m.accessSystem.CanDelete(ctx, userID, id)
	if err != nil || !allowed {
		return os.ErrPermission
	}
	return m.provider.Delete(ctx, id)
}

func (m *FSManager) Move(ctx context.Context, oldPath, newPath string) error {
	userID := userIDFromCtx(ctx)
	homeID, err := m.accessSystem.GetUserHomeNodeID(ctx, userID)
	if err != nil {
		return os.ErrPermission
	}
	enrichedCtx := context.WithValue(ctx, "relative_node_id", homeID)
	id, err := m.provider.ResolvePathToID(enrichedCtx, oldPath)
	if err != nil {
		return os.ErrNotExist
	}
	allowed, err := m.accessSystem.CanRead(ctx, userID, id)
	if err != nil || !allowed {
		return os.ErrPermission
	}

	newParentDir := filepath.Dir(newPath)
	newBaseName := filepath.Base(newPath)
	if newBaseName != newParentDir {
		allowed, err := m.accessSystem.CanDelete(ctx, userID, id)
		if err != nil || !allowed {
			return os.ErrPermission
		}
	}

	newParentID, err := m.provider.ResolvePathToID(enrichedCtx, newParentDir)
	if err != nil {
		return os.ErrNotExist
	}
	allowed, err = m.accessSystem.CanWrite(ctx, userID, newParentID)
	if err != nil || !allowed {
		return os.ErrPermission
	}

	return m.provider.Move(ctx, id, newParentID, newBaseName)
}

func (m *FSManager) OpenFile(ctx context.Context, path string, flag int) (File, error) {
	userID := userIDFromCtx(ctx)
	homeID, err := m.accessSystem.GetUserHomeNodeID(ctx, userID)
	if err != nil {
		return nil, os.ErrPermission
	}
	enrichedCtx := context.WithValue(ctx, "relative_node_id", homeID)
	id, err := m.provider.ResolvePathToID(enrichedCtx, path)

	if err == nil {
		var allowed bool
		var checkErr error

		if flag&(os.O_WRONLY|os.O_RDWR|os.O_TRUNC) != 0 {
			allowed, checkErr = m.accessSystem.CanWrite(ctx, userID, id)
		} else {
			allowed, checkErr = m.accessSystem.CanRead(ctx, userID, id)
		}

		if checkErr != nil || !allowed {
			return nil, os.ErrPermission
		}

		return m.provider.OpenFile(ctx, id, "", "", flag)
	}

	if flag&os.O_CREATE != 0 {
		parentDir := filepath.Dir(path)
		baseName := filepath.Base(path)

		parentID, pErr := m.provider.ResolvePathToID(enrichedCtx, parentDir)
		if pErr != nil {
			return nil, os.ErrNotExist
		}

		// Нужны права на ЗАПИСЬ в родительскую директорию
		allowed, checkErr := m.accessSystem.CanWrite(ctx, userID, parentID)
		if checkErr != nil || !allowed {
			return nil, os.ErrPermission
		}

		return m.provider.OpenFile(ctx, "", parentID, baseName, flag)
	}

	return nil, os.ErrNotExist
}
