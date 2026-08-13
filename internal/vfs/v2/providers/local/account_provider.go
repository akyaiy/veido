package local

import (
	vfs "MyServer/internal/vfs/v2"
	"MyServer/internal/vfs/v2/virtfs"
	"context"
	"database/sql"
	"errors"
	"os"
	"time"
)

type AccountProvider struct {
	connection vfs.ProviderConnection
	accounts   AccountStore
	account    *Account
	control    *virtfs.FS
	nodes      *nodeStore
	paths      *pathResolver
	artifacts  *artifactStore
}

func NewAccountProvider(connection vfs.ProviderConnection, accounts AccountStore, account *Account, db *sql.DB, storage StorageDriver) *AccountProvider {
	nodes := newNodeStore(db)
	provider := &AccountProvider{
		connection: connection,
		accounts:   accounts,
		account:    account,
		nodes:      nodes,
		paths:      newPathResolver(nodes, account.RootNodeID),
		artifacts:  newArtifactStore(db, storage),
	}
	provider.control = accountControlFS(
		func(ctx context.Context) (*AccountInfo, error) {
			info := provider.account.info()
			info.ConnectionID = provider.connection.ID
			return info, nil
		},
		func(ctx context.Context) (*AccountStats, error) {
			return provider.nodes.stats(ctx, provider.account.RootNodeID)
		},
	)
	return provider
}

func (p *AccountProvider) Stat(ctx context.Context, resourcePath string) (*vfs.Node, error) {
	if isAccountControlPath(resourcePath) {
		return p.control.Stat(ctx, resourcePath)
	}
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

func (p *AccountProvider) ReadDir(ctx context.Context, resourcePath string) ([]*vfs.Node, error) {
	if isAccountControlPath(resourcePath) {
		return p.control.ReadDir(ctx, resourcePath)
	}
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

func (p *AccountProvider) OpenFile(ctx context.Context, resourcePath string, flags int) (vfs.File, error) {
	if isAccountControlPath(resourcePath) {
		return p.control.OpenFile(ctx, resourcePath, flags)
	}

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

	var data []byte
	modTime := time.Now()
	if node != nil {
		data, err = p.readNodeData(ctx, node)
		if err != nil {
			return nil, err
		}
		modTime = node.UpdatedAt
	}
	if flags&os.O_TRUNC != 0 || node == nil {
		data = nil
	}
	offset := int64(0)
	if flags&os.O_APPEND != 0 {
		offset = int64(len(data))
	}

	owner := p.owner(ctx)
	return newWriteFile(name, data, modTime, offset, func(data []byte) error {
		_, err := p.nodes.saveFile(ctx, p.account.RootNodeID, parent.ID, name, owner, data, p.artifacts)
		return err
	}), nil
}

func (p *AccountProvider) Mkdir(ctx context.Context, parentPath string, name string) (*vfs.Node, error) {
	if isAccountControlPath(parentPath) {
		return nil, os.ErrPermission
	}
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

func (p *AccountProvider) Move(ctx context.Context, sourcePath string, targetParentPath string, newName string) error {
	if isAccountControlPath(sourcePath) || isAccountControlPath(targetParentPath) {
		return os.ErrPermission
	}
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

func (p *AccountProvider) Delete(ctx context.Context, resourcePath string) error {
	if isAccountControlPath(resourcePath) {
		return os.ErrPermission
	}
	node, err := p.paths.resolve(ctx, resourcePath)
	if err != nil {
		return err
	}
	return p.nodes.delete(ctx, p.account.RootNodeID, node.ID)
}

func (p *AccountProvider) Control(ctx context.Context, resourcePath string, command string, input []byte) ([]byte, error) {
	if isAccountControlPath(resourcePath) {
		return p.control.Control(ctx, resourcePath, command, input)
	}
	return nil, vfs.ErrNotImplemented
}

func (p *AccountProvider) openReadFile(ctx context.Context, node *metadataNode) (vfs.File, error) {
	data, err := p.readNodeData(ctx, node)
	if err != nil {
		return nil, err
	}
	return newReadFile(node.Name, data, node.UpdatedAt), nil
}

func (p *AccountProvider) readNodeData(ctx context.Context, node *metadataNode) ([]byte, error) {
	if node == nil || !node.Hash.Valid {
		return nil, os.ErrNotExist
	}
	return p.artifacts.readAll(ctx, node.Hash.String)
}

func (p *AccountProvider) owner(ctx context.Context) string {
	if rctx, ok := vfs.RequestContextFromContext(ctx); ok && rctx.ActorKey.Kind != "" && rctx.ActorKey.ID != "" {
		return rctx.ActorKey.String()
	}
	if p.account.OwnerActor != "" {
		return p.account.OwnerActor
	}
	return p.account.SubjectKey
}
