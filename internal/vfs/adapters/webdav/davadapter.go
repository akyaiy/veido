package webdav

import (
	"github.com/akyaiy/veido/internal/vfs"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"strings"

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

func webdavPath(name string) string {
	if name == "" || name == "." {
		return "/"
	}
	if !strings.HasPrefix(name, "/") {
		return "/" + name
	}
	return path.Clean(name)
}

func (a *WebDAVAdapter) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (golangwebdav.File, error) {
	name = webdavPath(name)
	info, err := a.manager.Stat(ctx, name)
	if err == nil && info.IsDir() {
		return &davDir{
			name:    name,
			manager: a.manager,
			ctx:     ctx,
		}, nil
	}

	vfsFile, err := a.manager.OpenFile(ctx, name, flag)
	if err != nil {
		return nil, err
	}

	return &davFile{vfsFile: vfsFile}, nil
}

func (a *WebDAVAdapter) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	name = webdavPath(name)
	stat, err := a.manager.Stat(ctx, name)
	if stat != nil && err == nil {
		return stat, nil
	}
	fmt.Printf("Stat err=%v\n", err)
	return vfs.NewFileInfo(vfs.Node{
		Name: "broken",
	}), os.ErrNotExist
}

func (a *WebDAVAdapter) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	name = webdavPath(name)
	_, err := a.manager.Mkdir(ctx, name)
	if errors.Is(err, os.ErrPermission) {
		return golangwebdav.ErrForbidden
	}
	return err
}

func (a *WebDAVAdapter) RemoveAll(ctx context.Context, name string) error {
	name = webdavPath(name)
	return a.manager.Delete(ctx, name)
}

func (a *WebDAVAdapter) Rename(ctx context.Context, oldName, newName string) error {
	oldName = webdavPath(oldName)
	newName = webdavPath(newName)
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