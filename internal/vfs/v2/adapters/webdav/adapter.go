package webdav

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path"
	"sort"
	"strings"
	"time"

	gowebdav "golang.org/x/net/webdav"
)

type WebDAVAdapter struct {
	frontend vfs.VFSFrontend
	actor    vfs.Actor
	base     *common.ResourceAddress
	scopes   common.ResourceAddress
}

const homeDAVName = "Home"

type connectionStatus struct {
	Status string `json:"status"`
	Ready  bool   `json:"ready"`
}

type connectionInfo struct {
	ProviderKey   string `json:"provider_key"`
	ConnectionKey string `json:"connection_key"`
	DisplayName   string `json:"display_name"`
}

type defaultScopeInfo struct {
	ScopeKey string `json:"scope_key"`
}

type actorContextKey struct{}

type protocolStatusHintContextKey struct{}

type ProtocolStatusHint struct {
	status int
}

func ContextWithProtocolStatusHint(ctx context.Context, hint *ProtocolStatusHint) context.Context {
	return context.WithValue(ctx, protocolStatusHintContextKey{}, hint)
}

func (h *ProtocolStatusHint) Status() int {
	if h == nil {
		return 0
	}
	return h.status
}

func MarkProtocolStatus(ctx context.Context, status int) {
	if hint, ok := ctx.Value(protocolStatusHintContextKey{}).(*ProtocolStatusHint); ok && hint != nil {
		hint.status = status
	}
}

func ContextWithActor(ctx context.Context, actor vfs.Actor) context.Context {
	return context.WithValue(ctx, actorContextKey{}, actor)
}

func (a *WebDAVAdapter) actorFromContext(ctx context.Context) vfs.Actor {
	if actor, ok := ctx.Value(actorContextKey{}).(vfs.Actor); ok {
		return actor
	}
	return a.actor
}

func NewWebDAVAdapter(frontend vfs.VFSFrontend, actor vfs.Actor, baseURI common.CanonURI) (gowebdav.FileSystem, error) {
	if frontend == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	parsed := common.ParseResourceAddress(baseURI)
	if parsed == nil {
		return nil, common.ErrNotURI
	}

	base := parsed.Payload()
	base.Path = cleanDAVPath(base.Path)

	return &WebDAVAdapter{
		frontend: frontend,
		actor:    actor,
		base:     &base,
	}, nil
}

func NewWebDAVRootAdapter(frontend vfs.VFSFrontend, actor vfs.Actor, scopesURI common.CanonURI) (gowebdav.FileSystem, error) {
	if frontend == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}

	parsed := common.ParseResourceAddress(scopesURI)
	if parsed == nil {
		return nil, common.ErrNotURI
	}

	scopes := parsed.Payload()
	scopes.Path = cleanDAVPath(scopes.Path)

	return &WebDAVAdapter{
		frontend: frontend,
		actor:    actor,
		scopes:   scopes,
	}, nil
}

func cleanDAVPath(name string) string {
	if name == "" || name == "." {
		return "/"
	}
	if !strings.HasPrefix(name, "/") {
		name = "/" + name
	}
	return path.Clean(name)
}

func (a *WebDAVAdapter) uri(ctx context.Context, actor vfs.Actor, name string) (common.CanonURI, string, error) {
	davPath := cleanDAVPath(name)
	if a.base == nil {
		return a.rootURI(ctx, actor, davPath)
	}

	basePath := a.base.Path
	if basePath == "" {
		basePath = "/"
	}

	joined := basePath
	if davPath != "/" {
		joined = path.Join(basePath, davPath)
	}
	if joined == "." || joined == "" {
		joined = "/"
	}
	if !strings.HasPrefix(joined, "/") {
		joined = "/" + joined
	}

	address := *a.base
	address.Path = path.Clean(joined)
	uri, err := address.URI()
	return uri, davPath, err
}

