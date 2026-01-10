package vfs

import (
	"os"
	"time"
)

/*****************************************************************
 * FileInfo — структура для API / WebDAV
 * Это DTO (структура передачи данных) для фронтенда или WebDAV:
 * используется НЕ внутри VFS, а для ответа клиенту;
 * сериализуется в JSON.
 *****************************************************************/
type FileInfo struct {
	Name    string `json:"name"`
	IsDir   bool   `json:"isDir"`
	Size    int64  `json:"size"`
	ModTime string `json:"modTime"`
}

/******************************************************************
 * VirtualFileInfo — реализация os.FileInfo
 * Интерфейс os.FileInfo нужен для совместимости с:
 * - WebDAV,
 * - стандартными Go API,
 * - кодом, который ожидает обычные файлы ОС.
 * Но виртуальные папки не существуют в ОС, поэтому ты:
 * ➡ реализуешь os.FileInfo вручную
 ******************************************************************/
type VirtualFileInfo struct {
	NameField  string // экспортируемое поле
	IsDirField bool   // экспортируемое поле
	SizeField  int64  // экспортируемое поле
}

/******************************************************************
 * Реализация интерфейса
 * - Mode() → виртуальная папка выглядит как обычная папка UNIX
 * - ModTime() → у виртуальных папок нет времени изменения
 ******************************************************************/
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
