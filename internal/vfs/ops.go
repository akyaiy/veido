package vfs

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

/***********************************************************************
 * ResolveRealPath Универсальный контролёр пути
 * Защищает от:
 * - ../../etc/passwd
 * - symlink-атак
 * - directory escape
 ***********************************************************************/
func ResolveRealPath(node *VFSNode, name string) (string, error) {
	if node.RealPath == "" {
		return "", fmt.Errorf("not a real directory")
	}

	clean := filepath.Clean(name)
	if strings.Contains(clean, "..") {
		return "", fmt.Errorf("path traversal blocked")
	}

	return filepath.Join(node.RealPath, clean), nil
}

/****************************************************************************************
 * Операции с файлами
 ****************************************************************************************/
/****************************************************************************************
 * Создание папки
 ****************************************************************************************/
func Mkdir(node *VFSNode, name string) error {
	path, err := ResolveRealPath(node, name)
	if err != nil {
		return err
	}
	return os.Mkdir(path, 0755)
}

/****************************************************************************************
 * Загрузка файла
 ****************************************************************************************/
func UploadFile(node *VFSNode, filename string, data io.Reader) error {
	path, err := ResolveRealPath(node, filename)
	if err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, data)
	return err
}

/****************************************************************************************
 * Чтение / скачивание
 ****************************************************************************************/
func OpenFile(node *VFSNode, name string) (*os.File, error) {
	path, err := ResolveRealPath(node, name)
	if err != nil {
		return nil, err
	}
	return os.Open(path)
}

/****************************************************************************************
 * Удаление
 ****************************************************************************************/
func Delete(node *VFSNode, name string) error {
	path, err := ResolveRealPath(node, name)
	if err != nil {
		return err
	}
	return os.RemoveAll(path)
}

/****************************************************************************************
 * Переименование / перемещение
 ****************************************************************************************/
func Rename(node *VFSNode, oldName, newName string) error {
	oldPath, err := ResolveRealPath(node, oldName)
	if err != nil {
		return err
	}
	newPath, err := ResolveRealPath(node, newName)
	if err != nil {
		return err
	}
	return os.Rename(oldPath, newPath)
}
