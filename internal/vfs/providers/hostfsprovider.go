package providers

import (
	"github.com/akyaiy/veido/internal/vfs"
	"context"
	"fmt"
	"os"
	"path/filepath"
)

type HostFSProvider struct {
	mountPoint string
}

func NewHostFSProvider(mountPoint string) (vfs.FSProvider, error) {
	absPath, err := filepath.Abs(mountPoint)
	if err != nil {
		return nil, fmt.Errorf("invalid mount point path: %w", err)
	}

	// Создаем папку, если её ещё нет
	if err := os.MkdirAll(absPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to initialize host dir: %w", err)
	}

	return &HostFSProvider{mountPoint: absPath}, nil
}

func (p *HostFSProvider) toRealPath(virtualPath string) string {
	cleanVirtual := filepath.Clean("/" + virtualPath)
	return filepath.Join(p.mountPoint, cleanVirtual)
}

// Delete implements [FSProvider].
func (p *HostFSProvider) Delete(ctx context.Context, id string) error {
	realPath := p.toRealPath(id)

	// Жесткая защита: не даем снести под корень саму папку монтирования
	if realPath == p.mountPoint {
		return fmt.Errorf("permission denied: cannot delete host root mount point")
	}

	err := os.RemoveAll(realPath)
	if err != nil {
		if os.IsNotExist(err) {
			return os.ErrNotExist
		}
		return err
	}
	return nil
}

// Mkdir implements [FSProvider].
func (p *HostFSProvider) Mkdir(ctx context.Context, parentDirID, name string) (vfs.Node, error) {
	virtualPath := filepath.Join(parentDirID, name)
	realPath := p.toRealPath(virtualPath)

	err := os.Mkdir(realPath, 0755)
	if err != nil {
		if os.IsExist(err) {
			return vfs.Node{}, os.ErrExist
		}
		return vfs.Node{}, err
	}

	info, err := os.Stat(realPath)
	if err != nil {
		return vfs.Node{}, err
	}

	return vfs.Node{
		ID:        filepath.ToSlash(virtualPath),
		ParentID:  filepath.ToSlash(parentDirID),
		Name:      name,
		IsDir:     true,
		Size:      0,
		UpdatedAt: info.ModTime(),
	}, nil
}

// Move implements [FSProvider].
func (p *HostFSProvider) Move(ctx context.Context, id, newParentID, newName string) error {
	oldRealPath := p.toRealPath(id)
	
	// Если новое имя не передано, сохраняем старое базовое имя файла
	if newName == "" {
		newName = filepath.Base(id)
	}

	virtualNewPath := filepath.Join(newParentID, newName)
	newRealPath := p.toRealPath(virtualNewPath)

	// Проверяем, существует ли целевая папка (куда перемещаем)
	if err := os.MkdirAll(filepath.Dir(newRealPath), 0755); err != nil {
		return err
	}

	err := os.Rename(oldRealPath, newRealPath)
	if err != nil {
		if os.IsNotExist(err) {
			return os.ErrNotExist
		}
		return err
	}
	return nil
}

// OpenFile implements [FSProvider].
func (p *HostFSProvider) OpenFile(ctx context.Context, fileID string, parentDirID, name string, flag int) (vfs.File, error) {
	var realPath string

	if fileID == "" && (flag&os.O_CREATE != 0) {
		if name == "" {
			return nil, fmt.Errorf("file name is required for creation")
		}
		realPath = filepath.Join(p.toRealPath(parentDirID), name)
	} else {
		realPath = p.toRealPath(fileID)
	}

	osFile, err := os.OpenFile(realPath, flag, 0644)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, os.ErrNotExist
		}
		return nil, fmt.Errorf("failed to open physical file on host: %w", err)
	}

	return osFile, nil
}

// ReadDir implements [FSProvider].
func (p *HostFSProvider) ReadDir(ctx context.Context, id string) ([]vfs.Node, error) {
	realPath := p.toRealPath(id)

	entries, err := os.ReadDir(realPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, os.ErrNotExist
		}
		return nil, err
	}

	var nodes []vfs.Node
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue // если файл заблокирован или удален в процессе, пропускаем
		}

		// Формируем правильный виртуальный ID для вложенного элемента
		virtualChildID := filepath.ToSlash(filepath.Join(id, entry.Name()))

		nodes = append(nodes, vfs.Node{
			ID:        virtualChildID,
			ParentID:  filepath.ToSlash(id),
			Name:      entry.Name(),
			IsDir:     entry.IsDir(),
			Size:      info.Size(),
			UpdatedAt: info.ModTime(),
		})
	}

	return nodes, nil
}

// ResolvePathToID implements [FSProvider].
func (h *HostFSProvider) ResolvePathToID(ctx context.Context, path string) (string, error) {
	return path, nil // В HostFS виртуальный путь совпадает с ID
}

// SaveFile implements [FSProvider].
// func (p *HostFSProvider) SaveFile(ctx context.Context, parentDirID, name string, src io.Reader) (vfs.Node, error) {
// 	if parentDirID == "0" || parentDirID == "" {
// 		parentDirID = "/"
// 	}

// 	virtualPath := filepath.Join(parentDirID, name)
// 	realPath := p.toRealPath(virtualPath)

// 	// Создаем или зануляем существующий файл на диске хоста
// 	file, err := os.OpenFile(realPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
// 	if err != nil {
// 		return Node{}, err
// 	}
// 	defer file.Close()

// 	// Стримим данные напрямую из сети на жесткий диск
// 	size, err := io.Copy(file, src)
// 	if err != nil {
// 		return Node{}, err
// 	}

// 	info, err := file.Stat()
// 	if err != nil {
// 		return Node{}, err
// 	}

// 	return Node{
// 		ID:        filepath.ToSlash(virtualPath),
// 		ParentID:  filepath.ToSlash(parentDirID),
// 		Name:      name,
// 		IsDir:     false,
// 		Size:      size,
// 		UpdatedAt: info.ModTime(),
// 	}, nil
// }

// Stat implements [FSProvider].
func (p *HostFSProvider) Stat(ctx context.Context, path string) (vfs.Node, error) {
	realPath := p.toRealPath(path)

	info, err := os.Stat(realPath)
	if err != nil {
		if os.IsNotExist(err) {
			return vfs.Node{}, os.ErrNotExist
		}
		return vfs.Node{}, err
	}

	// Вычисляем виртуальный parentID
	parentID := filepath.ToSlash(filepath.Dir(path))
	if parentID == "." || parentID == "/" {
		parentID = "0"
	}

	return vfs.Node{
		ID:        filepath.ToSlash(path),
		ParentID:  parentID,
		Name:      info.Name(),
		IsDir:     info.IsDir(),
		Size:      info.Size(),
		UpdatedAt: info.ModTime(),
	}, nil
}
