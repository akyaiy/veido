package shared

import (
	"github.com/akyaiy/veido/internal/common"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"errors"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"
)

type Provider struct {
	links LinkReader
}

func NewProvider(links LinkReader) (*Provider, error) {
	if links == nil {
		return nil, vfs.ErrInvalidNewInstanceParams
	}
	return &Provider{links: links}, nil
}

func Factory(links LinkReader) vfs.ProviderFactory {
	return func(context.Context, vfs.ProviderConnection) (vfs.FSProvider, error) {
		return NewProvider(links)
	}
}

func (p *Provider) Stat(ctx context.Context, resourcePath string) (*vfs.Node, error) {
	resolved, err := p.resolve(ctx, resourcePath)
	if err != nil {
		return nil, err
	}
	if resolved.virtual {
		if resolved.group != "" {
			if _, err := p.readVirtualDir(ctx, resolved); err != nil {
				return nil, err
			}
		}
		return directoryNode(resolved.name), nil
	}
	bound, err := boundVFS(ctx)
	if err != nil {
		return nil, err
	}
	node, err := bound.Stat(ctx, resolved.targetURI)
	if err != nil {
		return nil, err
	}
	copy := *node
	if resolved.relativePath == "" {
		copy.Name = resolved.link.Alias
	}
	return &copy, nil
}

func (p *Provider) ReadDir(ctx context.Context, resourcePath string) ([]*vfs.Node, error) {
	resolved, err := p.resolve(ctx, resourcePath)
	if err != nil {
		return nil, err
	}
	if resolved.virtual {
		return p.readVirtualDir(ctx, resolved)
	}
	bound, err := boundVFS(ctx)
	if err != nil {
		return nil, err
	}
	return bound.ReadDir(ctx, resolved.targetURI)

}

func (p *Provider) OpenFile(ctx context.Context, resourcePath string, flags int) (vfs.File, error) {
	resolved, err := p.resolveContent(ctx, resourcePath)
	if err != nil {
		return nil, err
	}
	if resolved.section == "outgoing" && isWriteFlag(flags) {
		return nil, vfs.NewError(vfs.KindPermissionDenied, vfs.OpOpenFile, "outgoing links are read-only", nil)
	}
	bound, err := boundVFS(ctx)
	if err != nil {
		return nil, err
	}
	return bound.OpenFile(ctx, resolved.targetURI, flags)
}

func (p *Provider) Mkdir(ctx context.Context, parentPath string, name string) (*vfs.Node, error) {
	if err := validateChildName(name); err != nil {
		return nil, err
	}
	resolved, err := p.resolveContent(ctx, path.Join(parentPath, name))
	if err != nil {
		return nil, err
	}
	if resolved.section != "incoming" || resolved.relativePath == "" {
		return nil, vfs.NewError(vfs.KindPermissionDenied, vfs.OpMkdir, "cannot modify a shared link root or outgoing view", nil)
	}
	bound, err := boundVFS(ctx)
	if err != nil {
		return nil, err
	}
	return bound.Mkdir(ctx, resolved.targetURI)
}

func (p *Provider) Move(ctx context.Context, sourcePath, targetParentPath, newName string) error {
	if err := validateChildName(newName); err != nil {
		return err
	}
	source, err := p.resolveContent(ctx, sourcePath)
	if err != nil {
		return err
	}
	target, err := p.resolveContent(ctx, path.Join(targetParentPath, newName))
	if err != nil {
		return err
	}
	if source.section != "incoming" || target.section != "incoming" ||
		source.relativePath == "" || target.relativePath == "" || !sameLink(source.link, target.link) {
		return vfs.NewError(vfs.KindUnsupported, vfs.OpMove, "move is supported only inside one incoming shared link", nil)
	}
	bound, err := boundVFS(ctx)
	if err != nil {
		return err
	}
	return bound.Move(ctx, source.targetURI, target.targetURI)
}

