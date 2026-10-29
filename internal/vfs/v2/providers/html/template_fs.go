package html

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"github.com/akyaiy/veido/internal/vfs/v2/virtfs"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path"
	"sort"
	"strings"
)

func (p *Provider) buildTemplateFS() vfs.FSProvider {
	fs := virtfs.New()
	fs.Route("/", virtfs.Handler{
		Stat: func(ctx context.Context, _ virtfs.Request) (*vfs.Node, error) {
			if _, err := p.site(ctx); err != nil {
				return nil, mapProviderError(vfs.OpStat, err)
			}
			return sdk.DirNode("templates"), nil
		},
		ReadDir: func(ctx context.Context, _ virtfs.Request) ([]*vfs.Node, error) {
			site, err := p.site(ctx)
			if err != nil {
				return nil, mapProviderError(vfs.OpReadDir, err)
			}
			keys, err := p.store.ListTemplateKeys(ctx, site.ID)
			if err != nil {
				return nil, mapProviderError(vfs.OpReadDir, err)
			}
			nodes := make([]*vfs.Node, 0, len(keys))
			for _, key := range keys {
				nodes = append(nodes, sdk.DirNode(key))
			}
			return nodes, nil
		},
		Control: func(ctx context.Context, _ virtfs.Request, command string, data []byte) ([]byte, error) {
			if command != "install" {
				return nil, vfs.ErrUnsupported
			}
			if len(data) > maxInstallInputBytes {
				return nil, vfs.ErrResourceExhausted
			}
			input, err := decodeInstallTemplate(data)
			if err != nil {
				return nil, err
			}
			site, err := p.site(ctx)
			if err != nil {
				return nil, mapProviderError(vfs.OpControl, err)
			}
			item, err := p.templates.Install(ctx, site, input)
			if err != nil {
				return nil, mapProviderError(vfs.OpControl, err)
			}
			bound, err := sdk.Bound(ctx)
			if err != nil {
				return nil, err
			}
			manifestURI, err := bound.SelfURI(path.Join("/", item.TemplateKey, item.Version, "manifest.json"))
			if err != nil {
				return nil, err
			}
			assets, err := p.store.ListTemplateAssets(ctx, item.ID)
			if err != nil {
				return nil, mapProviderError(vfs.OpControl, err)
			}
			assetPaths := make([]string, 0, len(assets))
			for _, asset := range assets {
				assetPaths = append(assetPaths, asset.Path)
			}
			return json.MarshalIndent(InstalledTemplateDocument{
				TemplateKey: item.TemplateKey, Version: item.Version, Entrypoint: item.Entrypoint,
				PackageDigest: item.PackageDigest, ManifestDigest: item.ManifestDigest,
				Manifest: string(manifestURI), Assets: assetPaths,
			}, "", "  ")
		},
	})

	fs.Route("/{templateKey}", virtfs.Handler{
		Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
			versions, err := p.templateVersions(ctx, req.Match.Param("templateKey"))
			if err != nil || len(versions) == 0 {
				if err == nil {
					err = ErrTemplateNotFound
				}
				return nil, mapProviderError(vfs.OpStat, err)
			}
			return sdk.DirNode(req.Match.Param("templateKey")), nil
		},
		ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
			versions, err := p.templateVersions(ctx, req.Match.Param("templateKey"))
			if err != nil {
				return nil, mapProviderError(vfs.OpReadDir, err)
			}
			if len(versions) == 0 {
				return nil, mapProviderError(vfs.OpReadDir, ErrTemplateNotFound)
			}
			nodes := make([]*vfs.Node, 0, len(versions))
			for _, item := range versions {
				nodes = append(nodes, &vfs.Node{Name: item.Version, Kind: "application_template", IsDir: true, UpdatedAt: item.CreatedAt})
			}
			return nodes, nil
		},
	})

	fs.Route("/{templateKey}/{version}", virtfs.Handler{
		Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
			item, err := p.template(ctx, req)
			if err != nil {
				return nil, mapProviderError(vfs.OpStat, err)
			}
			return &vfs.Node{Name: item.Version, Kind: "application_template", IsDir: true, UpdatedAt: item.CreatedAt}, nil
		},
		ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
			item, err := p.template(ctx, req)
			if err != nil {
				return nil, mapProviderError(vfs.OpReadDir, err)
			}
			return []*vfs.Node{
				{Name: "files", Kind: "dir", IsDir: true, UpdatedAt: item.CreatedAt},
				{Name: "manifest.json", Kind: "file", Size: int64(len(item.ManifestJSON)), UpdatedAt: item.CreatedAt},
			}, nil
		},
	})

	fs.Route("/{templateKey}/{version}/manifest.json", virtfs.Handler{
		Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
			item, err := p.template(ctx, req)
			if err != nil {
				return nil, mapProviderError(vfs.OpStat, err)
			}
			return &vfs.Node{Name: "manifest.json", Kind: "file", Size: int64(len(item.ManifestJSON)), UpdatedAt: item.CreatedAt}, nil
		},
		OpenFile: func(ctx context.Context, req virtfs.Request, flags int) (vfs.File, error) {
			if wantsEditorWrite(flags) {
				return nil, vfs.ErrUnsupported
			}
			item, err := p.template(ctx, req)
			if err != nil {
				return nil, mapProviderError(vfs.OpOpenFile, err)
			}
			node := &vfs.Node{Name: "manifest.json", Kind: "file", Size: int64(len(item.ManifestJSON)), UpdatedAt: item.CreatedAt}
			return sdk.ReadFile(ctx, node, io.NopCloser(bytes.NewReader(item.ManifestJSON))), nil
		},
	})

	filesHandler := func(wildcard bool) virtfs.Handler {
		assetPath := func(req virtfs.Request) string {
			if wildcard {
				return req.Match.Wildcard()
			}
			return ""
		}
		return virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				item, err := p.template(ctx, req)
				if err != nil {
					return nil, mapProviderError(vfs.OpStat, err)
				}
				node, err := p.templateAssetNode(ctx, item, assetPath(req))
				return node, mapProviderError(vfs.OpStat, err)
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				item, err := p.template(ctx, req)
				if err != nil {
					return nil, mapProviderError(vfs.OpReadDir, err)
				}
				nodes, err := p.templateAssetChildren(ctx, item, assetPath(req))
				return nodes, mapProviderError(vfs.OpReadDir, err)
			},
			OpenFile: func(ctx context.Context, req virtfs.Request, flags int) (vfs.File, error) {
				if wantsEditorWrite(flags) {
					return nil, vfs.ErrUnsupported
				}
				item, err := p.template(ctx, req)
				if err != nil {
					return nil, mapProviderError(vfs.OpOpenFile, err)
				}
				asset, err := p.store.TemplateAssetByPath(ctx, item.ID, assetPath(req))
				if err != nil {
					return nil, mapProviderError(vfs.OpOpenFile, err)
				}
				node := &vfs.Node{Name: path.Base(asset.Path), Kind: "file", Size: asset.Size, UpdatedAt: item.CreatedAt}
				return sdk.ReadFile(ctx, node, io.NopCloser(bytes.NewReader(asset.Data))), nil
			},
		}
	}
	fs.Route("/{templateKey}/{version}/files", filesHandler(false))
	fs.Route("/{templateKey}/{version}/files/*", filesHandler(true))
	return fs
}

