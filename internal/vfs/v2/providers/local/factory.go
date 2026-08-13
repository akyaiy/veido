package local

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"fmt"
)

const defaultStoragePath = "./data/cas"

func Factory(store AccountStore) vfs.ProviderFactory {
	return func(ctx context.Context, connection vfs.ProviderConnection) (vfs.FSProvider, error) {
		if store == nil {
			return nil, vfs.ErrInvalidNewInstanceParams
		}

		cfg, err := parseConfig(connection.Config)
		if err != nil {
			return nil, err
		}

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
	}
}
