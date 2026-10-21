package html

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"sort"
	"strings"
)

var (
	ErrScopeMismatch         = errors.New("html target scope mismatch")
	ErrTargetOutsideRoot     = errors.New("html target is outside registered publisher roots")
	ErrUnexpectedTargetType  = errors.New("unexpected html target type")
	ErrPublisherRootInactive = errors.New("publisher root is inactive")
	ErrIncompleteBundle      = errors.New("content bundle is incomplete")
)

type BindingService struct {
	store Store
}

func NewBindingService(store Store) (*BindingService, error) {
	if store == nil {
		return nil, ErrInvalidRecord
	}
	return &BindingService{store: store}, nil
}

func (s *BindingService) RegisterRoot(ctx context.Context, bound vfs.BoundVFS, site *Site, scopeKey, publisher, rawURI, purpose string, visibleTo []string) (*PublisherRoot, error) {
	if bound == nil || site == nil || strings.TrimSpace(scopeKey) == "" {
		return nil, ErrInvalidRecord
	}
	uri, err := canonicalTarget(rawURI, scopeKey)
	if err != nil {
		return nil, err
	}
	if purpose != "content" && purpose != "assets" && purpose != "publication" {
		return nil, ErrInvalidRecord
	}
	node, err := bound.Stat(ctx, uri)
	if err != nil {
		return nil, err
	}
	if node == nil || !node.IsDir {
		return nil, ErrUnexpectedTargetType
	}
	publisher = strings.TrimSpace(publisher)
	if publisher == "" {
		return nil, ErrInvalidRecord
	}
	audiences, err := normalizeAudiences(visibleTo)
	if err != nil {
		return nil, err
	}
	roots, err := s.store.ListPublisherRoots(ctx, site.ID)
	if err != nil {
		return nil, err
	}
	for i := range roots {
		root := &roots[i]
		if root.PublisherSubjectKey == publisher && root.RootURI == uri && root.Purpose == purpose {
			current, err := s.store.NodeAudiences(ctx, site.ID, NodeKindPublisher, fmt.Sprint(root.ID))
			if err != nil {
				return nil, err
			}
			if strings.Join(current, "\x00") != strings.Join(audiences, "\x00") {
				return nil, ErrAlreadyExists
			}
			return root, nil
		}
	}
	return s.store.CreatePublisherRoot(ctx, NewPublisherRoot{
		SiteID: site.ID, PublisherSubjectKey: publisher, RootURI: uri, Purpose: purpose, Status: "active", VisibleTo: audiences,
	})
}

func (s *BindingService) ValidatePageBundle(ctx context.Context, bound vfs.BoundVFS, site *Site, scopeKey, rawURI string) (common.CanonURI, *PublisherRoot, error) {
	if bound == nil || site == nil {
		return common.EmptyURI, nil, ErrInvalidRecord
	}
	uri, err := canonicalTarget(rawURI, scopeKey)
	if err != nil {
		return common.EmptyURI, nil, err
	}
	roots, err := s.store.ListPublisherRoots(ctx, site.ID)
	if err != nil {
		return common.EmptyURI, nil, err
	}
	matching := make([]PublisherRoot, 0)
	for _, root := range roots {
		if root.Purpose == "content" && sameOrDescendant(root.RootURI, uri) {
			matching = append(matching, root)
		}
	}
	if len(matching) == 0 {
		return common.EmptyURI, nil, ErrTargetOutsideRoot
	}
	sort.Slice(matching, func(i, j int) bool { return len(matching[i].RootURI.Path()) > len(matching[j].RootURI.Path()) })
	root := matching[0]
	if root.Status != "active" {
		return common.EmptyURI, nil, ErrPublisherRootInactive
	}
	node, err := bound.Stat(ctx, uri)
	if err != nil {
		return common.EmptyURI, nil, err
	}
	if node == nil || !node.IsDir {
		return common.EmptyURI, nil, ErrUnexpectedTargetType
	}
	for _, name := range BundleFileNames {
		fileURI, err := bundleFileURI(uri, name)
		if err != nil {
			return common.EmptyURI, nil, err
		}
		file, err := bound.Stat(ctx, fileURI)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) || vfs.IsKind(err, vfs.KindNotFound) {
				return common.EmptyURI, nil, fmt.Errorf("%w: missing %s", ErrIncompleteBundle, name)
			}
			return common.EmptyURI, nil, err
		}
		if file == nil || file.IsDir {
			return common.EmptyURI, nil, ErrUnexpectedTargetType
		}
	}
	return uri, &root, nil
}

func bundleFileURI(root common.CanonURI, name string) (common.CanonURI, error) {
	address := common.ParseResourceAddress(root)
	if address == nil {
		return common.EmptyURI, ErrInvalidRecord
	}
	payload := address.Payload()
	payload.Path = path.Join(payload.Path, name)
	return payload.URI()
}

func canonicalTarget(rawURI, scopeKey string) (common.CanonURI, error) {
	uri, err := common.CastURI(strings.TrimSpace(rawURI))
	if err != nil || !uri.HasScope() {
		return common.EmptyURI, fmt.Errorf("%w: target must be a canonical URI with explicit scope", ErrInvalidRecord)
	}
	if uri.ScopeKey() != scopeKey {
		return common.EmptyURI, ErrScopeMismatch
	}
	if uri.Provider() == ProviderKey {
		return common.EmptyURI, fmt.Errorf("%w: HTML bundle must belong to a physical provider", ErrInvalidRecord)
	}
	return uri, nil
}

func sameOrDescendant(root, target common.CanonURI) bool {
	if root.Provider() != target.Provider() || root.ConnectionKey() != target.ConnectionKey() || root.ScopeKey() != target.ScopeKey() {
		return false
	}
	rootPath := path.Clean(root.Path())
	targetPath := path.Clean(target.Path())
	return targetPath == rootPath || rootPath == "/" || strings.HasPrefix(targetPath, rootPath+"/")
}
