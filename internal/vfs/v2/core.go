package v2

import (
	"MyServer/internal/common"
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
)

// VFSFrontend is the main interface for the VFS core.
// All VFS operations are forwarded to the providers through the core.
// Most operations are UNIX-stylish.
type VFSFrontend interface {
	// Stat returns the node at the given URI.
	Stat(ctx context.Context, actor Actor, uri common.CanonURI) (*Node, error)

	// ReadDir returns the directory contents at the given URI.
	ReadDir(ctx context.Context, actor Actor, uri common.CanonURI) ([]*Node, error)

	// OpenFile returns a file handle for the given URI.
	// Uses UNIX-style flags (os.O_RDONLY, os.O_WRONLY, os.O_RDWR, etc.)
	OpenFile(ctx context.Context, actor Actor, uri common.CanonURI, flag int) (File, error)

	// Mkdir creates a new directory at the given URI.
	Mkdir(ctx context.Context, actor Actor, uri common.CanonURI) (*Node, error)

	// Move moves a resource from the source URI to the target URI.
	Move(ctx context.Context, actor Actor, source common.CanonURI, target common.CanonURI) error

	// Delete deletes the resource at the given URI.
	Delete(ctx context.Context, actor Actor, uri common.CanonURI) error

	// Control sends a control request to the provider.
	Control(ctx context.Context, actor Actor, uri common.CanonURI, command string, input []byte) ([]byte, error)
}

// VFSCore is the main struct implementing the VFS core.
type VFSCore struct {
	// scopeResolver resolves the scope for a given actor and scope name.
	scopeResolver ScopeResolverContract

	// connectionResolver resolves the connection for a given scope and provider key.
	connectionResolver ConnectionResolverContract

	// providerPool manages the lifecycle of provider connections.
	providerPool ProviderPool

	// authorizer authorizes the actor for a given resource.
	authorizer Authorizer

	// lifecycle is the sink for resource lifecycle events.
	lifecycle ResourceLifecycleSink
}

// resolvedResource holds the resolved state of a resource.
type resolvedResource struct {
	Address    common.ResourceAddress
	Scope      Scope
	Connection ProviderConnection
	Ref        common.ResourceRef
}

// NewVFS creates new VFS core instance.
// Requires [ScopeResolverContract], [ConnectionResolverContract], [ProviderPool], [Authorizer], [ResourceLifecycleSink].
func NewVFS(scopeResolver ScopeResolverContract,
	connectionResolver ConnectionResolverContract,
	providerPool ProviderPool,
	authorizer Authorizer,
	lifecycle ResourceLifecycleSink) (VFSFrontend, error) {
	if scopeResolver == nil ||
		connectionResolver == nil ||
		providerPool == nil ||
		authorizer == nil ||
		lifecycle == nil {
		return nil, ErrInvalidNewInstanceParams
	}
	newCore := &VFSCore{
		scopeResolver:      scopeResolver,
		connectionResolver: connectionResolver,
		providerPool:       providerPool,
		authorizer:         authorizer,
		lifecycle:          lifecycle,
	}
	return newCore, nil
}

// getProvider resolves the provider instance for the given connection.
func (c *VFSCore) getProvider(ctx context.Context, connection ProviderConnection) (FSProvider, error) {
	return c.providerPool.Get(ctx, connection)
}

// canActorAccessScope checks whether the actor may enter the scope namespace.
// This gate is deliberately separate from authorization of the target resource.
func (c *VFSCore) canActorAccessScope(ctx context.Context, actor Actor, scope Scope) (bool, error) {
	ref, err := scopeAccessRef(scope.Key)
	if err != nil {
		return false, err
	}
	return c.authorizer.Can(ctx, actor, common.ActionExec, ref)
}

func scopeAccessRef(scopeKey string) (common.ResourceRef, error) {
	if scopeKey == "" || scopeKey == "." || scopeKey == ".." || strings.Contains(scopeKey, "/") {
		return common.ResourceRef{}, fmt.Errorf("%w: scope key must be one path segment", ErrInvalidScope)
	}
	return common.ResourceRef{
		ProviderKey:   "scopes",
		ConnectionKey: "scopes",
		ScopeKey:      "system",
		Path:          fmt.Sprintf("/scopes/%s", scopeKey),
	}, nil
}