func (a *WebDAVAdapter) rootURI(ctx context.Context, actor vfs.Actor, davPath string) (common.CanonURI, string, error) {
	parts := splitDAVPath(davPath)
	if len(parts) < 2 {
		return common.EmptyURI, davPath, os.ErrInvalid
	}

	scopeKey := vfsScopeKey(parts[0])
	connectionPartIndex := 1
	if parts[0] == homeDAVName {
		defaultScopeKey, err := a.defaultScopeKey(ctx, actor)
		if err != nil {
			return common.EmptyURI, davPath, err
		}
		scopeKey = defaultScopeKey
		if len(parts) < 2 {
			return common.EmptyURI, davPath, os.ErrInvalid
		}
	}

	providerKey, connectionKey, _, err := a.resolveConnectionMount(ctx, actor, scopeKey, parts[connectionPartIndex])
	if err != nil {
		return common.EmptyURI, davPath, err
	}

	resourcePath := "/"
	if len(parts) > connectionPartIndex+1 {
		resourcePath = "/" + strings.Join(parts[connectionPartIndex+1:], "/")
	}

	uri, err := common.ResourceAddress{
		ProviderKey:   providerKey,
		ConnectionKey: connectionKey,
		ScopeKey:      scopeKey,
		Path:          path.Clean(resourcePath),
	}.URI()
	return uri, davPath, err
}

func splitDAVPath(davPath string) []string {
	if davPath == "/" {
		return nil
	}
	return strings.Split(strings.TrimPrefix(davPath, "/"), "/")
}

func (a *WebDAVAdapter) scopesURI(resourcePath string) (common.CanonURI, error) {
	address := a.scopes
	address.Path = path.Clean("/" + resourcePath)
	return address.URI()
}

func (a *WebDAVAdapter) OpenFile(ctx context.Context, name string, flag int, perm os.FileMode) (gowebdav.File, error) {
	actor := a.actorFromContext(ctx)
	if a.base == nil {
		if isVirtualDAVPath(name) && flag&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_CREATE|os.O_TRUNC) != 0 {
			return nil, gowebdav.ErrForbidden
		}
		dir, ok, err := a.virtualDir(ctx, name)
		if ok || err != nil {
			return dir, err
		}
	}

	uri, davPath, err := a.uri(ctx, actor, name)
	if err != nil {
		return nil, err
	}

	if flag&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_CREATE|os.O_TRUNC) == 0 {
		node, err := a.frontend.Stat(ctx, actor, uri)
		if err == nil && node != nil && node.IsDir {
			return &davDir{
				adapter: a,
				ctx:     ctx,
				uri:     uri,
				name:    davPath,
			}, nil
		}
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, translateError(err)
		}
	}

	file, err := a.frontend.OpenFile(ctx, actor, uri, flag)
	if err != nil {
		return nil, translateError(err)
	}
	return &davFile{ctx: ctx, file: file, writing: flag&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_CREATE|os.O_TRUNC) != 0}, nil
}

func (a *WebDAVAdapter) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	actor := a.actorFromContext(ctx)
	if a.base == nil {
		info, ok, err := a.virtualStat(ctx, name)
		if ok || err != nil {
			return info, err
		}
	}

	uri, davPath, err := a.uri(ctx, actor, name)
	if err != nil {
		return nil, err
	}

	node, err := a.frontend.Stat(ctx, actor, uri)
	if err != nil {
		return nil, translateError(err)
	}
	if node == nil {
		return nil, os.ErrNotExist
	}

	infoName := path.Base(davPath)
	if davPath == "/" {
		infoName = "/"
	}
	if node.Name != "" {
		infoName = node.Name
	}
	return newFileInfo(infoName, node), nil
}

func (a *WebDAVAdapter) Mkdir(ctx context.Context, name string, perm os.FileMode) error {
	actor := a.actorFromContext(ctx)
	if a.base == nil && isVirtualDAVPath(name) {
		return gowebdav.ErrForbidden
	}
	if a.base == nil {
		handled, err := a.mkdirVirtualConnection(ctx, actor, name)
		if handled {
			err = translateError(err)
			if errors.Is(err, gowebdav.ErrForbidden) {
				MarkProtocolStatus(ctx, http.StatusForbidden)
			}
			return err
		}
	}

	uri, _, err := a.uri(ctx, actor, name)
	if err != nil {
		return err
	}

	_, err = a.frontend.Mkdir(ctx, actor, uri)
	err = translateError(err)
	if errors.Is(err, gowebdav.ErrForbidden) {
		MarkProtocolStatus(ctx, http.StatusForbidden)
	}
	return err
}

func (a *WebDAVAdapter) RemoveAll(ctx context.Context, name string) error {
	actor := a.actorFromContext(ctx)
	if a.base == nil && isVirtualDAVPath(name) {
		return gowebdav.ErrForbidden
	}
	if a.base == nil {
		handled, err := a.removeVirtualConnection(ctx, actor, name)
		if handled {
			return translateError(err)
		}
	}

	uri, _, err := a.uri(ctx, actor, name)
	if err != nil {
		return err
	}

	return translateError(a.frontend.Delete(ctx, actor, uri))
}