func (p *Provider) Delete(ctx context.Context, resourcePath string) error {
	resolved, err := p.resolveContent(ctx, resourcePath)
	if err != nil {
		return err
	}
	if resolved.section != "incoming" || resolved.relativePath == "" {
		return vfs.NewError(vfs.KindPermissionDenied, vfs.OpDelete, "cannot delete a shared link root or mutate outgoing view", nil)
	}
	bound, err := boundVFS(ctx)
	if err != nil {
		return err
	}
	return bound.Delete(ctx, resolved.targetURI)
}

func (p *Provider) Control(context.Context, string, string, []byte) ([]byte, error) {
	// Link management will be connected to the ACL Provider. Returning an
	// explicit unsupported error prevents a link record from being mistaken for
	// an access grant while that integration does not exist.
	return nil, vfs.NewError(vfs.KindUnsupported, vfs.OpControl, "shared link management is not connected yet", nil)
}

type resolvedPath struct {
	section      string
	group        string
	name         string
	virtual      bool
	link         *Link
	relativePath string
	targetURI    common.CanonURI
}

func (p *Provider) resolve(ctx context.Context, resourcePath string) (*resolvedPath, error) {
	parts, err := splitPath(resourcePath)
	if err != nil {
		return nil, err
	}
	if len(parts) == 0 {
		return &resolvedPath{name: "/", virtual: true}, nil
	}
	if parts[0] != "incoming" && parts[0] != "outgoing" {
		return nil, vfs.NewError(vfs.KindNotFound, vfs.OpStat, "shared path not found", nil)
	}
	result := &resolvedPath{section: parts[0], name: parts[len(parts)-1], virtual: len(parts) < 3}
	if len(parts) >= 2 {
		result.group = parts[1]
	}
	if len(parts) < 3 {
		return result, nil
	}

	userID, err := actorUserID(ctx)
	if err != nil {
		return nil, err
	}
	if result.section == "incoming" {
		result.link, err = p.links.FindIncomingActive(ctx, userID, parts[1], parts[2])
	} else {
		result.link, err = p.links.FindOutgoingActive(ctx, userID, parts[1], parts[2])
	}
	if errors.Is(err, ErrLinkNotFound) {
		return nil, vfs.NewError(vfs.KindNotFound, vfs.OpStat, "shared link not found", err)
	}
	if err != nil {
		return nil, err
	}
	result.virtual = false
	result.relativePath = strings.Join(parts[3:], "/")
	result.targetURI, err = joinTarget(result.link.TargetURI, result.relativePath)
	return result, err
}

func (p *Provider) resolveContent(ctx context.Context, resourcePath string) (*resolvedPath, error) {
	resolved, err := p.resolve(ctx, resourcePath)
	if err != nil {
		return nil, err
	}
	if resolved.virtual || resolved.link == nil {
		return nil, vfs.NewError(vfs.KindPermissionDenied, vfs.OpUnknown, "operation requires a shared link", nil)
	}
	return resolved, nil
}

