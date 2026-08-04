package v2

import "context"

// Providers main interface
type FSProvider interface {
    Stat(ctx context.Context, id string) (Node, error)
    ReadDir(ctx context.Context, target string) ([]Node, error)
    OpenFile(ctx context.Context, target string, flags int) (File, error)
    Mkdir(ctx context.Context, parent string, name string) (Node, error)
    Move(ctx context.Context, source string, targetParent string, newName string) error
    Delete(ctx context.Context, target string) error
    Control(ctx context.Context, target string, input []byte) ([]byte, error)
}

type ProviderFactoryContract interface {
    New(ctx context.Context, connection ProviderConnection) (FSProvider, error)
}

type ProviderRegistry interface {
    Register(provider string, factory ProviderFactoryContract)
    Factory(provider string) (ProviderFactoryContract, bool)
    Get(ctx context.Context, connection ProviderConnection) (FSProvider, error)
    Invalidate(connection ProviderConnection)
}