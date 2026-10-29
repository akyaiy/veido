package local

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"bytes"
	"os"
	"time"
)

type staticFile struct {
	reader *bytes.Reader
	info   fileInfo
	closed bool
}

func newStaticFile(name string, content []byte) vfs.File {
	return &staticFile{
		reader: bytes.NewReader(content),
		info: fileInfo{
			name:    name,
			size:    int64(len(content)),
			modTime: time.Now(),
		},
	}
}

func (f *staticFile) Read(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	return f.reader.Read(p)
}

func (f *staticFile) Write(p []byte) (int, error) {
	return 0, os.ErrPermission
}

func (f *staticFile) Seek(offset int64, whence int) (int64, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	return f.reader.Seek(offset, whence)
}

func (f *staticFile) Close() error {
	f.closed = true
	return nil
}

func (f *staticFile) Stat() (os.FileInfo, error) {
	return f.info, nil
}

type fileInfo struct {
	name    string
	size    int64
	modTime time.Time
	isDir   bool
}

func (i fileInfo) Name() string {
	return i.name
}

func (i fileInfo) Size() int64 {
	return i.size
}

func (i fileInfo) Mode() os.FileMode {
	if i.isDir {
		return os.ModeDir | 0755
	}
	return 0644
}

func (i fileInfo) ModTime() time.Time {
	return i.modTime
}

func (i fileInfo) IsDir() bool {
	return i.isDir
}

func (i fileInfo) Sys() any {
	return nil
}