func (a *WebDAVAdapter) Rename(ctx context.Context, oldName, newName string) error {
	actor := a.actorFromContext(ctx)
	if a.base == nil && (isVirtualDAVPath(oldName) || isVirtualDAVPath(newName)) {
		return gowebdav.ErrForbidden
	}
	if a.base == nil {
		handled, err := a.renameVirtualConnection(ctx, actor, oldName, newName)
		if handled {
			return translateError(err)
		}
	}

	oldURI, _, err := a.uri(ctx, actor, oldName)
	if err != nil {
		return err
	}
	newURI, _, err := a.uri(ctx, actor, newName)
	if err != nil {
		return err
	}

	return translateError(a.frontend.Move(ctx, actor, oldURI, newURI))
}

func isVirtualDAVPath(name string) bool {
	return len(splitDAVPath(cleanDAVPath(name))) < 2
}

func (a *WebDAVAdapter) virtualStat(ctx context.Context, name string) (os.FileInfo, bool, error) {
	actor := a.actorFromContext(ctx)
	davPath := cleanDAVPath(name)
	parts := splitDAVPath(davPath)
	switch len(parts) {
	case 0:
		return newFileInfo("/", dirNode("/")), true, nil
	case 1:
		if parts[0] == homeDAVName {
			return newFileInfo(homeDAVName, dirNode(homeDAVName)), true, nil
		}
		scopeKey := vfsScopeKey(parts[0])
		uri, err := a.scopesURI("/scopes/" + scopeKey)
		if err != nil {
			return nil, true, err
		}
		node, err := a.frontend.Stat(ctx, actor, uri)
		if err != nil {
			return nil, true, translateError(err)
		}
		return newFileInfo(davScopeName(scopeKey), node), true, nil
	case 2:
		if parts[0] == homeDAVName {
			defaultScopeKey, err := a.defaultScopeKey(ctx, actor)
			if err != nil {
				return nil, true, translateError(err)
			}
			_, _, internalName, err := a.resolveConnectionMount(ctx, actor, defaultScopeKey, parts[1])
			if err != nil {
				return nil, true, translateError(err)
			}
			uri, err := a.scopesURI("/scopes/" + defaultScopeKey + "/connections/" + internalName)
			if err != nil {
				return nil, true, err
			}
			node, err := a.frontend.Stat(ctx, actor, uri)
			if err != nil {
				return nil, true, translateError(err)
			}
			active, err := a.isActiveConnection(ctx, actor, defaultScopeKey, internalName)
			if err != nil {
				return nil, true, translateError(err)
			}
			if !active {
				return nil, true, os.ErrNotExist
			}
			return newFileInfo(parts[1], node), true, nil
		}
		scopeKey := vfsScopeKey(parts[0])
		_, _, internalName, err := a.resolveConnectionMount(ctx, actor, scopeKey, parts[1])
		if err != nil {
			return nil, true, translateError(err)
		}
		uri, err := a.scopesURI("/scopes/" + scopeKey + "/connections/" + internalName)
		if err != nil {
			return nil, true, err
		}
		node, err := a.frontend.Stat(ctx, actor, uri)
		if err != nil {
			return nil, true, translateError(err)
		}
		active, err := a.isActiveConnection(ctx, actor, scopeKey, internalName)
		if err != nil {
			return nil, true, translateError(err)
		}
		if !active {
			return nil, true, os.ErrNotExist
		}
		return newFileInfo(parts[1], node), true, nil
	default:
		return nil, false, nil
	}
}

func (a *WebDAVAdapter) virtualDir(ctx context.Context, name string) (gowebdav.File, bool, error) {
	davPath := cleanDAVPath(name)
	parts := splitDAVPath(davPath)
	switch len(parts) {
	case 0:
		entries, err := a.scopeEntries(ctx)
		if err != nil {
			return nil, true, translateError(err)
		}
		return &davDir{
			adapter: a,
			ctx:     ctx,
			name:    davPath,
			entries: entries,
		}, true, nil
	case 1:
		scopeKey := vfsScopeKey(parts[0])
		if parts[0] == homeDAVName {
			actor := a.actorFromContext(ctx)
			defaultScopeKey, err := a.defaultScopeKey(ctx, actor)
			if err != nil {
				return nil, true, translateError(err)
			}
			scopeKey = defaultScopeKey
		}
		entries, err := a.connectionEntries(ctx, scopeKey)
		if err != nil {
			return nil, true, translateError(err)
		}
		return &davDir{
			adapter: a,
			ctx:     ctx,
			name:    davPath,
			entries: entries,
		}, true, nil
	default:
		return nil, false, nil
	}
}

