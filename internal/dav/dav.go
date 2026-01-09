// package dav

// import (
// 	"context"
// 	"net/http"
// 	"os"

// 	"MyServer/internal/files"

// 	"golang.org/x/net/webdav"
// )

// type FS struct{}

// func (FS) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
// 	return files.MkdirPath(name)
// }
// func (FS) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (webdav.File, error) {
// 	full, err := files.SafePath(name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return os.OpenFile(full, flag, perm)
// }
// func (FS) RemoveAll(ctx context.Context, name string) error { return files.DeletePath(name) }
// func (FS) Stat(ctx context.Context, name string) (os.FileInfo, error) {
// 	full, err := files.SafePath(name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return os.Stat(full)
// }
// func (FS) ReadDir(ctx context.Context, name string) ([]os.FileInfo, error) {
// 	return files.ListDir(name)
// }
// func (FS) Rename(ctx context.Context, oldName, newName string) error {
// 	oldFull, err := files.SafePath(oldName)
// 	if err != nil {
// 		return err
// 	}
// 	newFull, err := files.SafePath(newName)
// 	if err != nil {
// 		return err
// 	}
// 	return os.Rename(oldFull, newFull)
// }
// func Handler() http.Handler {
// 	dav := &webdav.Handler{
// 		Prefix:     "/dav/",
// 		FileSystem: FS{},
// 		LockSystem: webdav.NewMemLS(),
// 	}

// 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
// 		// Windows/macOS совместимость
// 		w.Header().Set("DAV", "1,2")
// 		w.Header().Set("Allow", "OPTIONS, GET, HEAD, POST, PUT, DELETE, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK")
// 		if r.Method == "OPTIONS" {
// 			w.WriteHeader(http.StatusOK)
// 			return
// 		}
// 		dav.ServeHTTP(w, r)
// 	})
// }

package dav

import (
	"context"
	"fmt"
	"os"
	"path"
	"strings"

	"MyServer/internal/vfs"

	"golang.org/x/net/webdav"
)

// ----------------------
// VFSWebDAV: WebDAV поверх VFS
// ----------------------
type VFSWebDAV struct {
	Root *vfs.VFSNode
}

// resolvePath возвращает узел VFS и под-путь внутри RealPath (если есть)
// func (d *VFSWebDAV) resolvePath(name string) (*vfs.VFSNode, string, error) {
// 	node, err := vfs.FindNode(d.Root, name)
// 	if err == nil {
// 		return node, "", nil
// 	}

// 	// возможно файл внутри смонтированного каталога
// 	parts := strings.Split(strings.Trim(name, "/"), "/")
// 	if len(parts) < 3 {
// 		return nil, "", fmt.Errorf("not found")
// 	}
// 	dirPath := "/" + strings.Join(parts[:3], "/") // /Мой диск/Файлы
// 	subPath := path.Join(parts[3:]...)
// 	node, err = vfs.FindNode(d.Root, dirPath)
// 	if err != nil || node.RealPath == "" {
// 		return nil, "", fmt.Errorf("not found")
// 	}
// 	return node, subPath, nil
// }

func (d *VFSWebDAV) resolvePath(name string) (*vfs.VFSNode, string, error) {
	node, err := vfs.FindNode(d.Root, name)
	if err == nil {
		return node, "", nil
	}

	// Ищем ближайший родительский узел с RealPath
	parts := strings.Split(strings.Trim(name, "/"), "/")
	for i := len(parts); i > 0; i-- {
		tryPath := "/" + strings.Join(parts[:i], "/")
		parent, err2 := vfs.FindNode(d.Root, tryPath)
		if err2 == nil && parent.RealPath != "" {
			subPath := path.Join(parts[i:]...)
			return parent, subPath, nil
		}
	}

	return nil, "", fmt.Errorf("not found")
}

// ----------------------
// Реализация webdav.FileSystem
// ----------------------
func (d *VFSWebDAV) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (webdav.File, error) {
	node, subPath, err := d.resolvePath(name)
	if err != nil {
		return nil, err
	}

	if node.RealPath != "" {
		return os.OpenFile(path.Join(node.RealPath, subPath), flag, perm)
	}

	if node.IsDir {
		return &VirtualDir{node: node}, nil
	}

	return nil, fmt.Errorf("cannot open virtual file")
}

func (d *VFSWebDAV) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	node, subPath, err := d.resolvePath(name)
	if err != nil {
		return nil, err
	}

	if node.RealPath != "" && subPath != "" {
		return os.Stat(path.Join(node.RealPath, subPath))
	}

	return &vfs.VirtualFileInfo{
		NameField:  node.Name,
		IsDirField: node.IsDir,
		SizeField:  0,
	}, nil
}

func (d *VFSWebDAV) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	node, subPath, err := d.resolvePath(name)
	if err != nil {
		return err
	}

	if node.RealPath != "" && subPath != "" {
		return os.MkdirAll(path.Join(node.RealPath, subPath), perm)
	}

	return fmt.Errorf("cannot create virtual directory")
}

func (d *VFSWebDAV) RemoveAll(ctx context.Context, name string) error {
	node, subPath, err := d.resolvePath(name)
	if err != nil {
		return err
	}

	if node.RealPath != "" && subPath != "" {
		return os.RemoveAll(path.Join(node.RealPath, subPath))
	}

	return fmt.Errorf("cannot remove virtual directory")
}

func (d *VFSWebDAV) Rename(ctx context.Context, oldName, newName string) error {
	oldNode, oldSub, err := d.resolvePath(oldName)
	if err != nil {
		return err
	}

	newNode, newSub, err := d.resolvePath(newName)
	if err != nil {
		newNode = oldNode
		newSub = oldSub
	}

	if oldNode.RealPath != "" && oldSub != "" {
		return os.Rename(path.Join(oldNode.RealPath, oldSub), path.Join(newNode.RealPath, newSub))
	}

	return fmt.Errorf("cannot rename virtual directory")
}

// ----------------------
// VirtualDir: адаптер виртуального каталога для WebDAV
// ----------------------
type VirtualDir struct {
	node *vfs.VFSNode
	pos  int
}

// --- WebDAV File интерфейс ---
func (d *VirtualDir) Close() error               { return nil }
func (d *VirtualDir) Read(p []byte) (int, error) { return 0, fmt.Errorf("cannot read directory") }
func (d *VirtualDir) ReadAt(p []byte, off int64) (int, error) {
	return 0, fmt.Errorf("cannot read directory")
}
func (d *VirtualDir) Write(p []byte) (int, error) { return 0, fmt.Errorf("cannot write directory") }
func (d *VirtualDir) Seek(offset int64, whence int) (int64, error) {
	return 0, fmt.Errorf("cannot seek directory")
}

// Readdir возвращает список файлов/каталогов
func (d *VirtualDir) Readdir(count int) ([]os.FileInfo, error) {
	var fis []os.FileInfo
	for _, child := range d.node.Children {
		fis = append(fis, &vfs.VirtualFileInfo{
			NameField:  child.Name,
			IsDirField: child.IsDir,
			SizeField:  0,
		})
	}
	return fis, nil
}

// Stat возвращает os.FileInfo виртуального каталога
func (d *VirtualDir) Stat() (os.FileInfo, error) {
	return &vfs.VirtualFileInfo{
		NameField:  d.node.Name,
		IsDirField: d.node.IsDir,
		SizeField:  0,
	}, nil
}
