package providersdk

import (
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"context"
	"fmt"
	"io"
)

// Module declares one provider type together with the hooks it owns. Hook
// definitions are registered once with the provider type; Bindings are
// created for each successfully opened provider connection.
type Module[C any] struct {
	Provider Definition[C]
	Hooks    []hooks.Definition
	Bindings func(context.Context, vfs.ProviderConnection, C) ([]hooks.Binding, error)
}

// RegisterModule installs the provider factory and its hook definitions. The
// wrapped factory registers connection-specific bindings after Open succeeds.
func RegisterModule[C any](catalog *Catalog, hookRegistry *hooks.Registry, module Module[C]) error {
	if catalog == nil || hookRegistry == nil || module.Bindings == nil || len(module.Hooks) == 0 {
		return fmt.Errorf("%w: invalid provider module", vfs.ErrInvalidArgument)
	}
	for _, definition := range module.Hooks {
		if err := hookRegistry.Register(definition); err != nil {
			return err
		}
	}
	definition := module.Provider
	factory := func(ctx context.Context, connection vfs.ProviderConnection) (vfs.FSProvider, error) {
		provider, config, err := definition.open(ctx, connection)
		if err != nil {
			return nil, err
		}
		bindings, err := module.Bindings(ctx, connection, config)
		if err == nil && len(bindings) == 0 {
			err = fmt.Errorf("%w: provider module returned no hook bindings", vfs.ErrInvalidArgument)
		}
		if err == nil {
			for _, binding := range bindings {
				if registerErr := hookRegistry.SetBinding(binding); registerErr != nil {
					err = registerErr
					break
				}
			}
		}
		if err != nil {
			if closer, ok := provider.(io.Closer); ok {
				_ = closer.Close()
			}
			return nil, err
		}
		return provider, nil
	}
	return registerDefinitionFactory(catalog, definition, factory)
}