func (a *WebDAVAdapter) scopeEntries(ctx context.Context) ([]os.FileInfo, error) {
	actor := a.actorFromContext(ctx)
	uri, err := a.scopesURI("/scopes")
	if err != nil {
		return nil, err
	}
	nodes, err := a.frontend.ReadDir(ctx, actor, uri)
	if err != nil {
		return nil, err
	}

	entries := make([]os.FileInfo, 0, len(nodes)+1)
	entries = append(entries, newFileInfo(homeDAVName, dirNode(homeDAVName)))
	for _, node := range nodes {
		if node == nil {
			continue
		}
		entries = append(entries, newFileInfo(davScopeName(node.Name), node))
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})
	return entries, nil
}

func davScopeName(scopeKey string) string {
	if scopeKey == "system" {
		return ".system"
	}
	return scopeKey
}

func vfsScopeKey(davName string) string {
	if davName == ".system" {
		return "system"
	}
	return davName
}

func (a *WebDAVAdapter) connectionEntries(ctx context.Context, scopeKey string) ([]os.FileInfo, error) {
	actor := a.actorFromContext(ctx)
	connectionsURI, err := a.scopesURI("/scopes/" + scopeKey + "/connections")
	if err != nil {
		return nil, err
	}
	connections, err := a.frontend.ReadDir(ctx, actor, connectionsURI)
	if err != nil {
		return nil, err
	}

	entries := make([]os.FileInfo, 0, len(connections))
	for _, connection := range connections {
		if connection == nil || connection.Name == "" || !connection.IsDir {
			continue
		}
		providerKey, connectionKey, ok := splitInternalConnectionName(connection.Name)
		if !ok {
			continue
		}
		active, err := a.isActiveConnection(ctx, actor, scopeKey, connection.Name)
		if err != nil || !active {
			continue
		}
		if !a.isHealthyConnectionMount(ctx, actor, scopeKey, providerKey, connectionKey) {
			continue
		}
		info, err := a.readConnectionInfo(ctx, actor, scopeKey, connection.Name)
		if err != nil {
			continue
		}
		displayName := info.DisplayName
		if displayName == "" {
			displayName = connectionKey
		}
		entries = append(entries, newFileInfo(displayName, dirNode(displayName)))
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})
	return entries, nil
}

func (a *WebDAVAdapter) isHealthyConnectionMount(ctx context.Context, actor vfs.Actor, scopeKey string, providerKey string, connectionKey string) bool {
	uri, err := common.ResourceAddress{
		ProviderKey:   providerKey,
		ConnectionKey: connectionKey,
		ScopeKey:      scopeKey,
		Path:          "/",
	}.URI()
	if err != nil {
		return false
	}

	node, err := a.frontend.Stat(ctx, actor, uri)
	return err == nil && node != nil && node.IsDir
}

func (a *WebDAVAdapter) defaultScopeKey(ctx context.Context, actor vfs.Actor) (string, error) {
	uri, err := a.scopesURI("/me/default_scope.json")
	if err != nil {
		return "", err
	}
	file, err := a.frontend.OpenFile(ctx, actor, uri, os.O_RDONLY)
	if err != nil {
		return "", err
	}
	data, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if readErr != nil {
		return "", readErr
	}
	if closeErr != nil {
		return "", closeErr
	}

	var info defaultScopeInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return "", err
	}
	if strings.TrimSpace(info.ScopeKey) == "" {
		return "", os.ErrNotExist
	}
	return strings.TrimSpace(info.ScopeKey), nil
}

func (a *WebDAVAdapter) isActiveConnection(ctx context.Context, actor vfs.Actor, scopeKey string, connectionName string) (bool, error) {
	if _, _, ok := splitInternalConnectionName(connectionName); !ok {
		return false, nil
	}
	uri, err := a.scopesURI("/scopes/" + scopeKey + "/connections/" + connectionName + "/status.json")
	if err != nil {
		return false, err
	}
	file, err := a.frontend.OpenFile(ctx, actor, uri, os.O_RDONLY)
	if err != nil {
		return false, err
	}
	data, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if readErr != nil {
		return false, readErr
	}
	if closeErr != nil {
		return false, closeErr
	}

	var status connectionStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return false, err
	}
	return status.Status == "active" && status.Ready, nil
}

