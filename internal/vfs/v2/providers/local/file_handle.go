package local

import (
	vfs "MyServer/internal/vfs/v2"
	"io"
	"os"
	"time"
)

type accountFile struct {
	name      string
	data      []byte
	offset    int64
	modTime   time.Time
	writeable bool
	closed    bool
	commit    func([]byte) error
}

func newReadFile(name string, data []byte, modTime time.Time) vfs.File {
	return &accountFile{name: name, data: data, modTime: modTime}
}

func newWriteFile(name string, data []byte, modTime time.Time, offset int64, commit func([]byte) error) vfs.File {
	return &accountFile{
		name:      name,
		data:      data,
		offset:    offset,
		modTime:   modTime,
		writeable: true,
		commit:    commit,
	}
}

func (f *accountFile) Read(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	if f.offset >= int64(len(f.data)) {
		return 0, io.EOF
	}
	n := copy(p, f.data[f.offset:])
	f.offset += int64(n)
	return n, nil
}

func (f *accountFile) Write(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	if !f.writeable {
		return 0, os.ErrPermission
	}
	end := f.offset + int64(len(p))
	if end > int64(len(f.data)) {
		next := make([]byte, end)
		copy(next, f.data)
		f.data = next
	}
	copy(f.data[f.offset:end], p)
	f.offset = end
	return len(p), nil
}

func (f *accountFile) Seek(offset int64, whence int) (int64, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	var next int64
	switch whence {
	case io.SeekStart:
		next = offset
	case io.SeekCurrent:
		next = f.offset + offset
	case io.SeekEnd:
		next = int64(len(f.data)) + offset
	default:
		return 0, os.ErrInvalid
	}
	if next < 0 {
		return 0, os.ErrInvalid
	}
	f.offset = next
	return f.offset, nil
}

func (f *accountFile) Close() error {
	if f.closed {
		return nil
	}
	f.closed = true
	if f.writeable && f.commit != nil {
		return f.commit(f.data)
	}
	return nil
}

func (f *accountFile) Stat() (os.FileInfo, error) {
	return fileInfo{
		name:    f.name,
		size:    int64(len(f.data)),
		modTime: f.modTime,
	}, nil
}