func (p *Provider) readVirtualDir(ctx context.Context, resolved *resolvedPath) ([]*vfs.Node, error) {
	if resolved.section == "" {
		return []*vfs.Node{directoryNode("incoming"), directoryNode("outgoing")}, nil
	}
	userID, err := actorUserID(ctx)
	if err != nil {
		return nil, err
	}
	var links []Link
	if resolved.section == "incoming" {
		links, err = p.links.ListIncomingActive(ctx, userID)
	} else {
		links, err = p.links.ListOutgoingActive(ctx, userID)
	}
	if err != nil {
		return nil, err
	}

	names := make(map[string]struct{})
	if resolved.group == "" {
		bound, boundErr := boundVFS(ctx)
		if boundErr != nil {
			return nil, boundErr
		}
		for _, link := range links {
			// Do not expose even the grouping entry when the current VFS
			// decision no longer permits resolving the target.
			if _, statErr := bound.Stat(ctx, link.TargetURI); statErr != nil {
				continue
			}
			if resolved.section == "incoming" {
				names[link.GrantedByName] = struct{}{}
			} else {
				names[link.RecipientName] = struct{}{}
			}
		}
	} else {
		bound, boundErr := boundVFS(ctx)
		if boundErr != nil {
			return nil, boundErr
		}
		nodes := make([]*vfs.Node, 0)
		for _, link := range links {
			group := link.RecipientName
			if resolved.section == "incoming" {
				group = link.GrantedByName
			}
			if group == resolved.group {
				// A table row is only the projection index. Re-entering VFS here
				// ensures stale or unauthorized targets are not displayed.
				node, statErr := bound.Stat(ctx, link.TargetURI)
				if statErr != nil {
					continue
				}
				copy := *node
				copy.Name = link.Alias
				nodes = append(nodes, &copy)
			}
		}
		if len(nodes) == 0 {
			return nil, vfs.NewError(vfs.KindNotFound, vfs.OpReadDir, "shared group not found", nil)
		}
		sort.Slice(nodes, func(i, j int) bool { return nodes[i].Name < nodes[j].Name })
		return nodes, nil
	}

	ordered := make([]string, 0, len(names))
	for name := range names {
		ordered = append(ordered, name)
	}
	sort.Strings(ordered)
	nodes := make([]*vfs.Node, 0, len(ordered))
	for _, name := range ordered {
		nodes = append(nodes, directoryNode(name))
	}
	return nodes, nil
}

func actorUserID(ctx context.Context) (int64, error) {
	rctx, ok := vfs.RequestContextFromContext(ctx)
	if !ok || rctx.ActorKey.Kind != vfs.ActorUser {
		return 0, vfs.NewError(vfs.KindPermissionDenied, vfs.OpUnknown, "shared requires an authenticated user", nil)
	}
	id, err := strconv.ParseInt(rctx.ActorKey.ID, 10, 64)
	if err != nil || id <= 0 {
		return 0, vfs.NewError(vfs.KindPermissionDenied, vfs.OpUnknown, "shared requires a numeric user identity", err)
	}
	return id, nil
}

func boundVFS(ctx context.Context) (vfs.BoundVFS, error) {
	bound, ok := vfs.BoundVFSFromContext(ctx)
	if !ok {
		return nil, vfs.NewError(vfs.KindInternal, vfs.OpUnknown, "bound VFS is unavailable", nil)
	}
	return bound, nil
}

func joinTarget(base common.CanonURI, relative string) (common.CanonURI, error) {
	addressContract := common.ParseResourceAddress(base)
	if addressContract == nil || base.Provider() == "shared" {
		return common.EmptyURI, vfs.NewError(vfs.KindFailedPrecondition, vfs.OpUnknown, "invalid shared target", nil)
	}
	address := addressContract.Payload()
	if relative != "" {
		address.Path = path.Join(address.Path, relative)
	}
	return address.URI()
}

func splitPath(resourcePath string) ([]string, error) {
	clean := path.Clean("/" + resourcePath)
	if clean != resourcePath {
		return nil, vfs.NewError(vfs.KindInvalidArgument, vfs.OpUnknown, "non-canonical shared path", nil)
	}
	if clean == "/" {
		return nil, nil
	}
	return strings.Split(strings.TrimPrefix(clean, "/"), "/"), nil
}

func validateChildName(name string) error {
	if name == "" || name == "." || name == ".." || strings.ContainsAny(name, "/\x00") {
		return vfs.NewError(vfs.KindInvalidArgument, vfs.OpUnknown, "invalid child name", nil)
	}
	return nil
}

func directoryNode(name string) *vfs.Node {
	return &vfs.Node{Name: name, Kind: "dir", IsDir: true, UpdatedAt: time.Unix(0, 0).UTC()}
}

func sameLink(a, b *Link) bool {
	return a != nil && b != nil && a.RecipientUserID == b.RecipientUserID && a.TargetURI == b.TargetURI
}

func isWriteFlag(flags int) bool {
	return flags&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_TRUNC|os.O_CREATE) != 0
}

var _ vfs.FSProvider = (*Provider)(nil)
