package local

import (
	"context"
	"io"
	"os"
	"path/filepath"
)

type StorageDriver interface {
	Save(ctx context.Context, hash string, src io.Reader) error
	Read(ctx context.Context, hash string) (io.ReadCloser, error)
	Delete(ctx context.Context, hash string) error
	Exists(ctx context.Context, hash string) (bool, error)
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

func (d *LocalStorageDriver) Save(ctx context.Context, hash string, src io.Reader) error {
	path := d.makePath(hash)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = io.Copy(file, src)
	return err
}

func (d *LocalStorageDriver) Read(ctx context.Context, hash string) (io.ReadCloser, error) {
	file, err := os.Open(d.makePath(hash))
	if os.IsNotExist(err) {
		return nil, os.ErrNotExist
	}
	if err != nil {
		return nil, err
	}
	return &contextAwareReadCloser{ReadCloser: file, ctx: ctx}, nil
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

type contextAwareReadCloser struct {
	io.ReadCloser
	ctx context.Context
}

func (r *contextAwareReadCloser) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		_ = r.Close()
		return 0, err
	}
	return r.ReadCloser.Read(p)
}
