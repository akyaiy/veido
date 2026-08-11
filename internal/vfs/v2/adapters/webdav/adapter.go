package webdav

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"context"
	"errors"
	"io"
	"os"
	"path"
	"strings"

	gowebdav "golang.org/x/net/webdav"
)

type WebDAVAdapter struct {
	frontend vfs.VFSFrontend
	actor    vfs.Actor
	base     common.ResourceAddress
}

func NewWebDAVAdapter(frontend vfs.VFSFrontend, actor vfs.Actor, baseURI common.CanonURI) (gowebdav.FileSystem, error) {
	if frontend == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	parsed := common.ParseResourceAddress(baseURI)
	if parsed == nil {
		return nil, common.ErrNotURI
	}

	base := parsed.Payload()
	base.Path = cleanDAVPath(base.Path)

	return &WebDAVAdapter{
		frontend: frontend,
		actor:    actor,
		base:     base,
	}, nil
}

func cleanDAVPath(name string) string {
	if name == "" || name == "." {
		return "/"
	}
	if !strings.HasPrefix(name, "/") {
		name = "/" + name
	}
	return path.Clean(name)
}

func (a *WebDAVAdapter) uri(name string) (common.CanonURI, string, error) {
	davPath := cleanDAVPath(name)
	basePath := a.base.Path
	if basePath == "" {
		basePath = "/"
	}

	joined := basePath
	if davPath != "/" {
		joined = path.Join(basePath, davPath)
	}
	if joined == "." || joined == "" {
		joined = "/"
	}
	if !strings.HasPrefix(joined, "/") {
		joined = "/" + joined
	}

	address := a.base
	address.Path = path.Clean(joined)
	uri, err := address.URI()
	return uri, davPath, err
}

func (a *WebDAVAdapter) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (gowebdav.File, error) {
	uri, davPath, err := a.uri(name)
	if err != nil {
		return nil, err
	}

	if flag&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_CREATE|os.O_TRUNC) == 0 {
		node, err := a.frontend.Stat(ctx, a.actor, uri)
		if err == nil && node != nil && node.IsDir {
			return &davDir{
				adapter: a,
				ctx:     ctx,
				uri:     uri,
				name:    davPath,
			}, nil
		}
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, translateError(err)
		}
	}

	file, err := a.frontend.OpenFile(ctx, a.actor, uri, flag)
	if err != nil {
		return nil, translateError(err)
	}
	return &davFile{file: file}, nil
}

func (a *WebDAVAdapter) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	uri, davPath, err := a.uri(name)
	if err != nil {
		return nil, err
	}

	node, err := a.frontend.Stat(ctx, a.actor, uri)
	if err != nil {
		return nil, translateError(err)
	}
	if node == nil {
		return nil, os.ErrNotExist
	}

	infoName := path.Base(davPath)
	if davPath == "/" {
		infoName = "/"
	}
	if node.Name != "" {
		infoName = node.Name
	}
	return newFileInfo(infoName, node), nil
}

func (a *WebDAVAdapter) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	uri, _, err := a.uri(name)
	if err != nil {
		return err
	}

	_, err = a.frontend.Mkdir(ctx, a.actor, uri)
	return translateError(err)
}

func (a *WebDAVAdapter) RemoveAll(ctx context.Context, name string) error {
	uri, _, err := a.uri(name)
	if err != nil {
		return err
	}

	return translateError(a.frontend.Delete(ctx, a.actor, uri))
}

func (a *WebDAVAdapter) Rename(ctx context.Context, oldName, newName string) error {
	oldURI, _, err := a.uri(oldName)
	if err != nil {
		return err
	}
	newURI, _, err := a.uri(newName)
	if err != nil {
		return err
	}

	return translateError(a.frontend.Move(ctx, a.actor, oldURI, newURI))
}

func translateError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, vfs.ErrPermissionDenied) || errors.Is(err, os.ErrPermission) {
		return gowebdav.ErrForbidden
	}
	return err
}

type davFile struct {
	file vfs.File
}

func (f *davFile) Close() error {
	return f.file.Close()
}

func (f *davFile) Read(p []byte) (int, error) {
	return f.file.Read(p)
}

func (f *davFile) Write(p []byte) (int, error) {
	return f.file.Write(p)
}

func (f *davFile) Seek(offset int64, whence int) (int64, error) {
	return f.file.Seek(offset, whence)
}

func (f *davFile) Stat() (os.FileInfo, error) {
	if f == nil || f.file == nil {
		return nil, os.ErrInvalid
	}
	return f.file.Stat()
}

func (f *davFile) Readdir(count int) ([]os.FileInfo, error) {
	return nil, os.ErrInvalid
}

type davDir struct {
	adapter *WebDAVAdapter
	ctx     context.Context
	uri     common.CanonURI
	name    string
	entries []os.FileInfo
	offset  int
}

func (d *davDir) Close() error {
	return nil
}

func (d *davDir) Read(p []byte) (int, error) {
	return 0, os.ErrInvalid
}

func (d *davDir) Write(p []byte) (int, error) {
	return 0, os.ErrInvalid
}

func (d *davDir) Seek(offset int64, whence int) (int64, error) {
	return 0, os.ErrInvalid
}

func (d *davDir) Stat() (os.FileInfo, error) {
	return d.adapter.Stat(d.ctx, d.name)
}

func (d *davDir) Readdir(count int) ([]os.FileInfo, error) {
	if d.entries == nil {
		nodes, err := d.adapter.frontend.ReadDir(d.ctx, d.adapter.actor, d.uri)
		if err != nil {
			return nil, translateError(err)
		}

		d.entries = make([]os.FileInfo, 0, len(nodes))
		for _, node := range nodes {
			if node == nil {
				continue
			}
			d.entries = append(d.entries, newFileInfo(node.Name, node))
		}
	}

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

	subset := d.entries[d.offset:limit]
	d.offset = limit
	return subset, nil
}
