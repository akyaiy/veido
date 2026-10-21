package v2

import "context"

// Providers main interface.
// Used by the VFS layer to interact with providers.
// Could be used without the VFS layer, e.g. for testing but not recommended, especially for production use (more in providers/provider_laws.doc.md).
type FSProvider interface {
	Stat(ctx context.Context, path string) (*Node, error)
	ReadDir(ctx context.Context, path string) ([]*Node, error)
	OpenFile(ctx context.Context, path string, flags int) (File, error)
	Mkdir(ctx context.Context, parentPath string, name string) (*Node, error)
	Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error
	Delete(ctx context.Context, path string) error
	Control(ctx context.Context, path string, command string, input []byte) ([]byte, error)
}

type ProviderFactory func(ctx context.Context, connection ProviderConnection) (FSProvider, error)

// ProviderRegistry is responsible for registering and assembling providers.
type ProviderRegistry interface {
	Register(providerKey string, factory ProviderFactory)
	Factory(providerKey string) (ProviderFactory, bool)
}

// ProviderPool is responsible for managing provider instances.
type ProviderPool interface {
	Get(ctx context.Context, connection ProviderConnection) (FSProvider, error)
	Invalidate(connection ProviderConnection)
}
