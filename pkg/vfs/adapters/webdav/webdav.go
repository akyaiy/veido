// Package webdav exposes the VFS v2 WebDAV adapter for external Go modules.
package webdav

import (
	adapter "MyServer/internal/vfs/v2/adapters/webdav"
	"MyServer/pkg/vfs"
	"net/http"

	gowebdav "golang.org/x/net/webdav"
)

func New(frontend vfs.Frontend, actor vfs.Actor, base vfs.URI) (gowebdav.FileSystem, error) {
	return adapter.NewWebDAVAdapter(frontend, actor, base)
}

// TransactionalWrites carries the result of reading an HTTP PUT body through
// to the file's Close, so failed uploads can be aborted instead of committed.
func TransactionalWrites(next http.Handler) http.Handler { return adapter.TransactionalWrites(next) }
