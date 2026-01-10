package vfs

import (
	"MyServer/internal/auth"
	"database/sql"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"time"
)

/*********************************************************************
 * VFSNode — узел виртуальной ФС ключевая структура.
 * Каждый VFSNode — это файл или каталог в виртуальной ФС.
 *********************************************************************/
type VFSNode struct {
	Name     string
	IsDir    bool
	Parent   *VFSNode
	Children map[string]*VFSNode
	RealPath string // если не пусто — монтируем реальный каталог отсюда
}

/**********************************************************************
 * BuildVFS — построение структуры
 * - создаёт корень виртуальной ФС
 * - формирует базовую структуру папок
 * - монтирует каталог пользователя
 **********************************************************************/
func BuildVFS(db *sql.DB, user *auth.User) *VFSNode {
	// Рутовый каталог
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
	// Наполнение корневых каталогов
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
	// Подключение к корню
	root.Children[myDisk.Name] = myDisk
	root.Children[shared.Name] = shared

	// Монтируем реальный каталог пользователя
	userFilesPath := fmt.Sprintf("./data/files/users/%s", user.Username)
	_ = MountRealDir(root, "/Мой диск/Файлы", userFilesPath)

	return root
}

/********************************************************************************
 *  Функция поиска узла по пути:
 ********************************************************************************/
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
		// Защита 🚨 Запрещает выход вверх, защита от ../
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

/**********************************************************************************
 * MountRealDir — монтирование каталога
 * Что делает
 * - ищет виртуальный узел
 * - проверяет, что это каталог
 * - сохраняет RealPath
 * 📌 Файлы не копируются — только ссылка.
 **********************************************************************************/
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

/*************************************************************************************
 * ListDir — получение списка файлов (FileInfo)
 *************************************************************************************/
func ListDir(node *VFSNode) []FileInfo {
	result := []FileInfo{}

	// Виртуальные дочерние каталоги
	for _, child := range node.Children {
		result = append(result, FileInfo{
			Name:  child.Name,
			IsDir: child.IsDir,
		})
	}

	// Реальные файлы (если есть RealPath)
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

	// Сортировка
	sort.Slice(result, func(i, j int) bool {
		if result[i].IsDir != result[j].IsDir {
			return result[i].IsDir
		}
		return result[i].Name < result[j].Name
	})

	return result
}

/*************************************************************************************
 * CopyFile —
 *************************************************************************************/
func CopyFile(srcDir *VFSNode, srcName string, dstDir *VFSNode, dstName string) error {
	srcPath, err := ResolveRealPath(srcDir, srcName)
	if err != nil {
		return err
	}
	dstPath, err := ResolveRealPath(dstDir, dstName)
	if err != nil {
		return err
	}

	in, err := os.Open(srcPath)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.Create(dstPath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}
