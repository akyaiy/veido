package html

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"MyServer/internal/vfs/v2/providers/html/hooks/getpage"
	"MyServer/internal/vfs/v2/providers/html/hooks/getstatic"
	"MyServer/pkg/vfs/hooks"
	sdk "MyServer/pkg/vfs/providersdk"
	"context"
)

type Config struct {
	StaticTemplateKey string `json:"static_template_key"`
}

func Factory(store *SQLiteStore) vfs.ProviderFactory { return Definition(store).Factory() }

func Definition(store *SQLiteStore) sdk.Definition[Config] {
	return sdk.Definition[Config]{
		Key:     ProviderKey,
		Summary: "HTML site metadata, navigation tree and physical content bindings",
		Defaults: func() Config {
			return Config{StaticTemplateKey: "default-spa"}
		},
		Open: func(ctx context.Context, connection vfs.ProviderConnection, _ Config) (vfs.FSProvider, error) {
			return NewProvider(store, connection)
		},
	}
}

func Module(store *SQLiteStore) sdk.Module[Config] {
	return sdk.Module[Config]{
		Provider: Definition(store),
		Hooks:    []hooks.Definition{getstatic.Definition(), getpage.Definition()},
		Bindings: func(_ context.Context, connection vfs.ProviderConnection, config Config) ([]hooks.Binding, error) {
			siteURI, err := (common.ResourceAddress{
				ProviderKey: ProviderKey, ConnectionKey: connection.ConnectionKey,
				ScopeKey: connection.ScopeKey, Path: "/",
			}).URI()
			if err != nil {
				return nil, err
			}
			staticBinding, err := getstatic.SiteBinding(getstatic.BindingKey(siteURI), siteURI, config.StaticTemplateKey)
			if err != nil {
				return nil, err
			}
			pageBinding, err := getpage.SiteBinding(getpage.BindingKey(siteURI), siteURI, config.StaticTemplateKey)
			if err != nil {
				return nil, err
			}
			return []hooks.Binding{staticBinding, pageBinding}, nil
		},
	}
}
