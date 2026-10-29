package local

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"io"
	"os"
	"time"
)

type artifactReadFile struct {
	file   StorageFile
	info   fileInfo
	closed bool
}

func newArtifactReadFile(name string, size int64, modTime time.Time, file StorageFile) vfs.File {
	return &artifactReadFile{
		file: file,
		info: fileInfo{
			name:    name,
			size:    size,
			modTime: modTime,
		},
	}
}

func (f *artifactReadFile) Read(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	return f.file.Read(p)
}

func (f *artifactReadFile) Write(p []byte) (int, error) {
	return 0, os.ErrPermission
}

func (f *artifactReadFile) Seek(offset int64, whence int) (int64, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	return f.file.Seek(offset, whence)
}

func (f *artifactReadFile) Close() error {
	if f.closed {
		return nil
	}
	f.closed = true
	return f.file.Close()
}

func (f *artifactReadFile) Stat() (os.FileInfo, error) {
	return f.info, nil
}

type artifactWriteFile struct {
	ctx      context.Context
	name     string
	writer   artifactWriter
	size     int64
	closed   bool
	commit   func(artifactID int64, hash string, size int64) error
	result   error
	writeErr error
}

func newArtifactWriteFile(ctx context.Context, name string, writer artifactWriter, initialSize int64, commit func(artifactID int64, hash string, size int64) error) vfs.File {
	return &artifactWriteFile{
		ctx:    ctx,
		name:   name,
		writer: writer,
		size:   initialSize,
		commit: commit,
	}
}

func (f *artifactWriteFile) Read(p []byte) (int, error) {
	return 0, os.ErrPermission
}

func (f *artifactWriteFile) Write(p []byte) (int, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	n, err := f.writer.Write(p)
	f.size += int64(n)
	if err != nil {
		f.writeErr = err
	}
	return n, err
}

func (f *artifactWriteFile) Seek(offset int64, whence int) (int64, error) {
	if f.closed {
		return 0, os.ErrClosed
	}
	switch whence {
	case io.SeekCurrent:
		if offset == 0 {
			return f.size, nil
		}
	case io.SeekEnd:
		if offset == 0 {
			return f.size, nil
		}
	}
	return 0, os.ErrInvalid
}

func (f *artifactWriteFile) Close() error {
	return f.Commit()
}

func (f *artifactWriteFile) Abort() error {
	if f.closed {
		return nil
	}
	f.closed = true
	return f.writer.Abort()
}

func (f *artifactWriteFile) Commit() error {
	if f.closed {
		return f.result
	}
	f.closed = true
	if f.writeErr != nil {
		f.result = f.writeErr
	} else {
		f.result = f.ctx.Err()
	}
	if f.result != nil {
		_ = f.writer.Abort()
		return f.result
	}

	artifactID, hash, size, err := f.writer.Commit(f.ctx)
	if err != nil {
		_ = f.writer.Abort()
		f.result = err
		return f.result
	}
	if f.commit == nil {
		return nil
	}
	f.result = f.commit(artifactID, hash, size)
	return f.result
}

func (f *artifactWriteFile) Stat() (os.FileInfo, error) {
	return fileInfo{
		name:    f.name,
		size:    f.size,
		modTime: time.Now(),
	}, nil
}