func (a *WebDAVAdapter) readConnectionInfo(ctx context.Context, actor vfs.Actor, scopeKey string, connectionName string) (connectionInfo, error) {
	uri, err := a.scopesURI("/scopes/" + scopeKey + "/connections/" + connectionName + "/info.json")
	if err != nil {
		return connectionInfo{}, err
	}
	file, err := a.frontend.OpenFile(ctx, actor, uri, os.O_RDONLY)
	if err != nil {
		return connectionInfo{}, err
	}
	data, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if readErr != nil {
		return connectionInfo{}, readErr
	}
	if closeErr != nil {
		return connectionInfo{}, closeErr
	}

	var info connectionInfo
	if err := json.Unmarshal(data, &info); err != nil {
		return connectionInfo{}, err
	}
	return info, nil
}

func (a *WebDAVAdapter) resolveConnectionMount(ctx context.Context, actor vfs.Actor, scopeKey string, davConnectionName string) (string, string, string, error) {
	if providerKey, connectionKey, ok := splitInternalConnectionName(davConnectionName); ok {
		return providerKey, connectionKey, davConnectionName, nil
	}

	connectionsURI, err := a.scopesURI("/scopes/" + scopeKey + "/connections")
	if err != nil {
		return "", "", "", err
	}
	connections, err := a.frontend.ReadDir(ctx, actor, connectionsURI)
	if err != nil {
		return "", "", "", translateError(err)
	}
	for _, connection := range connections {
		if connection == nil || connection.Name == "" || !connection.IsDir {
			continue
		}
		providerKey, connectionKey, ok := splitInternalConnectionName(connection.Name)
		if !ok {
			continue
		}
		if connectionKey == davConnectionName {
			return providerKey, connectionKey, connection.Name, nil
		}
		info, err := a.readConnectionInfo(ctx, actor, scopeKey, connection.Name)
		if err != nil {
			continue
		}
		if info.DisplayName == davConnectionName {
			return providerKey, connectionKey, connection.Name, nil
		}
	}
	return "", "", "", os.ErrNotExist
}

func (a *WebDAVAdapter) mkdirVirtualConnection(ctx context.Context, actor vfs.Actor, name string) (bool, error) {
	parts := splitDAVPath(cleanDAVPath(name))
	if len(parts) != 2 {
		return false, nil
	}
	if _, _, ok := splitInternalConnectionName(parts[1]); !ok {
		return true, os.ErrPermission
	}
	scopeKey := vfsScopeKey(parts[0])
	uri, err := a.scopesURI("/scopes/" + scopeKey + "/connections/" + parts[1])
	if err != nil {
		return true, err
	}
	_, err = a.frontend.Mkdir(ctx, actor, uri)
	if err != nil {
		return true, err
	}
	return true, nil
}

func (a *WebDAVAdapter) removeVirtualConnection(ctx context.Context, actor vfs.Actor, name string) (bool, error) {
	parts := splitDAVPath(cleanDAVPath(name))
	if len(parts) != 2 {
		return false, nil
	}
	if parts[0] == homeDAVName || parts[1] == homeDAVName {
		return true, os.ErrPermission
	}
	scopeKey := vfsScopeKey(parts[0])
	_, _, internalName, err := a.resolveConnectionMount(ctx, actor, scopeKey, parts[1])
	if err != nil {
		return true, err
	}
	uri, err := a.scopesURI("/scopes/" + scopeKey + "/connections/" + internalName)
	if err != nil {
		return true, err
	}
	return true, a.frontend.Delete(ctx, actor, uri)
}

func (a *WebDAVAdapter) renameVirtualConnection(ctx context.Context, actor vfs.Actor, oldName string, newName string) (bool, error) {
	oldParts := splitDAVPath(cleanDAVPath(oldName))
	newParts := splitDAVPath(cleanDAVPath(newName))
	if len(oldParts) != 2 || len(newParts) != 2 {
		return false, nil
	}
	if oldParts[0] == homeDAVName || newParts[0] == homeDAVName || oldParts[1] == homeDAVName || newParts[1] == homeDAVName {
		return true, os.ErrPermission
	}
	oldScopeKey := vfsScopeKey(oldParts[0])
	newScopeKey := vfsScopeKey(newParts[0])
	if oldScopeKey != newScopeKey {
		return true, os.ErrPermission
	}
	_, _, internalName, err := a.resolveConnectionMount(ctx, actor, oldScopeKey, oldParts[1])
	if err != nil {
		return true, err
	}
	sourceURI, err := a.scopesURI("/scopes/" + oldScopeKey + "/connections/" + internalName)
	if err != nil {
		return true, err
	}
	targetURI, err := a.scopesURI("/scopes/" + oldScopeKey + "/connections/" + newParts[1])
	if err != nil {
		return true, err
	}
	return true, a.frontend.Move(ctx, actor, sourceURI, targetURI)
}

