package html

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"github.com/akyaiy/veido/internal/vfs/v2/providers/html/hooks/getstatic"
	"github.com/akyaiy/veido/pkg/vfs/hooks"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
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
		Hooks:    []hooks.Definition{getstatic.Definition()},
	}
}
