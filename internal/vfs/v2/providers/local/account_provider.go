package local

import (
	vfs "MyServer/internal/vfs/v2"
	"MyServer/internal/vfs/v2/virtfs"
	"context"
)

type AccountProvider struct {
	connection vfs.ProviderConnection
	accounts   AccountStore
	account    *Account
	control    *virtfs.FS
}

func NewAccountProvider(connection vfs.ProviderConnection, accounts AccountStore, account *Account) *AccountProvider {
	provider := &AccountProvider{
		connection: connection,
		accounts:   accounts,
		account:    account,
	}
	provider.control = accountControlFS(func(ctx context.Context) (*AccountInfo, error) {
		info := provider.account.info()
		info.ConnectionID = provider.connection.ID
		return info, nil
	})
	return provider
}

func (p *AccountProvider) Stat(ctx context.Context, resourcePath string) (*vfs.Node, error) {
	if isAccountControlPath(resourcePath) {
		return p.control.Stat(ctx, resourcePath)
	}
	switch cleanPath(resourcePath) {
	case "/":
		return virtfs.DirNode("/"), nil
	default:
		return nil, vfs.ErrNotImplemented
	}
}

func (p *AccountProvider) ReadDir(ctx context.Context, resourcePath string) ([]*vfs.Node, error) {
	if isAccountControlPath(resourcePath) {
		return p.control.ReadDir(ctx, resourcePath)
	}
	switch cleanPath(resourcePath) {
	case "/":
		return []*vfs.Node{}, nil
	default:
		return nil, vfs.ErrNotImplemented
	}
}

func (p *AccountProvider) OpenFile(ctx context.Context, resourcePath string, flags int) (vfs.File, error) {
	if isAccountControlPath(resourcePath) {
		return p.control.OpenFile(ctx, resourcePath, flags)
	}
	return nil, vfs.ErrNotImplemented
}

func (p *AccountProvider) Mkdir(ctx context.Context, parentPath string, name string) (*vfs.Node, error) {
	return nil, vfs.ErrNotImplemented
}

func (p *AccountProvider) Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error {
	return vfs.ErrNotImplemented
}

func (p *AccountProvider) Delete(ctx context.Context, resourcePath string) error {
	return vfs.ErrNotImplemented
}

func (p *AccountProvider) Control(ctx context.Context, resourcePath string, command string, input []byte) ([]byte, error) {
	if isAccountControlPath(resourcePath) {
		return p.control.Control(ctx, resourcePath, command, input)
	}
	return nil, vfs.ErrNotImplemented
}
