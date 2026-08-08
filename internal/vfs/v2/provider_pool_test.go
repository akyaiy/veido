package v2

import (
	"context"
	"errors"
	"testing"
)

type testProvider struct {
	closed bool
}

func (p *testProvider) Stat(ctx context.Context, path string) (*Node, error) {
	return nil, nil
}

func (p *testProvider) ReadDir(ctx context.Context, path string) ([]*Node, error) {
	return nil, nil
}

func (p *testProvider) OpenFile(ctx context.Context, path string, flags int) (File, error) {
	return nil, nil
}

func (p *testProvider) Mkdir(ctx context.Context, parentPath string, name string) (*Node, error) {
	return nil, nil
}

func (p *testProvider) Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error {
	return nil
}

func (p *testProvider) Delete(ctx context.Context, path string) error {
	return nil
}

func (p *testProvider) Control(ctx context.Context, path string, command string, input []byte) ([]byte, error) {
	return nil, nil
}

func (p *testProvider) Close() error {
	p.closed = true
	return nil
}

func TestProviderRegistry(t *testing.T) {
	registry := NewProviderRegistry()

	if _, ok := registry.Factory("debug"); ok {
		t.Fatal("Factory(debug) exists before Register")
	}

	provider := &testProvider{}
	registry.Register("debug", func(ctx context.Context, connection ProviderConnection) (FSProvider, error) {
		return provider, nil
	})

	factory, ok := registry.Factory("debug")
	if !ok {
		t.Fatal("Factory(debug) missing after Register")
	}

	got, err := factory(context.Background(), ProviderConnection{})
	if err != nil {
		t.Fatalf("factory() error = %v", err)
	}
	if got != provider {
		t.Fatalf("factory() = %p, want %p", got, provider)
	}
}

func TestCachedProviderPoolCachesByConnectionKey(t *testing.T) {
	registry := NewProviderRegistry()
	created := 0
	registry.Register("debug", func(ctx context.Context, connection ProviderConnection) (FSProvider, error) {
		created++
		return &testProvider{}, nil
	})

	pool, err := NewProviderPool(registry)
	if err != nil {
		t.Fatalf("NewProviderPool() error = %v", err)
	}

	connection := ProviderConnection{
		ScopeKey:      "debug",
		ProviderKey:   "debug",
		ConnectionKey: "default",
	}

	first, err := pool.Get(context.Background(), connection)
	if err != nil {
		t.Fatalf("first Get() error = %v", err)
	}

	second, err := pool.Get(context.Background(), connection)
	if err != nil {
		t.Fatalf("second Get() error = %v", err)
	}

	if first != second {
		t.Fatalf("pool returned different providers for same connection")
	}
	if created != 1 {
		t.Fatalf("factory calls = %d, want 1", created)
	}
}

func TestCachedProviderPoolInvalidate(t *testing.T) {
	registry := NewProviderRegistry()
	created := 0
	var invalidated *testProvider
	registry.Register("debug", func(ctx context.Context, connection ProviderConnection) (FSProvider, error) {
		created++
		provider := &testProvider{}
		if created == 1 {
			invalidated = provider
		}
		return provider, nil
	})

	pool, err := NewProviderPool(registry)
	if err != nil {
		t.Fatalf("NewProviderPool() error = %v", err)
	}

	connection := ProviderConnection{
		ScopeKey:      "debug",
		ProviderKey:   "debug",
		ConnectionKey: "default",
	}

	first, err := pool.Get(context.Background(), connection)
	if err != nil {
		t.Fatalf("first Get() error = %v", err)
	}

	pool.Invalidate(connection)

	second, err := pool.Get(context.Background(), connection)
	if err != nil {
		t.Fatalf("second Get() error = %v", err)
	}

	if first == second {
		t.Fatal("pool returned invalidated provider")
	}
	if !invalidated.closed {
		t.Fatal("Invalidate() did not close cached provider")
	}
	if created != 2 {
		t.Fatalf("factory calls = %d, want 2", created)
	}
}

func TestCachedProviderPoolUnknownProvider(t *testing.T) {
	pool, err := NewProviderPool(NewProviderRegistry())
	if err != nil {
		t.Fatalf("NewProviderPool() error = %v", err)
	}

	_, err = pool.Get(context.Background(), ProviderConnection{
		ScopeKey:      "debug",
		ProviderKey:   "missing",
		ConnectionKey: "default",
	})
	if !errors.Is(err, ErrInvalidProvider) {
		t.Fatalf("Get() error = %v, want %v", err, ErrInvalidProvider)
	}
}