func decodeInstallTemplate(data []byte) (InstallTemplateInput, error) {
	var input InstallTemplateInput
	if len(bytes.TrimSpace(data)) == 0 {
		data = []byte("{}")
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&input); err != nil {
		return input, vfs.NewError(vfs.KindInvalidArgument, vfs.OpControl, "invalid template install JSON", errors.Join(os.ErrInvalid, err))
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return input, vfs.NewError(vfs.KindInvalidArgument, vfs.OpControl, "expected one JSON value", os.ErrInvalid)
	}
	return input, nil
}

func (p *Provider) templateVersions(ctx context.Context, key string) ([]ApplicationTemplate, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	return p.store.ListTemplateVersions(ctx, site.ID, key)
}

func (p *Provider) template(ctx context.Context, req virtfs.Request) (*ApplicationTemplate, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	return p.store.TemplateByKeyVersion(ctx, site.ID, req.Match.Param("templateKey"), req.Match.Param("version"))
}

func (p *Provider) templateAssetNode(ctx context.Context, item *ApplicationTemplate, assetPath string) (*vfs.Node, error) {
	if assetPath == "" {
		return &vfs.Node{Name: "files", Kind: "dir", IsDir: true, UpdatedAt: item.CreatedAt}, nil
	}
	asset, err := p.store.TemplateAssetByPath(ctx, item.ID, assetPath)
	if err == nil {
		return &vfs.Node{Name: path.Base(asset.Path), Kind: "file", Size: asset.Size, UpdatedAt: item.CreatedAt}, nil
	}
	if !errors.Is(err, ErrTemplateAssetNotFound) {
		return nil, err
	}
	assets, err := p.store.ListTemplateAssets(ctx, item.ID)
	if err != nil {
		return nil, err
	}
	prefix := strings.TrimSuffix(assetPath, "/") + "/"
	for _, candidate := range assets {
		if strings.HasPrefix(candidate.Path, prefix) {
			return &vfs.Node{Name: path.Base(assetPath), Kind: "dir", IsDir: true, UpdatedAt: item.CreatedAt}, nil
		}
	}
	return nil, ErrTemplateAssetNotFound
}

