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

type connectionStatus struct {
	Status string `json:"status"`
	Ready  bool   `json:"ready"`
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

func (a *WebDAVAdapter) uri(name string) (common.CanonURI, string, error) {
	davPath := cleanDAVPath(name)
	if a.base == nil {
		return a.rootURI(davPath)
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

func (a *WebDAVAdapter) rootURI(davPath string) (common.CanonURI, string, error) {
	parts := splitDAVPath(davPath)
	if len(parts) < 2 {
		return common.EmptyURI, davPath, os.ErrInvalid
	}

	providerKey, connectionKey, ok := strings.Cut(parts[1], "@")
	if !ok || providerKey == "" || connectionKey == "" {
		return common.EmptyURI, davPath, os.ErrNotExist
	}

	resourcePath := "/"
	if len(parts) > 2 {
		resourcePath = "/" + strings.Join(parts[2:], "/")
	}

	uri, err := common.ResourceAddress{
		ProviderKey:   providerKey,
		ConnectionKey: connectionKey,
		ScopeKey:      vfsScopeKey(parts[0]),
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

	uri, davPath, err := a.uri(name)
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
	return &davFile{ctx: ctx, file: file}, nil
}

func (a *WebDAVAdapter) Stat(ctx context.Context, name string) (os.FileInfo, error) {
	actor := a.actorFromContext(ctx)
	if a.base == nil {
		info, ok, err := a.virtualStat(ctx, name)
		if ok || err != nil {
			return info, err
		}
	}

	uri, davPath, err := a.uri(name)
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

	uri, _, err := a.uri(name)
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

	uri, _, err := a.uri(name)
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

	oldURI, _, err := a.uri(oldName)
	if err != nil {
		return err
	}
	newURI, _, err := a.uri(newName)
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
		scopeKey := vfsScopeKey(parts[0])
		uri, err := a.scopesURI("/scopes/" + scopeKey + "/connections/" + parts[1])
		if err != nil {
			return nil, true, err
		}
		node, err := a.frontend.Stat(ctx, actor, uri)
		if err != nil {
			return nil, true, translateError(err)
		}
		active, err := a.isActiveConnection(ctx, actor, scopeKey, parts[1])
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
		entries, err := a.connectionEntries(ctx, vfsScopeKey(parts[0]))
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

	entries := make([]os.FileInfo, 0, len(nodes))
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
		active, err := a.isActiveConnection(ctx, actor, scopeKey, connection.Name)
		if err != nil || !active {
			continue
		}
		entries = append(entries, newFileInfo(connection.Name, dirNode(connection.Name)))
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})
	return entries, nil
}

func (a *WebDAVAdapter) isActiveConnection(ctx context.Context, actor vfs.Actor, scopeKey string, connectionName string) (bool, error) {
	providerKey, connectionKey, ok := strings.Cut(connectionName, "@")
	if !ok || providerKey == "" || connectionKey == "" {
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
	ctx  context.Context
	file vfs.File
}

func (f *davFile) Close() error {
	err := translateError(f.file.Close())
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
	return f.file.Write(p)
}

func (f *davFile) Seek(offset int64, whence int) (int64, error) {
	return f.file.Seek(offset, whence)
}

func (f *davFile) Stat() (os.FileInfo, error) {
	if f == nil || f.file == nil {
		return nil, os.ErrInvalid
	}
	return f.file.Stat()
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