func (c *VFSCore) canActorAccessResource(ctx context.Context, actor Actor, action common.Action, resolvedResource *resolvedResource) (bool, error) {
	return c.authorizer.Can(ctx, actor, action, resolvedResource.Ref)
}

// resolveResource resolves a resource URI to a resolvedResource, checking that the actor has access to the scope.
func (c *VFSCore) resolveResource(ctx context.Context, actor Actor, uri common.CanonURI) (*resolvedResource, error) {
	addressContract := common.ParseResourceAddress(uri)
	if addressContract == nil {
		return nil, common.ErrNotURI
	}

	address := addressContract.Payload()
	var scope *Scope
	var err error
	if address.ScopeKey == "" {
		scope, err = c.scopeResolver.ResolveDefaultScope(ctx, actor)
	} else {
		scope, err = c.scopeResolver.ResolveExplicitScope(ctx, address.ScopeKey)
	}
	if err != nil {
		return nil, err
	}

	ok, err := c.canActorAccessScope(ctx, actor, *scope)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, NewError(KindPermissionDenied, OpUnknown, "scope access denied", ErrPermissionDenied)
	}

	connection, err := c.connectionResolver.ResolveConnection(ctx, *scope, address.ProviderKey, address.ConnectionKey)
	if err != nil {
		return nil, err
	}

	return &resolvedResource{
		Address:    address,
		Scope:      *scope,
		Connection: *connection,
		Ref: common.ResourceRef{
			ProviderKey:   address.ProviderKey,
			ConnectionKey: connection.ConnectionKey,
			ScopeKey:      scope.Key,
			Path:          address.Path,
		},
	}, nil
}

func (c *VFSCore) resolveProvider(ctx context.Context, actor Actor, uri common.CanonURI) (FSProvider, *resolvedResource, error) {
	resolved, err := c.resolveResource(ctx, actor, uri)
	if err != nil {
		return nil, nil, err
	}
	provider, err := c.getProvider(ctx, resolved.Connection)
	return provider, resolved, err
}

func contextWithCoreRequest(ctx context.Context, bfs BoundVFS, rctx RequestContext) context.Context {
	ctx = ContextWithBoundVFS(ctx, bfs)
	return ContextWithRequestContext(ctx, rctx)
}

func newRequestContext(actor Actor, uri common.CanonURI, resolved *resolvedResource) RequestContext {
	rctx := RequestContext{
		ActorKey:   actor,
		RequestURI: uri,
	}
	rctx.Resolved.Address = resolved.Address
	rctx.Resolved.Scope = resolved.Scope
	rctx.Resolved.Connection = resolved.Connection
	rctx.Resolved.Ref = resolved.Ref
	return rctx
}

func (c *VFSCore) Stat(ctx context.Context, actor Actor, uri common.CanonURI) (*Node, error) {
	resolved, err := c.resolveResource(ctx, actor, uri)
	if err != nil {
		return nil, err
	}

	// access checking section
	// pattern:
	//    - can 'r' on resource
	ok, err := c.canActorAccessResource(ctx, actor, common.ActionRead, resolved)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, WrapError(ErrPermissionDenied, fmt.Errorf("cannot access %s", resolved.Ref.Path))
	}

	provider, err := c.getProvider(ctx, resolved.Connection)
	if err != nil {
		return nil, err
	}

	bound := boundVFS{
		frontend:    c,
		actor:       actor,
		selfAddress: resolved.Address,
	}
	rctx := newRequestContext(actor, uri, resolved)
	providerCtx := contextWithCoreRequest(ctx, &bound, rctx)
	return provider.Stat(providerCtx, resolved.Ref.Path)
}

func (c *VFSCore) ReadDir(ctx context.Context, actor Actor, uri common.CanonURI) ([]*Node, error) {
	resolved, err := c.resolveResource(ctx, actor, uri)
	if err != nil {
		return nil, err
	}

	// access checking section
	// pattern:
	//    - can 'r' on resource
	ok, err := c.canActorAccessResource(ctx, actor, common.ActionRead, resolved)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, WrapError(ErrPermissionDenied, fmt.Errorf("cannot access %s", resolved.Ref.Path))
	}

	provider, err := c.getProvider(ctx, resolved.Connection)
	if err != nil {
		return nil, err
	}

	bound := boundVFS{
		frontend:    c,
		actor:       actor,
		selfAddress: resolved.Address,
	}
	rctx := newRequestContext(actor, uri, resolved)
	providerCtx := contextWithCoreRequest(ctx, &bound, rctx)
	return provider.ReadDir(providerCtx, resolved.Ref.Path)
}

