package local

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"context"
	"fmt"
	"strings"
)

const defaultStoragePath = "./data/cas"

func Factory(store AccountStore) vfs.ProviderFactory { return Definition(store).Factory() }

func Definition(store AccountStore) sdk.Definition[Config] {
	return sdk.Definition[Config]{
		Key:      ProviderKey,
		Summary:  "Local filesystem backed by metadata and content-addressed storage",
		Defaults: func() Config { return Config{Mode: ModeBootstrap} },
		Validate: func(ctx context.Context, cfg Config) error {
			mode := strings.TrimSpace(cfg.Mode)
			if mode != "" && mode != ModeBootstrap && mode != ModeAccount {
				return fmt.Errorf("%w: invalid local mode", vfs.ErrInvalidArgument)
			}
			return nil
		},
		Open: func(ctx context.Context, connection vfs.ProviderConnection, cfg Config) (vfs.FSProvider, error) {
			if store == nil {
				return nil, vfs.ErrInvalidNewInstanceParams
			}

			cfg.Mode = strings.TrimSpace(cfg.Mode)
			if cfg.Mode == "" {
				cfg.Mode = ModeBootstrap
			}
			cfg.SubjectKey = strings.TrimSpace(cfg.SubjectKey)
			cfg.Secret = strings.TrimSpace(cfg.Secret)
			cfg.StoragePath = strings.TrimSpace(cfg.StoragePath)

			switch cfg.Mode {
			case ModeBootstrap:
				return NewBootstrapProvider(connection, store), nil

			case ModeAccount:
				account, err := store.Authenticate(ctx, cfg.SubjectKey, cfg.Secret)
				if err != nil {
					return nil, err
				}
				sqlStore, ok := store.(sqlAccountStore)
				if !ok || sqlStore.DB() == nil {
					return nil, vfs.ErrInvalidNewInstanceParams
				}
				storagePath := cfg.StoragePath
				if storagePath == "" {
					storagePath = defaultStoragePath
				}
				return NewAccountProvider(connection, store, account, sqlStore.DB(), NewLocalStorageDriver(storagePath)), nil

			default:
				return nil, fmt.Errorf("invalid local mode: %q", cfg.Mode)
			}
		},
	}
}
