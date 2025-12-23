package webdav

import (
	"context"
	"net/http"
	"os"

	"fServer/internal/files"

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

// type FS struct{}

// func (FS) realPath(name string) (string, error) {
// 	// убираем префикс "/dav/"
// 	if len(name) >= 5 && name[:5] == "/dav/" {
// 		name = name[5:]
// 	}
// 	// удаляем ведущий слэш
// 	name = strings.TrimPrefix(name, "/")
// 	return files.SafePath(name)
// }

// func (FS) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (webdav.File, error) {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return os.OpenFile(full, flag, perm)
// }

// func (FS) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return err
// 	}
// 	return files.MkdirPath(full)
// }

// func (FS) RemoveAll(ctx context.Context, name string) error {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return err
// 	}
// 	return files.DeletePath(full)
// }

// func (FS) Stat(ctx context.Context, name string) (os.FileInfo, error) {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return os.Stat(full)
// }

// func (FS) ReadDir(ctx context.Context, name string) ([]os.FileInfo, error) {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return files.ListDir(full)
// }

// func (FS) Rename(ctx context.Context, oldName, newName string) error {
// 	oldFull, err := FS{}.realPath(oldName)
// 	if err != nil {
// 		return err
// 	}
// 	newFull, err := FS{}.realPath(newName)
// 	if err != nil {
// 		return err
// 	}
// 	return os.Rename(oldFull, newFull)
// }

// package webdav

// import (
// 	"context"
// 	"log"
// 	"net/http"
// 	"os"
// 	"path/filepath"
// 	"strings"

// 	"fServer/internal/files"

// 	"golang.org/x/net/webdav"
// )

// var baseAbs string

// func init() {
// 	var err error
// 	baseAbs, err = filepath.Abs(files.BaseDir)
// 	if err != nil {
// 		panic(err)
// 	}
// 	files.BaseDir = baseAbs
// 	log.Printf("[INFO] files.BaseDir = %v", files.BaseDir)
// }

// type FS struct{}

// // realPath нормализует путь WebDAV относительно files.BaseDir
// func (FS) realPath(name string) (string, error) {
// 	// всегда убираем ведущий слэш
// 	name = strings.TrimPrefix(name, "/")
// 	full := filepath.Join(files.BaseDir, name)

// 	// проверка выхода за пределы BaseDir
// 	rel, err := filepath.Rel(files.BaseDir, full)
// 	if err != nil {
// 		return "", err
// 	}
// 	if strings.HasPrefix(rel, "..") {
// 		return "", os.ErrPermission
// 	}
// 	log.Printf("[DEBUG] realPath: %q -> %q", name, full)
// 	return full, nil
// }

// // Mkdir создаёт директорию через files.MkdirPath
// func (FS) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return err
// 	}
// 	log.Printf("[DEBUG] Mkdir -> %v", full)
// 	return files.MkdirPath(full)
// }

// // OpenFile открывает файл через os.OpenFile
// func (FS) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (webdav.File, error) {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	log.Printf("[DEBUG] OpenFile -> %v", full)
// 	return os.OpenFile(full, flag, perm)
// }

// // RemoveAll удаляет файл или директорию через files.DeletePath
// func (FS) RemoveAll(ctx context.Context, name string) error {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return err
// 	}
// 	log.Printf("[DEBUG] RemoveAll -> %v", full)
// 	return files.DeletePath(full)
// }

// // Stat возвращает os.FileInfo
// func (FS) Stat(ctx context.Context, name string) (os.FileInfo, error) {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	log.Printf("[DEBUG] Stat -> %v", full)
// 	return os.Stat(full)
// }

// // ReadDir возвращает список файлов директории через files.ListDir
// func (FS) ReadDir(ctx context.Context, name string) ([]os.FileInfo, error) {
// 	full, err := FS{}.realPath(name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	log.Printf("[DEBUG] ReadDir -> %v", full)
// 	return files.ListDir(full)
// }

// // Rename переименовывает файл или директорию
// func (FS) Rename(ctx context.Context, oldName, newName string) error {
// 	oldFull, err := FS{}.realPath(oldName)
// 	if err != nil {
// 		return err
// 	}
// 	newFull, err := FS{}.realPath(newName)
// 	if err != nil {
// 		return err
// 	}
// 	log.Printf("[DEBUG] Rename -> %v => %v", oldFull, newFull)
// 	return os.Rename(oldFull, newFull)
// }

// // Handler возвращает HTTP handler WebDAV
// func Handler() http.Handler {
// 	dav := &webdav.Handler{
// 		Prefix:     "/dav/",
// 		FileSystem: FS{},
// 		LockSystem: webdav.NewMemLS(),
// 	}

// 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
// 		// заголовки для совместимости с WebDAV-клиентами
// 		w.Header().Set("DAV", "1,2")
// 		w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK")
// 		if r.Method == "OPTIONS" {
// 			w.WriteHeader(http.StatusOK)
// 			return
// 		}
// 		log.Printf("[INFO] %s %s", r.Method, r.URL.Path)
// 		dav.ServeHTTP(w, r)
// 	})
// }
