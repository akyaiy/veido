package v2

import (
	"MyServer/internal/common"
	"context"
)

type VFSCore struct {
    scopeResolver      ScopeResolverContract
    connectionResolver ConnectionResolverContract
    
    providerRegistry   ProviderRegistry
    providerPool       ProviderPool
    
    authorizer         Authorizer
    lifecycle          ResourceLifecycleSink
}

type VFSFrontend interface {
	Stat(ctx context.Context, actor Actor, uri common.CanonURI) (Node, error)
    ReadDir(ctx context.Context, actor Actor, uri common.CanonURI) ([]Node, error)
    OpenFile(ctx context.Context, actor Actor, uri common.CanonURI, flag int) (File, error)
    Mkdir(ctx context.Context, actor Actor, uri common.CanonURI) (Node, error)
    Move(ctx context.Context, actor Actor, source common.CanonURI, target common.CanonURI) error
    Delete(ctx context.Context, actor Actor, uri common.CanonURI) error
    Control(ctx context.Context, actor Actor, uri common.CanonURI, input []byte) ([]byte, error)
}

// NewVFS creates new VFS core instance. 
// Requires [ScopeResolverContract], [ConnectionResolverContract], [ProviderRegistry], 
// [ProviderPool], [Authorizer], [ResourceLifecycleSink].
func NewVFS(scopeResolver ScopeResolverContract, 
	connectionResolver ConnectionResolverContract,
	providerRegistry ProviderRegistry,
	providerPool ProviderPool,
	authorizer Authorizer,
	lifecycle ResourceLifecycleSink) (VFSFrontend, error) {
	if scopeResolver == nil || 
		connectionResolver == nil || 
		providerRegistry == nil || 
		providerPool == nil ||
		authorizer == nil ||
		lifecycle == nil {
		return nil, ErrInvalidNewInstanceParams
	}
	newCore := &VFSCore{
		scopeResolver: scopeResolver,
		connectionResolver: connectionResolver,
		providerRegistry: providerRegistry,
		authorizer: authorizer,
		lifecycle: lifecycle,
	}
	return newCore, nil
}

