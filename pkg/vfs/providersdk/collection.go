package providersdk

import (
	"github.com/akyaiy/veido/internal/vfs/v2/virtfs"
	"github.com/akyaiy/veido/pkg/vfs"
	"context"
	"errors"
	"fmt"
	"path"
	"sort"
	"strings"
)

type CollectionSpec[P, T any] struct {
	List   func(context.Context, Request, P) ([]T, error)
	Lookup func(context.Context, Request, P, string) (T, error)
	Node   func(T) *vfs.Node
	Create func(context.Context, Request, P, string) (*vfs.Node, error)
}

// Collection creates a directory and returns its dynamic item resource.
// Children declared on the returned resource share its loaded item per call.
func Collection[P, T any](parent *Resource[P], name, param string, spec CollectionSpec[P, T]) *Resource[T] {
	_, item := CollectionResources(parent, name, param, spec)
	return item
}

// CollectionResources is the command-friendly form of Collection. It returns
// both the collection directory and its dynamic item so callers can attach
// commands to the directory (for example, "create") without abandoning the
// typed tree.
func CollectionResources[P, T any](parent *Resource[P], name, param string, spec CollectionSpec[P, T]) (*Resource[P], *Resource[T]) {
	dir := Directory(parent, name)
	if !validName(param) || strings.Contains(parent.entry.pattern, "{"+param+"}") {
		parent.tree.err = errors.Join(parent.tree.err, fmt.Errorf("invalid or repeated parameter %q", param))
	}
	if spec.List == nil || spec.Lookup == nil || spec.Node == nil {
		parent.tree.err = errors.Join(parent.tree.err, fmt.Errorf("collection %s requires List, Lookup and Node", name))
	}
	item := add[P, T](dir, "{"+param+"}", nil, true)
	item.load = func(ctx context.Context, req Request) (T, error) {
		return memo(ctx, cacheKey{item.entry, expand(item.entry.pattern, req)}, func() (T, error) {
			var zero T
			p, err := parent.load(ctx, req)
			if err != nil {
				return zero, err
			}
			return spec.Lookup(ctx, req, p, req.Param(param))
		})
	}
	configureDirectory(item)
	item.Metadata(func(ctx context.Context, req Request, value T) (*vfs.Node, error) {
		return collectionNode(spec.Node(value))
	})
	dir.Mkdir(spec.Create)
	dir.entry.handler.ReadDir = func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
		p, err := parent.load(ctx, request(req))
		if err != nil {
			return nil, err
		}
		items, err := spec.List(ctx, request(req), p)
		if err != nil {
			return nil, err
		}
		nodes := make([]*vfs.Node, 0, len(items))
		seen := map[string]bool{}
		for _, value := range items {
			node, err := collectionNode(spec.Node(value))
			if err != nil {
				return nil, err
			}
			if seen[node.Name] {
				return nil, fmt.Errorf("%w: duplicate collection key %q", vfs.ErrInternal, node.Name)
			}
			seen[node.Name] = true
			nodes = append(nodes, node)
		}
		sort.Slice(nodes, func(i, j int) bool { return nodes[i].Name < nodes[j].Name })
		return nodes, nil
	}
	return dir, item
}

func collectionNode(node *vfs.Node) (*vfs.Node, error) {
	if node == nil || !node.IsDir || !validName(node.Name) {
		return nil, fmt.Errorf("%w: collection Node must return a named directory", vfs.ErrInternal)
	}
	copy := *node
	return &copy, nil
}

func expand(pattern string, req Request) string {
	parts := strings.Split(pattern, "/")
	for i, part := range parts {
		if strings.HasPrefix(part, "{") {
			parts[i] = req.Param(strings.Trim(part, "{}"))
		}
	}
	return path.Clean(strings.Join(parts, "/"))
}
