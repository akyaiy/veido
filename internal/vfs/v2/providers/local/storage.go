package local

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"hash"
	"io"
	"os"
	"path/filepath"
	"time"
)

type StorageDriver interface {
	Open(ctx context.Context, hash string) (StorageFile, error)
	Create(ctx context.Context) (StorageWriter, error)
	Delete(ctx context.Context, hash string) error
	Exists(ctx context.Context, hash string) (bool, error)
	CleanupTemp(ctx context.Context, maxAge time.Duration) error
}

type StorageFile interface {
	io.Reader
	io.Seeker
	io.Closer
	Stat() (os.FileInfo, error)
}

type StorageWriter interface {
	io.Writer
	io.Closer
	Commit(ctx context.Context) (hash string, size int64, err error)
	Abort() error
}

type LocalStorageDriver struct {
	basePath string
}

func NewLocalStorageDriver(basePath string) StorageDriver {
	return &LocalStorageDriver{basePath: basePath}
}

func (d *LocalStorageDriver) makePath(hash string) string {
	if len(hash) < 4 {
		return filepath.Join(d.basePath, hash)
	}
	return filepath.Join(d.basePath, hash[:2], hash[2:4], hash)
}

func (d *LocalStorageDriver) Open(ctx context.Context, hash string) (StorageFile, error) {
	file, err := os.Open(d.makePath(hash))
	if os.IsNotExist(err) {
		return nil, os.ErrNotExist
	}
	if err != nil {
		return nil, err
	}
	return &contextAwareStorageFile{File: file, ctx: ctx}, nil
}

func (d *LocalStorageDriver) Create(ctx context.Context) (StorageWriter, error) {
	if err := os.MkdirAll(d.tempPath(), 0755); err != nil {
		return nil, err
	}
	file, path, err := d.createTempFile()
	if err != nil {
		return nil, err
	}
	return &localStorageWriter{
		driver:  d,
		ctx:     ctx,
		file:    file,
		tmpPath: path,
		hash:    sha256.New(),
	}, nil
}

func (d *LocalStorageDriver) createTempFile() (*os.File, string, error) {
	for range 16 {
		name, err := randomStorageName()
		if err != nil {
			return nil, "", err
		}
		path := filepath.Join(d.tempPath(), name)
		file, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if os.IsExist(err) {
			continue
		}
		return file, path, err
	}
	return nil, "", os.ErrExist
}

func (d *LocalStorageDriver) tempPath() string {
	return filepath.Join(d.basePath, "temp")
}

func randomStorageName() (string, error) {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	return "upload-" + hex.EncodeToString(buf[:]), nil
}

func (d *LocalStorageDriver) Delete(ctx context.Context, hash string) error {
	return os.Remove(d.makePath(hash))
}

func (d *LocalStorageDriver) Exists(ctx context.Context, hash string) (bool, error) {
	_, err := os.Stat(d.makePath(hash))
	if os.IsNotExist(err) {
		return false, nil
	}
	return err == nil, err
}

func (d *LocalStorageDriver) CleanupTemp(ctx context.Context, maxAge time.Duration) error {
	entries, err := os.ReadDir(d.tempPath())
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	cutoff := time.Now().Add(-maxAge)
	for _, entry := range entries {
		if err := ctx.Err(); err != nil {
			return err
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.IsDir() || info.ModTime().After(cutoff) {
			continue
		}
		_ = os.Remove(filepath.Join(d.tempPath(), entry.Name()))
	}
	return nil
}

type contextAwareStorageFile struct {
	*os.File
	ctx context.Context
}

func (r *contextAwareStorageFile) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		_ = r.Close()
		return 0, err
	}
	return r.File.Read(p)
}

type localStorageWriter struct {
	driver    *LocalStorageDriver
	ctx       context.Context
	file      *os.File
	tmpPath   string
	hash      hash.Hash
	size      int64
	closed    bool
	committed bool
}

func (w *localStorageWriter) Write(p []byte) (int, error) {
	if w.closed {
		return 0, os.ErrClosed
	}
	if err := w.ctx.Err(); err != nil {
		_ = w.Abort()
		return 0, err
	}
	n, err := w.file.Write(p)
	if n > 0 {
		_, _ = w.hash.Write(p[:n])
		w.size += int64(n)
	}
	return n, err
}

func (w *localStorageWriter) Commit(ctx context.Context) (string, int64, error) {
	if w.committed {
		return "", 0, os.ErrClosed
	}
	if err := ctx.Err(); err != nil {
		_ = w.Abort()
		return "", 0, err
	}
	hash := hex.EncodeToString(w.hash.Sum(nil))
	size := w.size
	if err := w.Close(); err != nil {
		_ = w.Abort()
		return "", 0, err
	}

	finalPath := w.driver.makePath(hash)
	if err := os.MkdirAll(filepath.Dir(finalPath), 0755); err != nil {
		_ = w.Abort()
		return "", 0, err
	}
	if _, err := os.Stat(finalPath); err == nil {
		_ = os.Remove(w.tmpPath)
		w.committed = true
		return hash, size, nil
	} else if !os.IsNotExist(err) {
		_ = w.Abort()
		return "", 0, err
	}
	if err := os.Rename(w.tmpPath, finalPath); err != nil {
		_ = w.Abort()
		return "", 0, err
	}
	w.committed = true
	return hash, size, nil
}

func (w *localStorageWriter) Close() error {
	if w.closed {
		return nil
	}
	w.closed = true
	return w.file.Close()
}

func (w *localStorageWriter) Abort() error {
	err := w.Close()
	if removeErr := os.Remove(w.tmpPath); removeErr != nil && !os.IsNotExist(removeErr) && err == nil {
		err = removeErr
	}
	return err
}
