package webdav

import (
	vfs "MyServer/internal/vfs/v2"
	"os"
	"time"
)

type fileInfo struct {
	name string
	node *vfs.Node
}

func newFileInfo(name string, node *vfs.Node) os.FileInfo {
	if node == nil {
		node = &vfs.Node{}
	}
	if name == "" {
		name = node.Name
	}
	return &fileInfo{name: name, node: node}
}

func (f *fileInfo) Name() string {
	return f.name
}

func (f *fileInfo) Size() int64 {
	return f.node.Size
}

func (f *fileInfo) Mode() os.FileMode {
	if f.node.IsDir {
		return os.ModeDir | 0755
	}
	return 0644
}

func (f *fileInfo) ModTime() time.Time {
	return f.node.UpdatedAt
}

func (f *fileInfo) IsDir() bool {
	return f.node.IsDir
}

func (f *fileInfo) Sys() any {
	return nil
}