func splitInternalConnectionName(name string) (string, string, bool) {
	providerKey, connectionKey, ok := strings.Cut(name, "@")
	if !ok || providerKey == "" || connectionKey == "" {
		return "", "", false
	}
	return providerKey, connectionKey, true
}

func dirNode(name string) *vfs.Node {
	return &vfs.Node{
		Name:      name,
		Kind:      "dir",
		IsDir:     true,
		UpdatedAt: time.Now(),
	}
}

func translateError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, vfs.ErrPermissionDenied) ||
		errors.Is(err, vfs.ErrInvalidScope) ||
		errors.Is(err, os.ErrPermission) {
		return gowebdav.ErrForbidden
	}
	return err
}

type davFile struct {
	ctx      context.Context
	file     vfs.File
	writing  bool
	writeErr error
}

func (f *davFile) Close() error {
	var closeErr error
	if f.writing {
		transferErr := f.writeErr
		if transferErr == nil {
			transferErr = f.ctx.Err()
		}
		if state, ok := f.ctx.Value(uploadContextKey{}).(*uploadState); ok && transferErr == nil {
			transferErr = state.err
			if transferErr == nil && !state.complete {
				transferErr = io.ErrUnexpectedEOF
			}
		}
		closeErr = vfs.FinishWrite(f.file, transferErr)
	} else {
		closeErr = f.file.Close()
	}
	err := translateError(closeErr)
	switch {
	case errors.Is(err, gowebdav.ErrForbidden):
		MarkProtocolStatus(f.ctx, http.StatusForbidden)
	case errors.Is(err, os.ErrInvalid):
		MarkProtocolStatus(f.ctx, http.StatusBadRequest)
	}
	return err
}

func (f *davFile) Read(p []byte) (int, error) {
	return f.file.Read(p)
}

func (f *davFile) Write(p []byte) (int, error) {
	n, err := f.file.Write(p)
	if err == nil && n != len(p) {
		err = io.ErrShortWrite
	}
	if err != nil {
		f.writeErr = err
	}
	return n, err
}

func (f *davFile) Seek(offset int64, whence int) (int64, error) {
	return f.file.Seek(offset, whence)
}

func (f *davFile) Stat() (os.FileInfo, error) {
	if f == nil || f.file == nil {
		return nil, os.ErrInvalid
	}
	info, err := f.file.Stat()
	if err != nil && f.writing {
		f.writeErr = err
	}
	return info, err
}

func (f *davFile) Readdir(count int) ([]os.FileInfo, error) {
	return nil, os.ErrInvalid
}

type davDir struct {
	adapter *WebDAVAdapter
	ctx     context.Context
	uri     common.CanonURI
	name    string
	entries []os.FileInfo
	offset  int
}

func (d *davDir) Close() error {
	return nil
}

func (d *davDir) Read(p []byte) (int, error) {
	return 0, os.ErrInvalid
}

func (d *davDir) Write(p []byte) (int, error) {
	return 0, os.ErrInvalid
}

func (d *davDir) Seek(offset int64, whence int) (int64, error) {
	return 0, os.ErrInvalid
}

func (d *davDir) Stat() (os.FileInfo, error) {
	return d.adapter.Stat(d.ctx, d.name)
}

func (d *davDir) Readdir(count int) ([]os.FileInfo, error) {
	if d.entries == nil {
		actor := d.adapter.actorFromContext(d.ctx)
		nodes, err := d.adapter.frontend.ReadDir(d.ctx, actor, d.uri)
		if err != nil {
			return nil, translateError(err)
		}

		d.entries = make([]os.FileInfo, 0, len(nodes))
		for _, node := range nodes {
			if node == nil {
				continue
			}
			d.entries = append(d.entries, newFileInfo(node.Name, node))
		}
	}

	if d.offset >= len(d.entries) {
		if count > 0 {
			return nil, io.EOF
		}
		return nil, nil
	}

	limit := len(d.entries)
	if count > 0 && d.offset+count < limit {
		limit = d.offset + count
	}

	subset := d.entries[d.offset:limit]
	d.offset = limit
	return subset, nil
}
