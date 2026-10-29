package providers

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"log/slog"
	"os"
	"path"
	"time"
)

func NewDebugProvider() vfs.FSProvider {
	slog.Info("debug provider",
		slog.String("func", "NewDebugProvider()"))
	return &debugProvider{}
}

func FactoryDebug(ctx context.Context, connection vfs.ProviderConnection) (vfs.FSProvider, error) {
	slog.Info("debug provider",
		slog.String("func", "FactoryDebug()"),
		slog.Any("connection", connection),
		slog.String("config", string(connection.Config)))
	return &debugProvider{}, nil
}

// debugProvider is a simple FSProvider implementation that just logs requests.
type debugProvider struct{}

func (debugProvider) Stat(ctx context.Context, path string) (*vfs.Node, error) {
	slog.Info("debug provider",
		slog.String("func", "Stat()"),
		slog.String("path", path))

	if path == "/" {
		return &vfs.Node{
			Name:      "/",
			Kind:      "dir",
			IsDir:     true,
			UpdatedAt: time.Now(),
		}, nil
	}

	return nil, os.ErrNotExist
}

func (debugProvider) ReadDir(ctx context.Context, path string) ([]*vfs.Node, error) {
	slog.Info("debug provider",
		slog.String("func", "ReadDir()"),
		slog.String("path", path))
	if path != "/" {
		return nil, os.ErrNotExist
	}
	return []*vfs.Node{}, nil
}

func (debugProvider) OpenFile(ctx context.Context, path string, flags int) (vfs.File, error) {
	slog.Info("debug provider",
		slog.String("func", "OpenFile()"),
		slog.String("path", path),
		slog.Int("flags", flags))
	return nil, os.ErrNotExist
}

func (debugProvider) Mkdir(ctx context.Context, parentPath string, name string) (*vfs.Node, error) {
	slog.Info("debug provider",
		slog.String("func", "Mkdir()"),
		slog.String("parentPath", parentPath),
		slog.String("name", name))
	if parentPath != "/" {
		return nil, os.ErrNotExist
	}
	return &vfs.Node{
		Name:      path.Base(name),
		Kind:      "dir",
		IsDir:     true,
		UpdatedAt: time.Now(),
	}, nil
}

func (debugProvider) Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error {
	slog.Info("debug provider",
		slog.String("func", "Move()"),
		slog.String("sourcePath", sourcePath),
		slog.String("targetParentPath", targetParentPath),
		slog.String("newName", newName))
	return nil
}

func (debugProvider) Delete(ctx context.Context, path string) error {
	slog.Info("debug provider",
		slog.String("func", "Delete()"),
		slog.String("path", path))
	return nil
}

func (debugProvider) Control(ctx context.Context, path string, command string, input []byte) ([]byte, error) {
	slog.Info("debug provider",
		slog.String("func", "Control()"),
		slog.String("path", path),
		slog.String("command", command),
		slog.String("input", string(input)))
	return nil, nil
}
