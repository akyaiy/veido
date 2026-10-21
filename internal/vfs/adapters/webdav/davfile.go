package webdav

// import (
// 	"bytes"
// 	"context"
// 	"fmt"
// 	"io"
// 	"os"
// 	"time"
// 	"vfstesting/vfs"
// )

// // davFile реализует интерфейсы webdav.File и os.FileInfo одновременно для простоты
// type davFile struct {
// 	node     vfs.Node
// 	provider vfs.FSProvider
// 	ctx      context.Context

// 	// Для чтения
// 	readCloser io.ReadCloser
// 	seekReader *bytes.Reader // НОВОЕ ПОЛЕ: позволяет делать Seek при чтении

// 	// Для записи
// 	writeBuffer *bytes.Buffer
// 	isDirty     bool 

// 	// Для чтения содержимого папки (Readdir)
// 	dirEntries []vfs.Node
// 	dirOffset  int
// }

// // Реализация os.FileInfo (свойства файла)
// func (f *davFile) Name() string       { return f.node.Name }
// func (f *davFile) Size() int64        { return f.node.Size }
// func (f *davFile) IsDir() bool        { return f.node.IsDir }
// func (f *davFile) ModTime() time.Time { return f.node.UpdatedAt }
// func (f *davFile) Sys() any           { return nil }
// func (f *davFile) Mode() os.FileMode {
// 	if f.node.IsDir {
// 		return os.ModeDir | 0755
// 	}
// 	return 0644
// }

// // Реализация webdav.File
// func (f *davFile) Stat() (os.FileInfo, error) { return f, nil }

// // func (f *davFile) Close() error {
// // 	if f.readCloser != nil {
// // 		return f.readCloser.Close()
// // 	}
// // 	return nil
// // }

// func (f *davFile) Read(p []byte) (int, error) {
// 	if f.node.IsDir {
// 		return 0, os.ErrInvalid
// 	}

// 	// Если уже был вызван Seek и у нас есть seekReader, читаем из него
// 	if f.seekReader != nil {
// 		return f.seekReader.Read(p)
// 	}

// 	// Иначе — стандартное ленивое чтение, как было раньше
// 	if f.readCloser == nil {
// 		rc, err := f.provider.OpenFile(f.ctx, f.node.ID)
// 		if err != nil {
// 			return 0, err
// 		}
// 		f.readCloser = rc
// 	}
// 	return f.readCloser.Read(p)
// }

// // WebDAV вызывает это при просмотре папки (PROPFIND)
// func (f *davFile) Readdir(count int) ([]os.FileInfo, error) {
// 	if !f.node.IsDir {
// 		return nil, os.ErrInvalid
// 	}

// 	// Ленивая загрузка содержимого директории
// 	if f.dirEntries == nil {
// 		entries, err := f.provider.ReadDir(f.ctx, f.node.ID)
// 		if err != nil {
// 			return nil, err
// 		}
// 		f.dirEntries = entries
// 	}

// 	if len(f.dirEntries) == 0 {
// 		return nil, nil
// 	}

// 	if f.dirOffset >= len(f.dirEntries) {
// 		if count > 0 {
// 			return nil, io.EOF
// 		}
// 		return nil, nil
// 	}

// 	var nodesToReturn []vfs.Node
// 	if count <= 0 {
// 		nodesToReturn = f.dirEntries[f.dirOffset:]
// 		f.dirOffset = len(f.dirEntries)
// 	} else {
// 		limit := f.dirOffset + count
// 		if limit > len(f.dirEntries) {
// 			limit = len(f.dirEntries)
// 		}
// 		nodesToReturn = f.dirEntries[f.dirOffset:limit]
// 		f.dirOffset = limit
// 	}

// 	infos := make([]os.FileInfo, len(nodesToReturn))
// 	for i, n := range nodesToReturn {
// 		infos[i] = &davFile{node: n, provider: f.provider, ctx: f.ctx}
// 	}
// 	return infos, nil
// }

// // Write теперь перехватывает поток данных от WebDAV клиента
// func (f *davFile) Write(p []byte) (int, error) {
// 	if f.node.IsDir {
// 		return 0, os.ErrInvalid
// 	}

// 	// Если это первая запись, лениво инициализируем буфер
// 	if f.writeBuffer == nil {
// 		f.writeBuffer = new(bytes.Buffer)
// 	}

// 	f.isDirty = true
// 	return f.writeBuffer.Write(p)
// }

// // Close — самый важный этап при записи!
// func (f *davFile) Close() error {
// 	// Сначала закроем ридер, если он был открыт
// 	if f.readCloser != nil {
// 		if err := f.readCloser.Close(); err != nil {
// 			return err
// 		}
// 	}

// 	// Если в файл производилась запись (был вызван метод Write)
// 	if f.isDirty && f.writeBuffer != nil {
// 		// Извлекаем имя файла и ID родительской папки
// 		// (В твоей структуре Node есть ParentID и Name, это идеально подходит)
// 		parentID := f.node.ParentID
// 		if parentID == "" {
// 			parentID = "0"
// 		}

// 		// Вызываем твой метод сохранения. Он сам посчитает SHA256,
// 		// положит файл в storageDriver и сделает запись/апдейт в metadata!
// 		_, err := f.provider.SaveFile(f.ctx, parentID, f.node.Name, f.writeBuffer)
// 		if err != nil {
// 			return fmt.Errorf("webdav adapter failed to save file: %w", err)
// 		}
		
// 		f.isDirty = false
// 		f.writeBuffer = nil
// 	}

// 	return nil
// }

// func (f *davFile) Seek(offset int64, whence int) (int64, error) {
// 	if f.node.IsDir {
// 		return 0, os.ErrInvalid
// 	}

// 	// СЦЕНАРИЙ 1: Мы пишем в файл (работает writeBuffer)
// 	// Обычно WebDAV клиенты не делают Seek во время PUT-запросов,
// 	// но если это произошло, мы можем делать Seek только в конец (чтобы дописать)
// 	if f.isDirty && f.writeBuffer != nil {
// 		if whence == io.SeekEnd && offset == 0 {
// 			return int64(f.writeBuffer.Len()), nil
// 		}
// 		// Если клиент пытается прыгать посреди записи в случайные места,
// 		// для потокового S3/DB-хранилища это ограничение.
// 		return 0, fmt.Errorf("random seek during write is not supported")
// 	}

// 	// СЦЕНАРИЙ 2: Мы читаем файл
// 	// Если seekReader еще не создан, инициализируем его
// 	if f.seekReader == nil {
// 		if f.readCloser == nil {
// 			// Открываем поток из твоего хранилища StorageDriver
// 			rc, err := f.provider.OpenFile(f.ctx, f.node.ID)
// 			if err != nil {
// 				return 0, err
// 			}
// 			f.readCloser = rc
// 		}

// 		// Вычитываем весь файл в память для возможности произвольного доступа (Seek)
// 		data, err := io.ReadAll(f.readCloser)
// 		if err != nil {
// 			return 0, err
// 		}
// 		_ = f.readCloser.Close() // Поток больше не нужен, мы забрали данные

// 		f.seekReader = bytes.NewReader(data)
// 	}

// 	// Вызываем стандартный Seek у bytes.Reader, он умеет всё (io.SeekStart, io.SeekCurrent, io.SeekEnd)
// 	return f.seekReader.Seek(offset, whence)
// }