package webdav

import (
	"MyServer/internal/vfs"
	"context"
	"errors"
	"io"
	"os"

	golangwebdav "golang.org/x/net/webdav"
)

type WebDAVAdapter struct {
	manager vfs.FileManager
}

// NewWebDAVAdapter принимает интерфейс FileManager.
// Сюда можно подсунуть как CoreFileManager, так и MountManager — адаптер не заметит разницы.
func NewWebDAVAdapter(manager vfs.FileManager) golangwebdav.FileSystem {
	return &WebDAVAdapter{manager: manager}
}

func (a *WebDAVAdapter) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (golangwebdav.File, error) {
	// 1. Проверяем метаданные. Если это существующая папка — возвращаем davDir для поддержки Readdir
	info, err := a.manager.Stat(ctx, name)
	if err == nil && info.IsDir() {
		return &davDir{
			name:    name,
			manager: a.manager,
			ctx:     ctx,
		}, nil
	}

	// 2. Открываем файл через высокоуровневый менеджер. 
	// Он сам разберется с флагами создания (O_CREATE) или очистки (O_TRUNC) через провайдер.
	vfsFile, err := a.manager.OpenFile(ctx, name, flag)
	if err != nil {
		return nil, err
	}

	// 3. Заворачиваем наш vfs.File в обертку для WebDAV
	return &davFile{vfsFile: vfsFile}, nil
}

func (a *WebDAVAdapter) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	// Просто пробрасываем вызов в менеджер, он уже возвращает стандартный os.FileInfo
	stat, err := a.manager.Stat(ctx, name)
	if stat != nil && err == nil {
		return stat, nil
	}
	return vfs.NewFileInfo(vfs.Node{
		Name: "broken",
	}), os.ErrNotExist
}

func (a *WebDAVAdapter) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	_, err := a.manager.Mkdir(ctx, name)
	if errors.Is(err, os.ErrPermission) {
		return golangwebdav.ErrForbidden
	}
	return err
}

func (a *WebDAVAdapter) RemoveAll(ctx context.Context, name string) error {
	return a.manager.Delete(ctx, name)
}

func (a *WebDAVAdapter) Rename(ctx context.Context, oldName, newName string) error {
	return a.manager.Move(ctx, oldName, newName)
}

type davFile struct {
	vfsFile vfs.File
}

func (f *davFile) Close() error               { return f.vfsFile.Close() }
func (f *davFile) Read(p []byte) (int, error) { return f.vfsFile.Read(p) }
func (f *davFile) Write(p []byte) (int, error){ return f.vfsFile.Write(p) }

func (f *davFile) Seek(offset int64, whence int) (int64, error) {
	return f.vfsFile.Seek(offset, whence)
}

func (f *davFile) Stat() (os.FileInfo, error) { 
	return f.vfsFile.Stat() 
}

func (f *davFile) Readdir(count int) ([]os.FileInfo, error) {
	return nil, os.ErrInvalid
}

type davDir struct {
	name    string
	manager vfs.FileManager
	ctx     context.Context
	entries []os.FileInfo
	offset  int
}

func (d *davDir) Close() error               { return nil }
func (d *davDir) Read(p []byte) (int, error) { return 0, os.ErrInvalid }
func (d *davDir) Write(p []byte) (int, error){ return 0, os.ErrInvalid }

func (d *davDir) Seek(offset int64, whence int) (int64, error) {
	return 0, os.ErrInvalid
}

func (d *davDir) Stat() (os.FileInfo, error) {
	return d.manager.Stat(d.ctx, d.name)
}

func (d *davDir) Readdir(count int) ([]os.FileInfo, error) {
	// Лениво читаем содержимое папки при первом вызове Readdir
	if d.entries == nil {
		infos, err := d.manager.ReadDir(d.ctx, d.name)
		if err != nil {
			return nil, err
		}
		d.entries = infos
	}

	// Если мы уже отдали всё содержимое
	if d.offset >= len(d.entries) {
		if count > 0 {
			return nil, io.EOF
		}
		return nil, nil
	}

	limit := len(d.entries)
	if count > 0 && d.offset+count < limit {
		limit = d.offset + count
	}

	// Отрезаем нужную пачку элементов для WebDAV-клиента
	subset := d.entries[d.offset:limit]
	d.offset = limit

	return subset, nil
}