func (c *VFSCore) OpenFile(ctx context.Context, actor Actor, uri common.CanonURI, flag int) (File, error) {
	resolved, err := c.resolveResource(ctx, actor, uri)
	if err != nil {
		return nil, err
	}

	isRead := flag&os.O_WRONLY == 0 || flag&os.O_RDWR != 0
	isWrite := flag&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_TRUNC) != 0

	// access checking section
	// pattern:
	//    - can 'r' on resource when opening for read
	//    - can 'w' on resource when opening for write/truncate/append
	//    - can 'w' on parent when opening with O_CREATE
	if isRead {
		if err := c.requireResourceAccess(ctx, actor, common.ActionRead, resolved.Ref); err != nil {
			return nil, err
		}
	}
	if isWrite {
		if err := c.requireResourceAccess(ctx, actor, common.ActionWrite, resolved.Ref); err != nil {
			return nil, err
		}
	}
	if flag&os.O_CREATE != 0 {
		if err := c.requireResourceAccess(ctx, actor, common.ActionWrite, parentResourceRef(resolved.Ref)); err != nil {
			return nil, err
		}
	}

	provider, err := c.getProvider(ctx, resolved.Connection)
	if err != nil {
		return nil, err
	}

	bound := boundVFS{
		frontend:    c,
		actor:       actor,
		selfAddress: resolved.Address,
	}
	rctx := newRequestContext(actor, uri, resolved)
	providerCtx := contextWithCoreRequest(ctx, &bound, rctx)
	created := false
	if flag&os.O_CREATE != 0 {
		_, statErr := provider.Stat(providerCtx, resolved.Ref.Path)
		if statErr != nil && !errors.Is(statErr, os.ErrNotExist) && !errors.Is(statErr, ErrNotFound) {
			return nil, statErr
		}
		created = statErr != nil
	}
	file, err := provider.OpenFile(providerCtx, resolved.Ref.Path, flag)
	if err != nil {
		return nil, err
	}
	if !created {
		return file, nil
	}
	onCreated := func() error { return c.lifecycle.OnResourceCreated(ctx, actor, resolved.Ref) }
	if staged, ok := file.(WriteFile); ok {
		return &createdFile{WriteFile: staged, onCreated: onCreated}, nil
	}
	// Direct-write files create their namespace entry during OpenFile.
	if err := onCreated(); err != nil {
		return nil, errors.Join(err, file.Close())
	}
	return file, nil
}

func (c *VFSCore) Mkdir(ctx context.Context, actor Actor, uri common.CanonURI) (*Node, error) {
	resolved, err := c.resolveResource(ctx, actor, uri)
	if err != nil {
		return nil, err
	}

	// access checking section
	// pattern:
	//    - can 'w' on parent
	// lifecycle section:
	//    - provider.Mkdir creates resource first
	//    - lifecycle.OnResourceCreated registers resource
	if err := c.requireResourceAccess(ctx, actor, common.ActionWrite, parentResourceRef(resolved.Ref)); err != nil {
		return nil, err
	}

	provider, err := c.getProvider(ctx, resolved.Connection)
	if err != nil {
		return nil, err
	}

	bound := boundVFS{
		frontend:    c,
		actor:       actor,
		selfAddress: resolved.Address,
	}
	rctx := newRequestContext(actor, uri, resolved)
	providerCtx := contextWithCoreRequest(ctx, &bound, rctx)
	parentPath, name := splitResourcePath(resolved.Ref.Path)
	node, err := provider.Mkdir(providerCtx, parentPath, name)
	if err != nil {
		return nil, err
	}

	if err := c.lifecycle.OnResourceCreated(ctx, actor, resolved.Ref); err != nil {
		return node, err
	}

	return node, nil
}

