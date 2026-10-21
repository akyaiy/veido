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
	cache    map[string]cachedProvider
}

// Close releases all cached provider instances. It is deliberately optional
// on ProviderPool, preserving the small contract used by test doubles.
func (p *CachedProviderPool) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	for key, item := range p.cache {
		delete(p.cache, key)
		closeProvider(item.provider)
	}
	return nil
}

type cachedProvider struct {
	configVersion int64
	provider      FSProvider
}

func NewProviderPool(registry ProviderRegistry) (ProviderPool, error) {
	if registry == nil {
		return nil, ErrInvalidNewInstanceParams
	}

	return &CachedProviderPool{
		registry: registry,
		cache:    make(map[string]cachedProvider),
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

	if item, ok := p.cache[cacheKey]; ok {
		if item.configVersion == connection.ConfigVersion {
			return item.provider, nil
		}

		delete(p.cache, cacheKey)
		closeProvider(item.provider)
	}

	factory, ok := p.registry.Factory(connection.ProviderKey)
	if !ok {
		return nil, ErrInvalidProvider
	}

	provider, err := factory(ctx, connection)
	if err != nil {
		return nil, err
	}

	p.cache[cacheKey] = cachedProvider{
		configVersion: connection.ConfigVersion,
		provider:      provider,
	}
	return provider, nil
}

func (p *CachedProviderPool) Invalidate(connection ProviderConnection) {
	cacheKey, err := providerConnectionCacheKey(connection)
	if err != nil {
		return
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	item, ok := p.cache[cacheKey]
	if !ok {
		return
	}

	delete(p.cache, cacheKey)
	closeProvider(item.provider)
}

func closeProvider(provider FSProvider) {
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
