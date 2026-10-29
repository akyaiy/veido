package providersdk

import (
	"github.com/akyaiy/veido/pkg/vfs"
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
)

// Catalog implements the existing registry contract and keeps optional SDK
// descriptions/checks alongside factories. It never stores connection secrets.
type Catalog struct {
	mu       sync.RWMutex
	registry vfs.ProviderRegistry
	info     map[string]ProviderInfo
	checks   map[string]func(context.Context, []byte) error
}

func NewCatalog() *Catalog {
	return &Catalog{registry: vfs.NewProviderRegistry(), info: map[string]ProviderInfo{}, checks: map[string]func(context.Context, []byte) error{}}
}
func (c *Catalog) Factory(key string) (vfs.ProviderFactory, bool) { return c.registry.Factory(key) }
func (c *Catalog) Register(key string, factory vfs.ProviderFactory) {
	if key == "" || factory == nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.registry.Register(key, factory)
	delete(c.info, key)
	delete(c.checks, key)
}
func RegisterDefinition[C any](catalog *Catalog, definition Definition[C]) error {
	return registerDefinitionFactory(catalog, definition, definition.Factory())
}

func registerDefinitionFactory[C any](catalog *Catalog, definition Definition[C], factory vfs.ProviderFactory) error {
	if catalog == nil || !validName(definition.Key) || definition.Open == nil {
		return fmt.Errorf("%w: invalid provider definition", vfs.ErrInvalidArgument)
	}
	if _, err := (vfs.ResourceAddress{ProviderKey: definition.Key, ConnectionKey: "default", ScopeKey: "dev", Path: "/"}).URI(); err != nil {
		return err
	}
	catalog.mu.Lock()
	defer catalog.mu.Unlock()
	if _, exists := catalog.registry.Factory(definition.Key); exists {
		return fmt.Errorf("%w: provider %q", vfs.ErrAlreadyExists, definition.Key)
	}
	catalog.registry.Register(definition.Key, factory)
	catalog.info[definition.Key] = definition.Info()
	catalog.checks[definition.Key] = definition.CheckConfig
	return nil
}
func (c *Catalog) Providers() []ProviderInfo {
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make([]ProviderInfo, 0, len(c.info))
	for _, info := range c.info {
		info.ConfigSchema = cloneSchema(info.ConfigSchema)
		out = append(out, info)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Key < out[j].Key })
	return out
}
func (c *Catalog) Check(ctx context.Context, key string, config []byte) error {
	c.mu.RLock()
	check, ok := c.checks[key]
	c.mu.RUnlock()
	if !ok {
		return vfs.ErrUnsupported
	}
	return check(ctx, config)
}
func cloneSchema(value any) any {
	if value == nil {
		return nil
	}
	data, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var copy any
	_ = json.Unmarshal(data, &copy)
	return copy
}
