package virtfs

import (
	vfs "MyServer/internal/vfs/v2"
	"bytes"
	"os"
	"time"
)

type readOnlyFile struct {
	reader *bytes.Reader
	info   os.FileInfo
	closed bool
}

func NewReadOnlyFile(name string, content []byte) vfs.File {
	return &readOnlyFile{
		reader: bytes.NewReader(content),
		info: fileInfo{
			name:    name,
			size:    int64(len(content)),
			modTime: time.Now(),
		},
	}
}

func (f *readOnlyFile) Read(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	return f.reader.Read(p)
}

func (f *readOnlyFile) Write(p []byte) (int, error) {
	return 0, os.ErrPermission
}

func (f *readOnlyFile) Seek(offset int64, whence int) (int64, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	return f.reader.Seek(offset, whence)
}

func (f *readOnlyFile) Close() error {
	f.closed = true
	return nil
}

func (f *readOnlyFile) Stat() (os.FileInfo, error) {
	return f.info, nil
}

type bufferedWriteFile struct {
	buffer bytes.Buffer
	info   os.FileInfo
	commit func([]byte) error
	closed bool
}

func NewBufferedWriteFile(name string, commit func([]byte) error) vfs.File {
	return &bufferedWriteFile{
		info: fileInfo{
			name:    name,
			modTime: time.Now(),
		},
		commit: commit,
	}
}

func (f *bufferedWriteFile) Read(p []byte) (int, error) {
	return 0, os.ErrPermission
}

func (f *bufferedWriteFile) Write(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	return f.buffer.Write(p)
}

func (f *bufferedWriteFile) Seek(offset int64, whence int) (int64, error) {
	return 0, os.ErrInvalid
}

func (f *bufferedWriteFile) Close() error {
	if f.closed {
		return nil
	}
	f.closed = true
	if f.commit == nil {
		return nil
	}
	return f.commit(f.buffer.Bytes())
}

func (f *bufferedWriteFile) Stat() (os.FileInfo, error) {
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
