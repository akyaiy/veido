package providersdk

import (
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"context"
	"fmt"
)

// Module declares one provider type together with the hooks it owns. A hook
// is an actor-bound VFS scenario, not a resource attachment.
type Module[C any] struct {
	Provider Definition[C]
	Hooks    []hooks.Definition
}

// RegisterModule installs the provider factory and its hook definitions.
func RegisterModule[C any](catalog *Catalog, hookRegistry *hooks.Registry, module Module[C]) error {
	if catalog == nil || hookRegistry == nil || len(module.Hooks) == 0 {
		return fmt.Errorf("%w: invalid provider module", vfs.ErrInvalidArgument)
	}
	for _, definition := range module.Hooks {
		if err := hookRegistry.Register(definition); err != nil {
			return err
		}
	}
	definition := module.Provider
	factory := func(ctx context.Context, connection vfs.ProviderConnection) (vfs.FSProvider, error) {
		provider, _, err := definition.open(ctx, connection)
		if err != nil {
			return nil, err
		}
		return provider, nil
	}
	return registerDefinitionFactory(catalog, definition, factory)
}
