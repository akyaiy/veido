package providers

// import (
// 	"context"
// 	"io"
// 	"path"
// 	"time"

// 	"github.com/spf13/afero"
// 	"vfstesting/vfs" // Замени на свой реальный путь к базовому пакету vfs
// )

// // AferoAdapter адаптирует любую файловую систему из экосистемы Afero под интерфейс FSProvider
// type AferoAdapter struct {
// 	fs afero.Fs
// }

// // NewAferoAdapter создает новый экземпляр адаптера
// func NewAferoAdapter(fs afero.Fs) vfs.FSProvider {
// 	return &AferoAdapter{fs: fs}
// }

// // cleanPath нормализует путь, убирая уязвимости обхода директорий (типа ../..)
// func (a *AferoAdapter) cleanPath(p string) string {
// 	return path.Clean("/" + p)
// }

// func (a *AferoAdapter) ResolvePathToID(ctx context.Context, filePath string) (string, error) {
// 	return a.cleanPath(filePath), nil
// }

// // ReadDir возвращает список элементов внутри указанной директории
// func (a *AferoAdapter) ReadDir(ctx context.Context, dirID string) ([]vfs.Node, error) {
// 	targetPath := a.cleanPath(dirID)

// 	files, err := afero.ReadDir(a.fs, targetPath)
// 	if err != nil {
// 		return nil, err
// 	}

// 	nodes := make([]vfs.Node, 0, len(files))
// 	for _, f := range files {
// 		nodes = append(nodes, vfs.Node{
// 			ID:       path.Join(targetPath, f.Name()),
// 			ParentID: targetPath,
// 			Name:     f.Name(),
// 			IsDir:    f.IsDir(),
// 			Size:     f.Size(),
// 			UpdatedAt:  f.ModTime(),
// 		})
// 	}

// 	return nodes, nil
// }

// // OpenFile возвращает поток для чтения содержимого файла
// func (a *AferoAdapter) OpenFile(ctx context.Context, fileID string) (io.ReadCloser, error) {
// 	targetPath := a.cleanPath(fileID)
	
// 	file, err := a.fs.Open(targetPath)
// 	if err != nil {
// 		return nil, err
// 	}
// 	return file, nil
// }

// // SaveFile создает или перезаписывает файл в указанной директории
// func (a *AferoAdapter) SaveFile(ctx context.Context, parentDirID, name string, src io.Reader) (vfs.Node, error) {
// 	parentPath := a.cleanPath(parentDirID)
// 	fullPath := path.Join(parentPath, name)

// 	file, err := a.fs.Create(fullPath)
// 	if err != nil {
// 		return vfs.Node{}, err
// 	}
// 	defer file.Close()

// 	size, err := io.Copy(file, src)
// 	if err != nil {
// 		return vfs.Node{}, err
// 	}

// 	return vfs.Node{
// 		ID:       fullPath,
// 		ParentID: parentPath,
// 		Name:     name,
// 		IsDir:    false,
// 		Size:     size,
// 		UpdatedAt:  time.Now(),
// 	}, nil
// }

// // Mkdir создает новую директорию
// func (a *AferoAdapter) Mkdir(ctx context.Context, parentDirID, name string) (vfs.Node, error) {
// 	parentPath := a.cleanPath(parentDirID)
// 	fullPath := path.Join(parentPath, name)

// 	// Создаем папку со стандартными правами доступа
// 	err := a.fs.MkdirAll(fullPath, 0755)
// 	if err != nil {
// 		return vfs.Node{}, err
// 	}

// 	return vfs.Node{
// 		ID:       fullPath,
// 		ParentID: parentPath,
// 		Name:     name,
// 		IsDir:    true,
// 		Size:     0,
// 		UpdatedAt:  time.Now(),
// 	}, nil
// }

// // Stat возвращает метаданные конкретного узла
// func (a *AferoAdapter) Stat(ctx context.Context, id string) (vfs.Node, error) {
// 	targetPath := a.cleanPath(id)

// 	info, err := a.fs.Stat(targetPath)
// 	if err != nil {
// 		return vfs.Node{}, err
// 	}

// 	parentPath := path.Dir(targetPath)
// 	if targetPath == "/" {
// 		parentPath = "" // У корня дерева нет родительской папки
// 	}

// 	return vfs.Node{
// 		ID:       targetPath,
// 		ParentID: parentPath,
// 		Name:     info.Name(),
// 		IsDir:    info.IsDir(),
// 		Size:     info.Size(),
// 		UpdatedAt:  info.ModTime(),
// 	}, nil
// }

// // Delete удаляет файл или директорию со всем ее содержимым
// func (a *AferoAdapter) Delete(ctx context.Context, id string) error {
// 	targetPath := a.cleanPath(id)
// 	return a.fs.RemoveAll(targetPath)
// }

// // Move перемещает/переименовывает узел в рамках этой файловой системы
// func (a *AferoAdapter) Move(ctx context.Context, id string, newParentID string, newName string) error {
// 	oldPath := a.cleanPath(id)
// 	newParentPath := a.cleanPath(newParentID)
// 	newPath := path.Join(newParentPath, newName)

// 	return a.fs.Rename(oldPath, newPath)
// }