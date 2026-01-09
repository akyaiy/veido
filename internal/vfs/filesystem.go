package vfs

import (
	"MyServer/internal/auth"
	"database/sql"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"
)

// ----------------------
// FileInfo для API/WebDAV
// ----------------------
type FileInfo struct {
	Name    string `json:"name"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
}

// VirtualFileInfo реализует os.FileInfo для виртуальных каталогов
type VirtualFileInfo struct {
	NameField  string // экспортируемое поле
	IsDirField bool   // экспортируемое поле
	SizeField  int64  // экспортируемое поле
}

// Методы для os.FileInfo
func (v *VirtualFileInfo) Name() string { return v.NameField }
func (v *VirtualFileInfo) Size() int64  { return v.SizeField }
func (v *VirtualFileInfo) Mode() os.FileMode {
	if v.IsDirField {
		return os.ModeDir | 0755
	}
	return 0644
}
func (v *VirtualFileInfo) ModTime() time.Time { return time.Time{} }
func (v *VirtualFileInfo) IsDir() bool        { return v.IsDirField }
func (v *VirtualFileInfo) Sys() interface{}   { return nil }

// Структура виртуальной файловой системы
type VFSNode struct {
	Name     string
	IsDir    bool
	Children map[string]*VFSNode
	RealPath string // если не пусто — монтируем реальный каталог отсюда
}

// Инициализация структуры каталогов
func BuildVFS(db *sql.DB, user *auth.User) *VFSNode {
	root := &VFSNode{
		Name:     "root",
		IsDir:    true,
		Children: map[string]*VFSNode{},
	}

	// Базовая структура (пока статическая)
	myDisk := &VFSNode{
		Name:     "Мой диск",
		IsDir:    true,
		Children: map[string]*VFSNode{},
	}

	shared := &VFSNode{
		Name:     "Доступные мне",
		IsDir:    true,
		Children: map[string]*VFSNode{},
	}

	for _, name := range []string{"Файлы", "HTML страницы", "Функции"} {
		myDisk.Children[name] = &VFSNode{
			Name:     name,
			IsDir:    true,
			Children: map[string]*VFSNode{},
		}
		shared.Children[name] = &VFSNode{
			Name:     name,
			IsDir:    true,
			Children: map[string]*VFSNode{},
		}
	}

	root.Children[myDisk.Name] = myDisk
	root.Children[shared.Name] = shared

	// Монтируем реальный каталог пользователя
	userFilesPath := fmt.Sprintf("./data/files/users/%s", user.Username)
	_ = MountRealDir(root, "/Мой диск/Файлы", userFilesPath)

	return root
}

// Функция поиска узла по пути:
func FindNode(root *VFSNode, path string) (*VFSNode, error) {
	if path == "" || path == "/" {
		return root, nil
	}

	parts := strings.Split(path, "/")
	current := root

	for _, part := range parts {
		if part == "" || part == "." {
			continue
		}
		if part == ".." {
			// на этом шаге пока запрещаем
			return nil, fmt.Errorf("parent navigation not allowed")
		}

		next, ok := current.Children[part]
		if !ok {
			return nil, fmt.Errorf("path not found")
		}
		current = next
	}

	return current, nil
}

// Функция монтирования каталога
func MountRealDir(vfs *VFSNode, virtPath string, realPath string) error {
	node, err := FindNode(vfs, virtPath)
	if err != nil {
		return err
	}

	if !node.IsDir {
		return fmt.Errorf("cannot mount to a file")
	}

	node.RealPath = realPath
	return nil
}

// Возврат списка каталогов (FileInfo)
func ListDir(node *VFSNode) []FileInfo {
	result := []FileInfo{}

	// 1. Виртуальные подкаталоги
	for _, child := range node.Children {
		result = append(result, FileInfo{
			Name:  child.Name,
			IsDir: child.IsDir,
		})
	}

	// 2. Если есть монтируемый реальный каталог — добавляем файлы
	if node.RealPath != "" {
		entries, err := os.ReadDir(node.RealPath)
		if err == nil {
			for _, entry := range entries {
				info, _ := entry.Info()
				result = append(result, FileInfo{
					Name:    entry.Name(),
					IsDir:   entry.IsDir(),
					Size:    info.Size(),
					ModTime: info.ModTime().Format(time.RFC3339),
				})
			}
		}
	}

	// 3. Сортировка: каталоги сверху
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir
		}
		return result[i].Name < result[j].Name
	})

	return result
}
