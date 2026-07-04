package vfs

import (
	// "bytes"
	// "context"
	// "fmt"
	"io"
	"os"
	"time"
	//"time"
)

type File interface {
	io.Reader
	io.Writer
	io.Seeker
	io.Closer
	Stat() (os.FileInfo, error)
}

type FileInfo struct {
	n Node
}

func NewFileInfo(n Node) *FileInfo {
	return &FileInfo{n: n}
}

func (f *FileInfo) Name() string       { return f.n.Name }
func (f *FileInfo) Size() int64        { return f.n.Size }
func (f *FileInfo) IsDir() bool        { return f.n.IsDir }
func (f *FileInfo) ModTime() time.Time { return f.n.UpdatedAt }
func (f *FileInfo) Sys() any           { return nil }
func (f *FileInfo) Mode() os.FileMode {// FIXME
	if f.n.IsDir {
		return os.ModeDir | 0755
	}
	return 0644
}