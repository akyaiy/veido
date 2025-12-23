package dav

import (
	"context"
	"net/http"
	"os"

	"MyServer/internal/files"

	"golang.org/x/net/webdav"
)

type FS struct{}

func (FS) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	return files.MkdirPath(name)
}
func (FS) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (webdav.File, error) {
	full, err := files.SafePath(name)
	if err != nil {
		return nil, err
	}
	return os.OpenFile(full, flag, perm)
}
func (FS) RemoveAll(ctx context.Context, name string) error { return files.DeletePath(name) }
func (FS) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	full, err := files.SafePath(name)
	if err != nil {
		return nil, err
	}
	return os.Stat(full)
}
func (FS) ReadDir(ctx context.Context, name string) ([]os.FileInfo, error) {
	return files.ListDir(name)
}
func (FS) Rename(ctx context.Context, oldName, newName string) error {
	oldFull, err := files.SafePath(oldName)
	if err != nil {
		return err
	}
	newFull, err := files.SafePath(newName)
	if err != nil {
		return err
	}
	return os.Rename(oldFull, newFull)
}
func Handler() http.Handler {
	dav := &webdav.Handler{
		Prefix:     "/dav/",
		FileSystem: FS{},
		LockSystem: webdav.NewMemLS(),
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Windows/macOS совместимость
		w.Header().Set("DAV", "1,2")
		w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		dav.ServeHTTP(w, r)
	})
}
