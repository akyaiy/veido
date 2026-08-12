package local

import (
	vfs "MyServer/internal/vfs/v2"
	"MyServer/internal/vfs/v2/virtfs"
	"context"
	"os"
)

const bootstrapREADME = `# Local account bootstrap

Open create_request.json. It contains a fresh subject_key and secret each time.

To create the account, change done to true and save create_request.json.
If saving succeeds, create_request.json disappears and info.json remains.

After that, put these values into the connection config:

{
  "mode": "account",
  "subject_key": "<subject_key from create_request.json>",
  "secret": "<secret from create_request.json>"
}

The secret is not stored in plain text. If it is lost before updating the
connection config, create a new local bootstrap connection.
`

type BootstrapProvider struct {
	connection vfs.ProviderConnection
	accounts   AccountStore
	control    *virtfs.FS
}

func NewBootstrapProvider(connection vfs.ProviderConnection, accounts AccountStore) *BootstrapProvider {
	provider := &BootstrapProvider{
		connection: connection,
		accounts:   accounts,
	}
	provider.control = bootstrapControlFS(connection, accounts, provider.openCreateRequest, provider.writeCreateRequest)
	return provider
}

func (p *BootstrapProvider) Stat(ctx context.Context, resourcePath string) (*vfs.Node, error) {
	return p.control.Stat(ctx, resourcePath)
}

func (p *BootstrapProvider) ReadDir(ctx context.Context, resourcePath string) ([]*vfs.Node, error) {
	return p.control.ReadDir(ctx, resourcePath)
}

func (p *BootstrapProvider) OpenFile(ctx context.Context, resourcePath string, flags int) (vfs.File, error) {
	return p.control.OpenFile(ctx, resourcePath, flags)
}

func (p *BootstrapProvider) Mkdir(ctx context.Context, parentPath string, name string) (*vfs.Node, error) {
	return nil, os.ErrPermission
}

func (p *BootstrapProvider) Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error {
	return os.ErrPermission
}

func (p *BootstrapProvider) Delete(ctx context.Context, resourcePath string) error {
	return os.ErrPermission
}

func (p *BootstrapProvider) Control(ctx context.Context, resourcePath string, command string, input []byte) ([]byte, error) {
	return p.control.Control(ctx, resourcePath, command, input)
}

func (p *BootstrapProvider) openCreateRequest(ctx context.Context) (vfs.File, error) {
	data, err := newCreateRequestJSON()
	if err != nil {
		return nil, err
	}
	return virtfs.NewReadOnlyFile("create_request.json", data), nil
}

func (p *BootstrapProvider) writeCreateRequest(ctx context.Context, data []byte) error {
	rctx, ok := vfs.RequestContextFromContext(ctx)
	if !ok {
		return vfs.ErrRequestContextNotFound
	}

	payload, err := parseCreateRequest(data)
	if err != nil {
		return err
	}
	if !payload.Done {
		return nil
	}

	_, err = p.accounts.CreateFromBootstrapCredentials(ctx, BootstrapCredentialRequest{
		Connection: p.connection,
		Actor:      rctx.ActorKey,
		SubjectKey: payload.SubjectKey,
		Secret:     payload.Secret,
	})
	return err
}
