package v2

import "context"

// Providers main interface
type FSProvider interface {
    Stat(ctx context.Context, targetId string) (Node, error)
    ReadDir(ctx context.Context, targetId string) ([]Node, error)
    OpenFile(ctx context.Context, targetId string, flags int) (File, error)
    Mkdir(ctx context.Context, targetId string, name string) (Node, error)
    Move(ctx context.Context, sourceTargetId string, targetParentId string, newName string) error
    Delete(ctx context.Context, targetId string) error
    Control(ctx context.Context, targetId string, input []byte) ([]byte, error)
}

type ProviderFactory func(ctx context.Context, connection ProviderConnection) (FSProvider, error)

// ProviderRegistry is responsible for registering and assembling providers.
type ProviderRegistry interface {
    Register(provider string, factory ProviderFactory)
    Factory(provider string) (ProviderFactory, bool)
}

// ProviderPool is responsible for managing provider instances.
type ProviderPool interface {
    Get(ctx context.Context, connection ProviderConnection) (FSProvider, error)
    Invalidate(connection ProviderConnection)
}