package local

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"context"
	"database/sql"
	"errors"
	"io"
	"os"
)

type AccountProvider struct {
	vfs.FSProvider
}

func (p *AccountProvider) Close() error {
	if closer, ok := p.FSProvider.(io.Closer); ok {
		return closer.Close()
	}
	return nil
}

// accountFS implements ordinary filesystem operations; composition owns virtual paths.
type accountFS struct {
	connection vfs.ProviderConnection
	accounts   AccountStore
	account    *Account
	nodes      *nodeStore
	paths      *pathResolver
	artifacts  *artifactStore
}

func NewAccountProvider(connection vfs.ProviderConnection, accounts AccountStore, account *Account, db *sql.DB, storage StorageDriver) *AccountProvider {
	nodes := newNodeStore(db)
	provider := &accountFS{
		connection: connection,
		accounts:   accounts,
		account:    account,
		nodes:      nodes,
		paths:      newPathResolver(nodes, account.RootNodeID),
		artifacts:  newArtifactStore(db, storage),
	}
	control := accountControlFS(
		func(ctx context.Context) (*AccountInfo, error) {
			info := provider.account.info()
			info.ConnectionID = provider.connection.ID
			return info, nil
		},
		func(ctx context.Context) (*AccountStats, error) {
			return provider.nodes.stats(ctx, provider.account.RootNodeID)
		},
	)
	composed, err := sdk.Compose(provider, sdk.Mount{Path: "/" + accountDir, Provider: control, Hidden: true, PreservePath: true})
	if err != nil {
		panic(err)
	} // constant mount declaration is a construction invariant
	return &AccountProvider{FSProvider: composed}
}

func (p *accountFS) Stat(ctx context.Context, resourcePath string) (*vfs.Node, error) {
	node, err := p.paths.resolve(ctx, resourcePath)
	if err != nil {
		return nil, err
	}
	if node.ID == p.account.RootNodeID {
		out := nodeToVFS(node)
		out.Name = "/"
		return out, nil
	}
	return nodeToVFS(node), nil
}

func (p *accountFS) ReadDir(ctx context.Context, resourcePath string) ([]*vfs.Node, error) {
	parent, err := p.paths.resolve(ctx, resourcePath)
	if err != nil {
		return nil, err
	}
	if !parent.IsDir {
		return nil, os.ErrInvalid
	}
	children, err := p.nodes.children(ctx, p.account.RootNodeID, parent.ID)
	if err != nil {
		return nil, err
	}
	nodes := make([]*vfs.Node, 0, len(children))
	for _, child := range children {
		if parent.ID == p.account.RootNodeID && child.Name == accountDir {
			continue
		}
		nodes = append(nodes, nodeToVFS(child))
	}
	return nodes, nil
}

func (p *accountFS) OpenFile(ctx context.Context, resourcePath string, flags int) (vfs.File, error) {

	writeMode := wantsWrite(flags)
	node, err := p.paths.resolve(ctx, resourcePath)
	if err != nil && !(writeMode && errors.Is(err, os.ErrNotExist) && flags&os.O_CREATE != 0) {
		return nil, err
	}
	if err == nil && node.IsDir {
		return nil, os.ErrInvalid
	}
	if err == nil && flags&os.O_CREATE != 0 && flags&os.O_EXCL != 0 {
		return nil, os.ErrExist
	}

	if !writeMode {
		return p.openReadFile(ctx, node)
	}

	parentPath, name, err := splitParent(resourcePath)
	if err != nil {
		return nil, err
	}
	parent, err := p.paths.resolveParent(ctx, parentPath)
	if err != nil {
		return nil, err
	}

	if node != nil && flags&os.O_TRUNC == 0 && flags&os.O_APPEND == 0 {
		return nil, os.ErrInvalid
	}

	writer, err := p.artifacts.createWriter(ctx)
	if err != nil {
		return nil, err
	}
	var initialSize int64
	if node != nil && flags&os.O_APPEND != 0 && flags&os.O_TRUNC == 0 {
		reader, err := p.openReadFile(ctx, node)
		if err != nil {
			_ = writer.Abort()
			return nil, err
		}
		initialSize, err = io.Copy(writer, reader)
		if err != nil {
			_ = reader.Close()
			_ = writer.Abort()
			return nil, err
		}
		if err := reader.Close(); err != nil {
			_ = writer.Abort()
			return nil, err
		}
	}

	owner := p.owner(ctx)
	return newArtifactWriteFile(ctx, name, writer, initialSize, func(artifactID int64, hash string, size int64) error {
		_, err := p.nodes.saveFileArtifact(ctx, p.account.RootNodeID, parent.ID, name, owner, artifactID)
		return err
	}), nil
}

func (p *accountFS) Mkdir(ctx context.Context, parentPath string, name string) (*vfs.Node, error) {
	parent, err := p.paths.resolveParent(ctx, parentPath)
	if err != nil {
		return nil, err
	}
	node, err := p.nodes.createDir(ctx, p.account.RootNodeID, parent.ID, name, p.owner(ctx))
	if err != nil {
		return nil, err
	}
	return nodeToVFS(node), nil
}

func (p *accountFS) Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error {
	source, err := p.paths.resolve(ctx, sourcePath)
	if err != nil {
		return err
	}
	targetParent, err := p.paths.resolveParent(ctx, targetParentPath)
	if err != nil {
		return err
	}
	if newName == "" {
		newName = source.Name
	}
	return p.nodes.move(ctx, p.account.RootNodeID, source.ID, targetParent.ID, newName)
}

func (p *accountFS) Delete(ctx context.Context, resourcePath string) error {
	node, err := p.paths.resolve(ctx, resourcePath)
	if err != nil {
		return err
	}
	return p.nodes.delete(ctx, p.account.RootNodeID, node.ID)
}

func (p *accountFS) Control(ctx context.Context, resourcePath string, command string, input []byte) ([]byte, error) {
	return nil, vfs.ErrNotImplemented
}

func (p *accountFS) openReadFile(ctx context.Context, node *metadataNode) (vfs.File, error) {
	if node == nil || !node.Hash.Valid {
		return nil, os.ErrNotExist
	}
	file, err := p.artifacts.open(ctx, node.Hash.String)
	if err != nil {
		return nil, err
	}
	return newArtifactReadFile(node.Name, node.Size, node.UpdatedAt, file), nil
}

func (p *accountFS) owner(ctx context.Context) string {
	if rctx, ok := vfs.RequestContextFromContext(ctx); ok && rctx.ActorKey.Kind != "" && rctx.ActorKey.ID != "" {
		return rctx.ActorKey.String()
	}
	if p.account.OwnerActor != "" {
		return p.account.OwnerActor
	}
	return p.account.SubjectKey
}