func (c *VFSCore) Move(ctx context.Context, actor Actor, source common.CanonURI, target common.CanonURI) error {
	resolvedSource, err := c.resolveResource(ctx, actor, source)
	if err != nil {
		return err
	}

	resolvedTarget, err := c.resolveResource(ctx, actor, target)
	if err != nil {
		return err
	}

	if resolvedSource.Connection.ScopeKey != resolvedTarget.Connection.ScopeKey ||
		resolvedSource.Connection.ProviderKey != resolvedTarget.Connection.ProviderKey ||
		resolvedSource.Connection.ConnectionKey != resolvedTarget.Connection.ConnectionKey {
		return fmt.Errorf("%w: cross-provider move is not supported", ErrNotImplemented)
	}

	// access checking section
	// pattern:
	//    - can 'w' on source
	//    - can 'w' on source parent
	//    - can 'w' on target parent
	// operation section:
	//    - source and target must resolve to the same provider connection
	//    - cross-provider move returns unsupported error
	// lifecycle section:
	//    - provider.Move moves resource first
	//    - lifecycle.OnResourceMoved registers path change
	if err := c.requireResourceAccess(ctx, actor, common.ActionWrite, resolvedSource.Ref); err != nil {
		return err
	}
	if err := c.requireResourceAccess(ctx, actor, common.ActionWrite, parentResourceRef(resolvedSource.Ref)); err != nil {
		return err
	}
	if err := c.requireResourceAccess(ctx, actor, common.ActionWrite, parentResourceRef(resolvedTarget.Ref)); err != nil {
		return err
	}

	provider, err := c.getProvider(ctx, resolvedSource.Connection)
	if err != nil {
		return err
	}

	bound := boundVFS{
		frontend:    c,
		actor:       actor,
		selfAddress: resolvedSource.Address,
	}
	rctx := newRequestContext(actor, source, resolvedSource)
	providerCtx := contextWithCoreRequest(ctx, &bound, rctx)
	targetParentPath, newName := splitResourcePath(resolvedTarget.Ref.Path)
	if err := provider.Move(providerCtx, resolvedSource.Ref.Path, targetParentPath, newName); err != nil {
		return err
	}

	return c.lifecycle.OnResourceMoved(ctx, actor, resolvedSource.Ref, resolvedTarget.Ref)
}

func (c *VFSCore) Delete(ctx context.Context, actor Actor, uri common.CanonURI) error {
	resolved, err := c.resolveResource(ctx, actor, uri)
	if err != nil {
		return err
	}

	// access checking section
	// pattern:
	//    - can 'w' on resource
	// lifecycle section:
	//    - lifecycle.OnResourceDeleted
	ok, err := c.canActorAccessResource(ctx, actor, common.ActionWrite, resolved)
	if err != nil {
		return err
	}
	if !ok {
		return WrapError(ErrPermissionDenied, fmt.Errorf("cannot access %s", resolved.Ref.Path))
	}

	provider, err := c.getProvider(ctx, resolved.Connection)
	if err != nil {
		return err
	}

	bound := boundVFS{
		frontend:    c,
		actor:       actor,
		selfAddress: resolved.Address,
	}
	rctx := newRequestContext(actor, uri, resolved)
	providerCtx := contextWithCoreRequest(ctx, &bound, rctx)
	if err := provider.Delete(providerCtx, resolved.Ref.Path); err != nil {
		return err
	}

	return c.lifecycle.OnResourceDeleted(ctx, actor, resolved.Ref)
}

func (c *VFSCore) Control(ctx context.Context, actor Actor, uri common.CanonURI, command string, input []byte) ([]byte, error) {
	resolved, err := c.resolveResource(ctx, actor, uri)
	if err != nil {
		return nil, err
	}

	// access checking section
	// pattern:
	//    - can 'x' on resource
	ok, err := c.canActorAccessResource(ctx, actor, common.ActionExec, resolved)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, WrapError(ErrPermissionDenied, fmt.Errorf("cannot access %s", resolved.Ref.Path))
	}

	provider, err := c.getProvider(ctx, resolved.Connection)
	if err != nil {
		return nil, err
	}

	bound := boundVFS{
		frontend:    c,
		actor:       actor,
		selfAddress: resolved.Address,
	}
	rctx := newRequestContext(actor, uri, resolved)
	providerCtx := contextWithCoreRequest(ctx, &bound, rctx)
	return provider.Control(providerCtx, resolved.Ref.Path, command, input)
}