func (p *Provider) templateAssetChildren(ctx context.Context, item *ApplicationTemplate, parent string) ([]*vfs.Node, error) {
	node, err := p.templateAssetNode(ctx, item, parent)
	if err != nil {
		return nil, err
	}
	if !node.IsDir {
		return nil, os.ErrInvalid
	}
	assets, err := p.store.ListTemplateAssets(ctx, item.ID)
	if err != nil {
		return nil, err
	}
	prefix := ""
	if parent != "" {
		prefix = strings.TrimSuffix(parent, "/") + "/"
	}
	children := make(map[string]*vfs.Node)
	for _, asset := range assets {
		if !strings.HasPrefix(asset.Path, prefix) {
			continue
		}
		rest := strings.TrimPrefix(asset.Path, prefix)
		name, remainder, _ := strings.Cut(rest, "/")
		if remainder != "" {
			children[name] = &vfs.Node{Name: name, Kind: "dir", IsDir: true, UpdatedAt: item.CreatedAt}
		} else if _, exists := children[name]; !exists {
			children[name] = &vfs.Node{Name: name, Kind: "file", Size: asset.Size, UpdatedAt: item.CreatedAt}
		}
	}
	nodes := make([]*vfs.Node, 0, len(children))
	for _, child := range children {
		nodes = append(nodes, child)
	}
	sort.Slice(nodes, func(i, j int) bool { return nodes[i].Name < nodes[j].Name })
	return nodes, nil
}

func templateRouteInfo() []sdk.RouteInfo {
	return []sdk.RouteInfo{
		{Path: "/templates", Kind: "directory", Operations: []string{"stat", "read_dir", "control"}, Commands: []sdk.CommandInfo{{Name: "install", Input: sdk.Schema[InstallTemplateInput](), Output: sdk.Schema[InstalledTemplateDocument]()}}},
		{Path: "/templates/{templateKey}", Kind: "directory", Operations: []string{"stat", "read_dir"}},
		{Path: "/templates/{templateKey}/{version}", Kind: "directory", Operations: []string{"stat", "read_dir"}},
		{Path: "/templates/{templateKey}/{version}/manifest.json", Kind: "file", Operations: []string{"stat", "open_file"}},
		{Path: "/templates/{templateKey}/{version}/files/*", Kind: "file_tree", Operations: []string{"stat", "read_dir", "open_file"}},
	}
}
