package v2

import (
	"context"
	"fmt"
	"io"
	"sync"
)

type SimpleProviderRegistry struct {
	mu        sync.RWMutex
	factories map[string]ProviderFactory
}

func NewProviderRegistry() ProviderRegistry {
	return &SimpleProviderRegistry{
		factories: make(map[string]ProviderFactory),
	}
}

func (r *SimpleProviderRegistry) Register(providerKey string, factory ProviderFactory) {
	if providerKey == "" || factory == nil {
		return
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.factories[providerKey] = factory
}

func (r *SimpleProviderRegistry) Factory(providerKey string) (ProviderFactory, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	factory, ok := r.factories[providerKey]
	return factory, ok
}

type CachedProviderPool struct {
	registry ProviderRegistry
	mu       sync.Mutex
	cache    map[string]FSProvider
}

func NewProviderPool(registry ProviderRegistry) (ProviderPool, error) {
	if registry == nil {
		return nil, ErrInvalidNewInstanceParams
	}

	return &CachedProviderPool{
		registry: registry,
		cache:    make(map[string]FSProvider),
	}, nil
}

func (p *CachedProviderPool) Get(ctx context.Context, connection ProviderConnection) (FSProvider, error) {
	cacheKey, err := providerConnectionCacheKey(connection)
	if err != nil {
		return nil, err
	}
	if connection.ConnectionKey == "" {
		return nil, ErrConnectionNotFound
	}
	if connection.ProviderKey == "" {
		return nil, ErrInvalidProvider
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if provider, ok := p.cache[cacheKey]; ok {
		return provider, nil
	}

	factory, ok := p.registry.Factory(connection.ProviderKey)
	if !ok {
		return nil, ErrInvalidProvider
	}

	provider, err := factory(ctx, connection)
	if err != nil {
		return nil, err
	}

	p.cache[cacheKey] = provider
	return provider, nil
}

func (p *CachedProviderPool) Invalidate(connection ProviderConnection) {
	cacheKey, err := providerConnectionCacheKey(connection)
	if err != nil {
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	provider, ok := p.cache[cacheKey]
	if !ok {
		return
	}

	delete(p.cache, cacheKey)
	if closer, ok := provider.(io.Closer); ok {
		_ = closer.Close()
	}
}

func providerConnectionCacheKey(connection ProviderConnection) (string, error) {
	if connection.ScopeKey == "" {
		return "", ErrInvalidScope
	}
	if connection.ProviderKey == "" {
		return "", ErrInvalidProvider
	}
	if connection.ConnectionKey == "" {
		return "", ErrConnectionNotFound
	}
	return fmt.Sprintf("%s/%s/%s", connection.ScopeKey, connection.ProviderKey, connection.ConnectionKey), nil
}
