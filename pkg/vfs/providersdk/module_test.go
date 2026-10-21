package providersdk_test

import (
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"MyServer/pkg/vfs/hooksdk"
	sdk "MyServer/pkg/vfs/providersdk"
	"context"
	"encoding/json"
	"testing"
)

type moduleOutput struct {
	Registered bool `json:"registered"`
}

type unusedFrontend struct{}

func (unusedFrontend) Stat(context.Context, vfs.Actor, vfs.URI) (*vfs.Node, error) {
	return nil, vfs.ErrUnsupported
}
func (unusedFrontend) ReadDir(context.Context, vfs.Actor, vfs.URI) ([]*vfs.Node, error) {
	return nil, vfs.ErrUnsupported
}
func (unusedFrontend) OpenFile(context.Context, vfs.Actor, vfs.URI, int) (vfs.File, error) {
	return nil, vfs.ErrUnsupported
}
func (unusedFrontend) Mkdir(context.Context, vfs.Actor, vfs.URI) (*vfs.Node, error) {
	return nil, vfs.ErrUnsupported
}
func (unusedFrontend) Move(context.Context, vfs.Actor, vfs.URI, vfs.URI) error {
	return vfs.ErrUnsupported
}
func (unusedFrontend) Delete(context.Context, vfs.Actor, vfs.URI) error {
	return vfs.ErrUnsupported
}
func (unusedFrontend) Control(context.Context, vfs.Actor, vfs.URI, string, []byte) ([]byte, error) {
	return nil, vfs.ErrUnsupported
}

func TestModuleRegistersHookDefinition(t *testing.T) {
	hookRegistry := hooks.NewRegistry(hooks.DefaultEngines())
	catalog := sdk.NewCatalog()
	definition := hooksdk.Native("module-static", 1, hooksdk.NativeOptions{Enabled: true, Active: true}, func(_ context.Context, _ hooks.Execution, _ struct{}) (moduleOutput, error) {
		return moduleOutput{Registered: true}, nil
	})
	module := sdk.Module[struct{}]{
		Provider: sdk.Definition[struct{}]{
			Key:      "module-provider",
			Defaults: func() struct{} { return struct{}{} },
			Open: func(context.Context, vfs.ProviderConnection, struct{}) (vfs.FSProvider, error) {
				return sdk.New().Build()
			},
		},
		Hooks: []hooks.Definition{definition},
	}
	if err := sdk.RegisterModule(catalog, hookRegistry, module); err != nil {
		t.Fatal(err)
	}
	if err := hookRegistry.Freeze(context.Background()); err != nil {
		t.Fatal(err)
	}
	runtime, err := hooks.NewRuntime(hookRegistry, unusedFrontend{}, hooks.NewMemoryExecutionStore())
	if err != nil {
		t.Fatal(err)
	}
	connection := vfs.ProviderConnection{ID: 1, ProviderKey: "module-provider", ConnectionKey: "site", ScopeKey: "acme", Config: json.RawMessage(`{}`)}
	factory, ok := catalog.Factory(connection.ProviderKey)
	if !ok {
		t.Fatal("provider factory was not registered")
	}
	provider, err := factory(context.Background(), connection)
	if err != nil {
		t.Fatal(err)
	}
	if provider == nil {
		t.Fatal("provider factory returned nil")
	}
	result, err := runtime.Run(context.Background(), vfs.Actor{Kind: vfs.ActorGuest}, "module-static", json.RawMessage(`{}`), hooks.RunOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var output moduleOutput
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	if !output.Registered {
		t.Fatalf("module hook output = %+v", output)
	}
}
