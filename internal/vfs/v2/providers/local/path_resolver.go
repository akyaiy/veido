package local

import (
	"context"
	"os"
	"strings"
)

type pathResolver struct {
	nodes  *nodeStore
	rootID int64
}

func newPathResolver(nodes *nodeStore, rootID int64) *pathResolver {
	return &pathResolver{nodes: nodes, rootID: rootID}
}

func (r *pathResolver) resolve(ctx context.Context, resourcePath string) (*metadataNode, error) {
	cleaned := cleanLocalPath(resourcePath)
	if cleaned == "/" {
		return r.nodes.root(ctx, r.rootID)
	}

	current, err := r.nodes.root(ctx, r.rootID)
	if err != nil {
		return nil, err
	}
	for _, part := range strings.Split(strings.Trim(cleaned, "/"), "/") {
		if part == "" {
			continue
		}
		current, err = r.nodes.child(ctx, current.ID, part)
		if err != nil {
			return nil, err
		}
	}
	return current, nil
}

func (r *pathResolver) resolveParent(ctx context.Context, parentPath string) (*metadataNode, error) {
	parent, err := r.resolve(ctx, parentPath)
	if err != nil {
		return nil, err
	}
	if !parent.IsDir {
		return nil, os.ErrInvalid
	}
	return parent, nil
}

func splitParent(resourcePath string) (string, string, error) {
	cleaned := cleanLocalPath(resourcePath)
	if cleaned == "/" {
		return "", "", os.ErrInvalid
	}
	i := strings.LastIndex(cleaned, "/")
	parentPath := cleaned[:i]
	if parentPath == "" {
		parentPath = "/"
	}
	name := cleaned[i+1:]
	if err := validateEntryName(name); err != nil {
		return "", "", err
	}
	return parentPath, name, nil
}
