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

type moduleConfig struct {
	Template string `json:"template"`
}

type moduleOutput struct {
	Resource string `json:"resource"`
	Template string `json:"template"`
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

func TestModuleRegistersHookDefinitionAndBindingWhenProviderOpens(t *testing.T) {
	hookRegistry := hooks.NewRegistry(hooks.DefaultEngines())
	catalog := sdk.NewCatalog()
	definition := hooksdk.Native("module-static", 1, hooksdk.NativeOptions{Enabled: true, Active: true}, func(_ context.Context, execution hooks.Execution, _ struct{}) (moduleOutput, error) {
		var config moduleConfig
		if err := json.Unmarshal(execution.Binding.Config, &config); err != nil {
			return moduleOutput{}, err
		}
		return moduleOutput{Resource: string(execution.Binding.ResourceURI), Template: config.Template}, nil
	})
	module := sdk.Module[moduleConfig]{
		Provider: sdk.Definition[moduleConfig]{
			Key:      "module-provider",
			Defaults: func() moduleConfig { return moduleConfig{Template: "default-spa/1"} },
			Open: func(context.Context, vfs.ProviderConnection, moduleConfig) (vfs.FSProvider, error) {
				return sdk.New().Build()
			},
		},
		Hooks: []hooks.Definition{definition},
		Bindings: func(_ context.Context, connection vfs.ProviderConnection, config moduleConfig) ([]hooks.Binding, error) {
			resource, err := (vfs.ResourceAddress{ProviderKey: connection.ProviderKey, ConnectionKey: connection.ConnectionKey, ScopeKey: connection.ScopeKey, Path: "/"}).URI()
			if err != nil {
				return nil, err
			}
			binding, err := hooksdk.ResourceBinding("module-provider.static", "module-static", 1, resource, config)
			return []hooks.Binding{binding}, err
		},
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
	resource, err := (vfs.ResourceAddress{ProviderKey: connection.ProviderKey, ConnectionKey: connection.ConnectionKey, ScopeKey: connection.ScopeKey, Path: "/"}).URI()
	if err != nil {
		t.Fatal(err)
	}
	result, err := runtime.RunResource(context.Background(), vfs.Actor{Kind: vfs.ActorGuest}, resource, "module-static", json.RawMessage(`{}`), hooks.RunOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var output moduleOutput
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	if output.Resource != string(resource) || output.Template != "default-spa/1" {
		t.Fatalf("module hook output = %+v", output)
	}
	connection.ConfigVersion = 2
	connection.Config = json.RawMessage(`{"template":"custom/2"}`)
	if _, err := factory(context.Background(), connection); err != nil {
		t.Fatal(err)
	}
	result, err = runtime.RunResource(context.Background(), vfs.Actor{Kind: vfs.ActorGuest}, resource, "module-static", json.RawMessage(`{}`), hooks.RunOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	if output.Template != "custom/2" {
		t.Fatalf("updated module hook output = %+v", output)
	}
}
