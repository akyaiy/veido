package vfs

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
	return filepath.Join(d.basePath, hash[0:2], hash[2:4], hash)
}

type contextAwareFile struct {
	*os.File
	ctx context.Context
}

func (f *contextAwareFile) Read(p []byte) (n int, err error) {
	if err := f.ctx.Err(); err != nil {
		f.File.Close()
		return 0, err
	}
	return f.File.Read(p)
}

func (d *LocalStorageDriver) Save(ctx context.Context, hash string, src io.Reader) error {
	path := d.makePath(hash)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, src)
	return err
}

func (d *LocalStorageDriver) Read(ctx context.Context, hash string) (io.ReadCloser, error) {
	path := d.makePath(hash)

	file, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, os.ErrNotExist
		}
		return nil, err
	}

	go func() {
		<-ctx.Done()
		file.Close()
	}()

	return &contextAwareFile{
		File: file,
		ctx:  ctx,
	}, nil
}

func (d *LocalStorageDriver) Delete(ctx context.Context, hash string) error {
	path := d.makePath(hash)
	return os.Remove(path)
}

func (d *LocalStorageDriver) Exists(ctx context.Context, hash string) (bool, error) {
	path := d.makePath(hash)
	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		return false, nil
	}
	return err == nil, err
}

func GarbageCollect(ctx context.Context, storage StorageDriver, repo *Repository) (int64, error) {
     rows, err := repo.GetDB().QueryContext(ctx, "SELECT hash, size FROM garbage_queue")
     if err != nil {
          return 0, err
     }
     defer rows.Close()
     
     type trashItem struct {
          hash string
          size int64
     }
     
     var items []trashItem
     for rows.Next() {
          var item trashItem
          if err := rows.Scan(&item.hash, &item.size); err != nil {
               return 0, err
          }
          items = append(items, item)
     }
     
     if err := rows.Err(); err != nil {
          return 0, err
     }

     var totalCleanedBytes int64 = 0

     for _, item := range items {
          exists, err := storage.Exists(ctx, item.hash)
          if err != nil {
               return totalCleanedBytes, err
          }
          
          if exists {
               if err := storage.Delete(ctx, item.hash); err != nil {
                    return totalCleanedBytes, err
               }
               // Файл успешно удален с диска — плюсуем его размер к счетчику
               totalCleanedBytes += item.size
          } else {
               // Если файла физически уже не было (например, удалили вручную),
               // мы все равно можем засчитать его размер, так как запись из системы уходит.
               totalCleanedBytes += item.size
          }

          // Удаляем отработанную запись из очереди по ее хэшу
          if _, err := repo.GetDB().ExecContext(ctx, "DELETE FROM garbage_queue WHERE hash = ?", item.hash); err != nil {
               return totalCleanedBytes, err
          }
     }

     // Возвращаем итоговое количество освобожденных байт
     return totalCleanedBytes, nil
}