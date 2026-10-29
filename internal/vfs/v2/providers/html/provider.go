package html

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
)

type Provider struct {
	store      *SQLiteStore
	pages      *PageService
	bindings   *BindingService
	visibility *VisibilityService
	layouts    *LayoutService
	templates  *TemplateService
	blocks     *BlockService
	connection vfs.ProviderConnection
	routes     []sdk.RouteInfo
	vfs.FSProvider
}

func NewProvider(store *SQLiteStore, connection vfs.ProviderConnection) (*Provider, error) {
	if store == nil || connection.ID <= 0 || connection.ProviderKey != ProviderKey || connection.ScopeKey == "" || connection.ConnectionKey == "" {
		return nil, vfs.ErrInvalidNewInstanceParams
	}
	pages, err := NewPageService(store)
	if err != nil {
		return nil, err
	}
	bindings, err := NewBindingService(store)
	if err != nil {
		return nil, err
	}
	visibility, err := NewVisibilityService(store)
	if err != nil {
		return nil, err
	}
	layouts, err := NewLayoutService(store)
	if err != nil {
		return nil, err
	}
	templates, err := NewTemplateService(store)
	if err != nil {
		return nil, err
	}
	blocks, err := NewBlockService(store)
	if err != nil {
		return nil, err
	}
	p := &Provider{store: store, pages: pages, bindings: bindings, visibility: visibility, layouts: layouts, templates: templates, blocks: blocks, connection: connection}
	base, err := p.buildFS()
	if err != nil {
		return nil, err
	}
	templateFS := p.buildTemplateFS()
	fs, err := sdk.Compose(base, sdk.Mount{Path: "/templates", Provider: templateFS})
	if err != nil {
		return nil, err
	}
	p.FSProvider = fs
	p.routes = append(base.Routes(), templateRouteInfo()...)
	return p, nil
}

func (p *Provider) Routes() []sdk.RouteInfo { return append([]sdk.RouteInfo(nil), p.routes...) }

func (p *Provider) buildFS() (*sdk.Provider, error) {
	tree := sdk.New()
	root := tree.Root()

	sdk.Command(root, "initialize", sdk.CommandSpec[sdk.Unit, InitializeInput, SiteDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, input InitializeInput) (SiteDocument, error) {
			site, err := p.initialize(ctx, input)
			if err != nil {
				return SiteDocument{}, mapProviderError(vfs.OpControl, err)
			}
			doc, err := p.siteDocument(ctx, site)
			return doc, mapProviderError(vfs.OpControl, err)
		},
	})
	sdk.Command(root, "update", sdk.CommandSpec[sdk.Unit, UpdateSiteInput, SiteDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, input UpdateSiteInput) (SiteDocument, error) {
			site, err := p.site(ctx)
			if err != nil {
				return SiteDocument{}, mapProviderError(vfs.OpControl, err)
			}
			updated, err := p.store.UpdateSite(ctx, site.ID, input.ExpectedModelRevision, input.Name, input.BaseURL)
			if err != nil {
				return SiteDocument{}, mapProviderError(vfs.OpControl, err)
			}
			doc, err := p.siteDocument(ctx, updated)
			return doc, mapProviderError(vfs.OpControl, err)
		},
	})

	sdk.JSON(root, "site.json", func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (SiteDocument, error) {
		site, err := p.site(ctx)
		if err != nil {
			return SiteDocument{}, mapProviderError(vfs.OpRead, err)
		}
		doc, err := p.siteDocument(ctx, site)
		return doc, mapProviderError(vfs.OpRead, err)
	})
	sdk.JSON(root, "tree.json", func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (TreeDocument, error) {
		doc, err := p.treeDocument(ctx)
		return doc, mapProviderError(vfs.OpRead, err)
	})
	sdk.Command(root, "set-visibility", sdk.CommandSpec[sdk.Unit, SetVisibilityInput, VisibilityDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, input SetVisibilityInput) (VisibilityDocument, error) {
			site, err := p.site(ctx)
			if err != nil {
				return VisibilityDocument{}, mapProviderError(vfs.OpControl, err)
			}
			return p.setNodeVisibility(ctx, site.ID, NodeKindSite, SiteNodeKey, input)
		},
	})

	editorDir := sdk.Directory(root, "editor")
	editorDir.Metadata(func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (*vfs.Node, error) {
		if _, err := p.site(ctx); err != nil {
			return nil, mapProviderError(vfs.OpStat, err)
		}
		return sdk.DirNode("editor"), nil
	})
	sdk.File(editorDir, "model.xml", sdk.FileSpec[sdk.Unit]{
		Metadata: func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (*vfs.Node, error) {
			data, err := p.editorModel(ctx)
			if err != nil {
				return nil, mapProviderError(vfs.OpStat, err)
			}
			return sdk.FileNode("model.xml", int64(len(data))), nil
		},
		Open: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, flags int) (vfs.File, error) {
			if wantsEditorWrite(flags) {
				return nil, vfs.ErrUnsupported
			}
			data, err := p.editorModel(ctx)
			if err != nil {
				return nil, mapProviderError(vfs.OpOpenFile, err)
			}
			return sdk.ReadFile(ctx, sdk.FileNode("model.xml", int64(len(data))), io.NopCloser(bytes.NewReader(data))), nil
		},
	})
	sdk.BytesDocument(editorDir, "layout.xml",
		func(ctx context.Context, _ sdk.Request, _ sdk.Unit) ([]byte, error) {
			data, err := p.editorLayout(ctx)
			return data, mapProviderError(vfs.OpRead, err)
		},
		func(ctx context.Context, _ sdk.Request, _ sdk.Unit, data []byte) error {
			_, err := p.replaceEditorLayout(ctx, data)
			return mapProviderError(vfs.OpWrite, err)
		},
		int64(defaultLayoutLimits.MaxBytes),
	)

	publishersDir, publisherItem := sdk.CollectionResources(root, "publishers", "rootID", sdk.CollectionSpec[sdk.Unit, PublisherRoot]{
		List: func(ctx context.Context, _ sdk.Request, _ sdk.Unit) ([]PublisherRoot, error) {
			site, err := p.site(ctx)
			if err != nil {
				return nil, mapProviderError(vfs.OpReadDir, err)
			}
			roots, err := p.visiblePublisherRoots(ctx, site)
			return roots, mapProviderError(vfs.OpReadDir, err)
		},
		Lookup: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, key string) (PublisherRoot, error) {
			site, err := p.site(ctx)
			if err != nil {
				return PublisherRoot{}, mapProviderError(vfs.OpStat, err)
			}
			id, err := strconv.ParseInt(key, 10, 64)
			if err != nil || id <= 0 {
				return PublisherRoot{}, vfs.NewError(vfs.KindNotFound, vfs.OpStat, "publisher root not found", ErrPublisherRootNotFound)
			}
			roots, err := p.visiblePublisherRoots(ctx, site)
			if err != nil {
				return PublisherRoot{}, mapProviderError(vfs.OpStat, err)
			}
			for _, root := range roots {
				if root.ID == id {
					return root, nil
				}
			}
			return PublisherRoot{}, vfs.NewError(vfs.KindNotFound, vfs.OpStat, "publisher root not found", ErrPublisherRootNotFound)
		},
		Node: func(root PublisherRoot) *vfs.Node {
			return &vfs.Node{Name: strconv.FormatInt(root.ID, 10), Kind: "publisher_root", IsDir: true, UpdatedAt: root.UpdatedAt}
		},
	})

	blocksDir, blockItem := sdk.CollectionResources(root, "blocks", "blockKey", sdk.CollectionSpec[sdk.Unit, Block]{
		List: func(ctx context.Context, _ sdk.Request, _ sdk.Unit) ([]Block, error) {
			site, err := p.site(ctx)
			if err != nil {
				return nil, mapProviderError(vfs.OpReadDir, err)
			}
			blocks, err := p.visibleBlocks(ctx, site)
			return blocks, mapProviderError(vfs.OpReadDir, err)
		},
		Lookup: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, key string) (Block, error) {
			site, err := p.site(ctx)
			if err != nil {
				return Block{}, mapProviderError(vfs.OpStat, err)
			}
			b, err := p.visibleBlockByKey(ctx, site, key)
			if err != nil {
				return Block{}, mapProviderError(vfs.OpStat, err)
			}
			return *b, nil
		},
		Node: func(b Block) *vfs.Node {
			return &vfs.Node{Name: b.BlockKey, Kind: "html_block", IsDir: true, UpdatedAt: b.UpdatedAt}
		},
	})
	blocksDir.Metadata(func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (*vfs.Node, error) {
		if _, err := p.site(ctx); err != nil {
			return nil, mapProviderError(vfs.OpStat, err)
		}
		return sdk.DirNode("blocks"), nil
	})
	sdk.Command(blocksDir, "create", sdk.CommandSpec[sdk.Unit, CreateBlockInput, BlockDocument]{Handle: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, in CreateBlockInput) (BlockDocument, error) {
		b, err := p.createBlock(ctx, in)
		if err != nil {
			return BlockDocument{}, mapProviderError(vfs.OpControl, err)
		}
		d, err := p.blockDocument(ctx, b)
		return d, mapProviderError(vfs.OpControl, err)
	}})
	sdk.BytesDocument(blocksDir, "tree.json", func(ctx context.Context, _ sdk.Request, _ sdk.Unit) ([]byte, error) {
		d, err := p.blockTreeDocument(ctx)
		return d, mapProviderError(vfs.OpRead, err)
	}, func(ctx context.Context, _ sdk.Request, _ sdk.Unit, data []byte) error {
		err := p.replaceBlockTree(ctx, data)
		return mapProviderError(vfs.OpWrite, err)
	}, 1<<20)
	sdk.JSON(blockItem, "meta.json", func(ctx context.Context, _ sdk.Request, b Block) (BlockDocument, error) {
		d, err := p.blockDocument(ctx, &b)
		return d, mapProviderError(vfs.OpRead, err)
	})
	sdk.Command(blockItem, "update", sdk.CommandSpec[Block, UpdateBlockInput, BlockDocument]{Handle: func(ctx context.Context, _ sdk.Request, b Block, in UpdateBlockInput) (BlockDocument, error) {
		next, err := p.updateBlock(ctx, b, in)
		if err != nil {
			return BlockDocument{}, mapProviderError(vfs.OpControl, err)
		}
		d, err := p.blockDocument(ctx, next)
		return d, mapProviderError(vfs.OpControl, err)
	}})
	sdk.Command(blockItem, "delete", sdk.CommandSpec[Block, DeleteBlockInput, sdk.Unit]{Handle: func(ctx context.Context, _ sdk.Request, b Block, in DeleteBlockInput) (sdk.Unit, error) {
		return sdk.Unit{}, mapProviderError(vfs.OpControl, p.blocks.DeleteBlock(ctx, b.SiteID, b.BlockKey, in.ExpectedBlockRevision))
	}})
	sdk.Command(blockItem, "set-visibility", sdk.CommandSpec[Block, SetVisibilityInput, VisibilityDocument]{Handle: func(ctx context.Context, _ sdk.Request, b Block, in SetVisibilityInput) (VisibilityDocument, error) {
		return p.setNodeVisibility(ctx, b.SiteID, NodeKindBlock, b.BlockKey, in)
	}})
	publishersDir.Metadata(func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (*vfs.Node, error) {
		if _, err := p.site(ctx); err != nil {
			return nil, mapProviderError(vfs.OpStat, err)
		}
		return sdk.DirNode("publishers"), nil
	})
	sdk.Command(publishersDir, "register-root", sdk.CommandSpec[sdk.Unit, RegisterRootInput, PublisherRootDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, input RegisterRootInput) (PublisherRootDocument, error) {
			root, err := p.registerRoot(ctx, input)
			if err != nil {
				return PublisherRootDocument{}, mapProviderError(vfs.OpControl, err)
			}
			doc, err := p.publisherRootDocument(ctx, root)
			return doc, mapProviderError(vfs.OpControl, err)
		},
	})
	sdk.JSON(publisherItem, "info.json", func(ctx context.Context, _ sdk.Request, root PublisherRoot) (PublisherRootDocument, error) {
		return p.publisherRootDocument(ctx, &root)
	})
	sdk.Command(publisherItem, "set-visibility", sdk.CommandSpec[PublisherRoot, SetVisibilityInput, VisibilityDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, root PublisherRoot, input SetVisibilityInput) (VisibilityDocument, error) {
			return p.setNodeVisibility(ctx, root.SiteID, NodeKindPublisher, strconv.FormatInt(root.ID, 10), input)
		},
	})

	pagesDir, pageItem := sdk.CollectionResources(root, "pages", "pageKey", sdk.CollectionSpec[sdk.Unit, Page]{
		List: func(ctx context.Context, _ sdk.Request, _ sdk.Unit) ([]Page, error) {
			site, err := p.site(ctx)
			if err != nil {
				return nil, mapProviderError(vfs.OpReadDir, err)
			}
			pages, err := p.visiblePages(ctx, site)
			return pages, mapProviderError(vfs.OpReadDir, err)
		},
		Lookup: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, key string) (Page, error) {
			site, err := p.site(ctx)
			if err != nil {
				return Page{}, mapProviderError(vfs.OpStat, err)
			}
			page, err := p.visiblePageByKey(ctx, site, key)
			if err != nil {
				return Page{}, mapProviderError(vfs.OpStat, err)
			}
			return *page, nil
		},
		Node: func(page Page) *vfs.Node {
			return &vfs.Node{Name: page.PageKey, Kind: "html_page", IsDir: true, UpdatedAt: page.UpdatedAt}
		},
	})
	pagesDir.Metadata(func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (*vfs.Node, error) {
		if _, err := p.site(ctx); err != nil {
			return nil, mapProviderError(vfs.OpStat, err)
		}
		return sdk.DirNode("pages"), nil
	})
	sdk.Command(pagesDir, "create", sdk.CommandSpec[sdk.Unit, CreatePageInput, MutationDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, input CreatePageInput) (MutationDocument, error) {
			result, err := p.createPage(ctx, input)
			return treeMutationDocument(result), mapProviderError(vfs.OpControl, err)
		},
	})
	sdk.JSON(pageItem, "info.json", func(ctx context.Context, _ sdk.Request, page Page) (PageDocument, error) {
		doc, err := p.pageDocument(ctx, &page)
		return doc, mapProviderError(vfs.OpRead, err)
	})

	sdk.Command(pageItem, "update", sdk.CommandSpec[Page, UpdatePageInput, MutationDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, page Page, input UpdatePageInput) (MutationDocument, error) {
			result, err := p.pages.UpdatePage(ctx, UpdatePageRequest{SiteID: page.SiteID, PageID: page.ID, ExpectedPageRevision: input.ExpectedPageRevision, Slug: input.Slug, Title: input.Title, Note: input.Note, Description: input.Description, Status: input.Status})
			return pageMutationDocument(page.ID, result), mapProviderError(vfs.OpControl, err)
		},
	})
	sdk.Command(pageItem, "set-visibility", sdk.CommandSpec[Page, SetVisibilityInput, VisibilityDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, page Page, input SetVisibilityInput) (VisibilityDocument, error) {
			return p.setNodeVisibility(ctx, page.SiteID, NodeKindPage, page.PageKey, input)
		},
	})
	sdk.Command(pageItem, "move", sdk.CommandSpec[Page, MovePageInput, MutationDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, page Page, input MovePageInput) (MutationDocument, error) {
			result, err := p.movePage(ctx, page, input)
			return treeMutationDocument(result), mapProviderError(vfs.OpControl, err)
		},
	})
	sdk.Command(pageItem, "delete", sdk.CommandSpec[Page, DeletePageInput, MutationDocument]{
		Handle: func(ctx context.Context, _ sdk.Request, page Page, input DeletePageInput) (MutationDocument, error) {
			result, err := p.pages.DeletePage(ctx, DeletePageRequest{SiteID: page.SiteID, PageID: page.ID, ExpectedPageRevision: input.ExpectedPageRevision, ExpectedTreeRevision: input.ExpectedTreeRevision, Mode: input.Mode})
			return treeMutationDocument(result), mapProviderError(vfs.OpControl, err)
		},
	})
	for _, command := range []struct {
		name string
		call func(context.Context, SetPageValuesRequest) (*PageMutationResult, error)
	}{
		{"set-types", p.pages.SetTypes},
		{"set-search-tags", p.pages.SetSearchTags},
	} {
		command := command
		sdk.Command(pageItem, command.name, sdk.CommandSpec[Page, SetValuesInput, MutationDocument]{
			Handle: func(ctx context.Context, _ sdk.Request, page Page, input SetValuesInput) (MutationDocument, error) {
				result, err := command.call(ctx, SetPageValuesRequest{SiteID: page.SiteID, PageID: page.ID, ExpectedPageRevision: input.ExpectedPageRevision, Values: input.Values})
				return pageMutationDocument(page.ID, result), mapProviderError(vfs.OpControl, err)
			},
		})
	}

	return tree.Build()
}

func (p *Provider) site(ctx context.Context) (*Site, error) {
	site, err := p.store.SiteByConnection(ctx, p.connection.ID)
	if err != nil {
		return nil, err
	}
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return nil, err
	}
	visible, err := p.visibility.CanSeeSite(ctx, site.ID, actor)
	if err != nil {
		return nil, err
	}
	if !visible {
		return nil, ErrSiteNotFound
	}
	return site, nil
}

func (p *Provider) editorModel(ctx context.Context) ([]byte, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	pages, err := p.visiblePages(ctx, site)
	if err != nil {
		return nil, err
	}
	return BuildEditorModel(*site, pages)
}

func (p *Provider) editorLayout(ctx context.Context) ([]byte, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return nil, err
	}
	return p.layouts.Read(ctx, site.ID, actor)
}

func (p *Provider) replaceEditorLayout(ctx context.Context, data []byte) (int64, error) {
	site, err := p.site(ctx)
	if err != nil {
		return 0, err
	}
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return 0, err
	}
	return p.layouts.Replace(ctx, site.ID, actor, data)
}

func wantsEditorWrite(flags int) bool {
	return flags&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_TRUNC|os.O_CREATE) != 0
}

func (p *Provider) initialize(ctx context.Context, input InitializeInput) (*Site, error) {
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, ErrInvalidRecord
	}
	audiences, err := normalizeAudiences(input.VisibleTo)
	if err != nil {
		return nil, err
	}
	existing, err := p.store.SiteByConnection(ctx, p.connection.ID)
	if err == nil {
		visible, visibleErr := p.visibility.CanSeeSite(ctx, existing.ID, actor)
		if visibleErr != nil {
			return nil, visibleErr
		}
		if !visible {
			return nil, ErrSiteNotFound
		}
		current, audienceErr := p.store.NodeAudiences(ctx, existing.ID, NodeKindSite, SiteNodeKey)
		if audienceErr != nil {
			return nil, audienceErr
		}
		if existing.Name != name || existing.OwnerSubjectKey != actor.String() || existing.BaseURL != strings.TrimSpace(input.BaseURL) || existing.ApplicationTemplateKey != strings.TrimSpace(input.ApplicationTemplateKey) || existing.ApplicationTemplateVersion != strings.TrimSpace(input.ApplicationTemplateVersion) {
			return nil, ErrAlreadyExists
		}
		if strings.Join(current, "\x00") != strings.Join(audiences, "\x00") {
			return nil, ErrAlreadyExists
		}
		return existing, nil
	}
	if !errors.Is(err, ErrSiteNotFound) {
		return nil, err
	}
	return p.store.CreateSite(ctx, NewSite{ConnectionID: p.connection.ID, Name: name, OwnerSubjectKey: actor.String(), BaseURL: input.BaseURL, ApplicationTemplateKey: input.ApplicationTemplateKey, ApplicationTemplateVersion: input.ApplicationTemplateVersion, VisibleTo: audiences})
}

func (p *Provider) registerRoot(ctx context.Context, input RegisterRootInput) (*PublisherRoot, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return nil, err
	}
	publisher := strings.TrimSpace(input.PublisherSubjectKey)
	if publisher == "" {
		publisher = actor.String()
	}
	bound, err := sdk.Bound(ctx)
	if err != nil {
		return nil, err
	}
	return p.bindings.RegisterRoot(ctx, bound, site, p.connection.ScopeKey, publisher, input.RootURI, input.Purpose, input.VisibleTo)
}

func (p *Provider) createPage(ctx context.Context, input CreatePageInput) (*TreeMutationResult, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	if err := p.requireVisiblePageReferences(ctx, site, input.ParentID, input.Position); err != nil {
		return nil, err
	}
	bound, err := sdk.Bound(ctx)
	if err != nil {
		return nil, err
	}
	bundleRootURI, root, err := p.bindings.ValidatePageBundle(ctx, bound, site, p.connection.ScopeKey, input.BundleRootURI)
	if err != nil {
		return nil, err
	}
	return p.pages.CreatePage(ctx, CreatePageRequest{
		SiteID: site.ID, ExpectedTreeRevision: input.ExpectedTreeRevision, ParentID: input.ParentID, Anchor: input.Position.domain(),
		PageKey: input.PageKey, Slug: input.Slug, Title: input.Title, Note: input.Note, Description: input.Description, Status: input.Status,
		PublisherSubjectKey: root.PublisherSubjectKey, BundleRootURI: bundleRootURI, Types: input.Types, SearchTags: input.SearchTags, VisibleTo: input.VisibleTo,
	})
}

func (p *Provider) movePage(ctx context.Context, page Page, input MovePageInput) (*TreeMutationResult, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	if err := p.requireVisiblePageReferences(ctx, site, input.ParentID, input.Position); err != nil {
		return nil, err
	}
	return p.pages.MovePage(ctx, MovePageRequest{SiteID: page.SiteID, PageID: page.ID, ParentID: input.ParentID, Anchor: input.Position.domain(), ExpectedTreeRevision: input.ExpectedTreeRevision})
}

func (p *Provider) requireVisiblePageReferences(ctx context.Context, site *Site, parentID *int64, position PositionInput) error {
	needed := make([]int64, 0, 3)
	if parentID != nil {
		needed = append(needed, *parentID)
	}
	if position.BeforeID != nil {
		needed = append(needed, *position.BeforeID)
	}
	if position.AfterID != nil {
		needed = append(needed, *position.AfterID)
	}
	if len(needed) == 0 {
		return nil
	}
	pages, err := p.visiblePages(ctx, site)
	if err != nil {
		return err
	}
	visible := make(map[int64]struct{}, len(pages))
	for _, page := range pages {
		visible[page.ID] = struct{}{}
	}
	for _, id := range needed {
		if _, ok := visible[id]; !ok {
			return ErrParentNotFound
		}
	}
	return nil
}

func (p *Provider) pageDocument(ctx context.Context, page *Page) (PageDocument, error) {
	if page == nil {
		return PageDocument{}, ErrPageNotFound
	}
	types, err := p.store.PageTypes(ctx, page.SiteID, page.ID)
	if err != nil {
		return PageDocument{}, err
	}
	tags, err := p.store.PageSearchTags(ctx, page.SiteID, page.ID)
	if err != nil {
		return PageDocument{}, err
	}
	visibleTo, err := p.store.NodeAudiences(ctx, page.SiteID, NodeKindPage, page.PageKey)
	if err != nil {
		return PageDocument{}, err
	}
	return PageDocument{ID: page.ID, ParentID: page.ParentID, PageKey: page.PageKey, Slug: page.Slug, Title: page.Title, Note: page.Note, Description: page.Description, Status: page.Status, Position: page.Position, PublisherSubjectKey: page.PublisherSubjectKey, BundleRootURI: string(page.BundleRootURI), Revision: page.Revision, Types: types, SearchTags: tags, VisibleTo: visibleTo, CreatedAt: page.CreatedAt, UpdatedAt: page.UpdatedAt}, nil
}

func (p *Provider) visiblePages(ctx context.Context, site *Site) ([]Page, error) {
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return nil, err
	}
	pages, err := p.store.ListPages(ctx, site.ID)
	if err != nil {
		return nil, err
	}
	return p.visibility.VisiblePages(ctx, site.ID, actor, pages)
}

func (p *Provider) visiblePageByKey(ctx context.Context, site *Site, key string) (*Page, error) {
	pages, err := p.visiblePages(ctx, site)
	if err != nil {
		return nil, err
	}
	for i := range pages {
		if pages[i].PageKey == key {
			return &pages[i], nil
		}
	}
	return nil, ErrPageNotFound
}

func (p *Provider) visibleBlocks(ctx context.Context, site *Site) ([]Block, error) {
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return nil, err
	}
	blocks, err := p.store.ListBlocks(ctx, site.ID)
	if err != nil {
		return nil, err
	}
	return p.visibility.VisibleBlocks(ctx, site.ID, actor, blocks)
}
func (p *Provider) visibleBlockByKey(ctx context.Context, site *Site, key string) (*Block, error) {
	blocks, err := p.visibleBlocks(ctx, site)
	if err != nil {
		return nil, err
	}
	for i := range blocks {
		if blocks[i].BlockKey == key {
			return &blocks[i], nil
		}
	}
	return nil, ErrBlockNotFound
}
func (p *Provider) blockDocument(ctx context.Context, b *Block) (BlockDocument, error) {
	if b == nil {
		return BlockDocument{}, ErrBlockNotFound
	}
	visible, err := p.store.NodeAudiences(ctx, b.SiteID, NodeKindBlock, b.BlockKey)
	if err != nil {
		return BlockDocument{}, err
	}
	return BlockDocument{BlockKey: b.BlockKey, Name: b.Name, Type: b.Type, PublisherSubjectKey: b.PublisherSubjectKey, BundleRootURI: string(b.BundleRootURI), Revision: b.Revision, CreatedAt: b.CreatedAt, UpdatedAt: b.UpdatedAt, VisibleTo: visible}, nil
}
func (p *Provider) createBlock(ctx context.Context, in CreateBlockInput) (*Block, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	bound, err := sdk.Bound(ctx)
	if err != nil {
		return nil, err
	}
	uri, root, err := p.bindings.ValidateBlockBundle(ctx, bound, site, p.connection.ScopeKey, in.BundleRootURI, in.Type)
	if err != nil {
		return nil, err
	}
	return p.blocks.CreateBlock(ctx, CreateBlockRequest{SiteID: site.ID, BlockKey: in.BlockKey, Name: in.Name, Type: in.Type, PublisherSubjectKey: root.PublisherSubjectKey, BundleRootURI: uri, VisibleTo: in.VisibleTo})
}
func (p *Provider) updateBlock(ctx context.Context, b Block, in UpdateBlockInput) (*Block, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	bound, err := sdk.Bound(ctx)
	if err != nil {
		return nil, err
	}
	uri, root, err := p.bindings.ValidateBlockBundle(ctx, bound, site, p.connection.ScopeKey, in.BundleRootURI, in.Type)
	if err != nil {
		return nil, err
	}
	return p.blocks.UpdateBlock(ctx, UpdateBlockRequest{SiteID: b.SiteID, BlockKey: b.BlockKey, ExpectedRevision: in.ExpectedBlockRevision, Name: in.Name, Type: in.Type, PublisherSubjectKey: root.PublisherSubjectKey, BundleRootURI: uri})
}
func (p *Provider) blockTreeDocument(ctx context.Context) ([]byte, error) {
	site, err := p.site(ctx)
	if err != nil {
		return nil, err
	}
	stored, err := p.store.ReadBlockTree(ctx, site.ID)
	if err != nil {
		return nil, err
	}
	tree, err := ParseBlockTree(stored.DocumentJSON)
	if err != nil {
		return nil, err
	}
	blocks, err := p.visibleBlocks(ctx, site)
	if err != nil {
		return nil, err
	}
	visible := map[string]bool{}
	for _, b := range blocks {
		visible[b.BlockKey] = true
	}
	tree.Revision = stored.Revision
	tree.Folders = filterBlockFolders(tree.Folders, visible)
	return json.Marshal(tree)
}
func filterBlockFolders(folders []BlockFolder, visible map[string]bool) []BlockFolder {
	out := make([]BlockFolder, 0, len(folders))
	for _, f := range folders {
		n := f
		n.Folders = filterBlockFolders(f.Folders, visible)
		n.Blocks = n.Blocks[:0]
		for _, b := range f.Blocks {
			if visible[b] {
				n.Blocks = append(n.Blocks, b)
			}
		}
		if len(n.Blocks) > 0 || len(n.Folders) > 0 {
			out = append(out, n)
		}
	}
	return out
}
func (p *Provider) replaceBlockTree(ctx context.Context, data []byte) error {
	site, err := p.site(ctx)
	if err != nil {
		return err
	}
	tree, err := ParseBlockTree(data)
	if err != nil {
		return err
	}
	blocks, err := p.visibleBlocks(ctx, site)
	if err != nil {
		return err
	}
	visible := map[string]bool{}
	for _, b := range blocks {
		visible[b.BlockKey] = true
	}
	var check func([]BlockFolder) bool
	check = func(fs []BlockFolder) bool {
		for _, f := range fs {
			for _, b := range f.Blocks {
				if !visible[b] {
					return false
				}
			}
			if !check(f.Folders) {
				return false
			}
		}
		return true
	}
	if !check(tree.Folders) {
		return ErrBlockNotFound
	}
	stored, err := p.store.ReadBlockTree(ctx, site.ID)
	if err != nil {
		return err
	}
	if stored.Revision != tree.Revision {
		return &RevisionConflict{Kind: ErrBlockTreeRevisionConflict, Current: stored.Revision}
	}
	base, err := ParseBlockTree(stored.DocumentJSON)
	if err != nil {
		return err
	}
	merged := mergeVisibleBlockTree(base, tree, visible)
	merged.Revision = tree.Revision
	data, err = json.Marshal(merged)
	if err != nil {
		return err
	}
	_, err = p.blocks.ReplaceTree(ctx, site.ID, data)
	return err
}

// mergeVisibleBlockTree applies an actor's catalog edit without treating the
// visibility-filtered tree it read as the canonical tree. Hidden blocks keep
// their folders and order; only keys in visible may be removed or re-placed.
func mergeVisibleBlockTree(base, submitted BlockTreeDocument, visible map[string]bool) BlockTreeDocument {
	merged := BlockTreeDocument{Revision: base.Revision, Folders: cloneBlockFolders(base.Folders)}
	removeVisibleBlocks(merged.Folders, visible)

	var apply func([]BlockFolder, *[]BlockFolder)
	apply = func(folders []BlockFolder, target *[]BlockFolder) {
		for _, submittedFolder := range folders {
			folder := findBlockFolder(merged.Folders, submittedFolder.Key)
			if folder == nil {
				*target = append(*target, BlockFolder{Key: submittedFolder.Key, Name: submittedFolder.Name})
				folder = &(*target)[len(*target)-1]
			}
			folder.Blocks = append(folder.Blocks, submittedFolder.Blocks...)
			apply(submittedFolder.Folders, &folder.Folders)
		}
	}
	apply(submitted.Folders, &merged.Folders)
	return merged
}

func cloneBlockFolders(folders []BlockFolder) []BlockFolder {
	out := make([]BlockFolder, len(folders))
	for i, folder := range folders {
		out[i] = BlockFolder{
			Key:     folder.Key,
			Name:    folder.Name,
			Folders: cloneBlockFolders(folder.Folders),
			Blocks:  append([]string(nil), folder.Blocks...),
		}
	}
	return out
}

func removeVisibleBlocks(folders []BlockFolder, visible map[string]bool) {
	for i := range folders {
		folder := &folders[i]
		kept := folder.Blocks[:0]
		for _, key := range folder.Blocks {
			if !visible[key] {
				kept = append(kept, key)
			}
		}
		folder.Blocks = kept
		removeVisibleBlocks(folder.Folders, visible)
	}
}

func findBlockFolder(folders []BlockFolder, key string) *BlockFolder {
	for i := range folders {
		if folders[i].Key == key {
			return &folders[i]
		}
		if found := findBlockFolder(folders[i].Folders, key); found != nil {
			return found
		}
	}
	return nil
}

func (p *Provider) visiblePublisherRoots(ctx context.Context, site *Site) ([]PublisherRoot, error) {
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return nil, err
	}
	roots, err := p.store.ListPublisherRoots(ctx, site.ID)
	if err != nil {
		return nil, err
	}
	return p.visibility.VisiblePublisherRoots(ctx, site.ID, actor, roots)
}

func (p *Provider) treeDocument(ctx context.Context) (TreeDocument, error) {
	site, err := p.site(ctx)
	if err != nil {
		return TreeDocument{}, err
	}
	pages, err := p.visiblePages(ctx, site)
	if err != nil {
		return TreeDocument{}, err
	}
	children := make(map[int64][]Page)
	for _, page := range pages {
		parent := int64(0)
		if page.ParentID != nil {
			parent = *page.ParentID
		}
		children[parent] = append(children[parent], page)
	}
	var build func(int64) []TreePage
	build = func(parent int64) []TreePage {
		items := children[parent]
		sort.Slice(items, func(i, j int) bool {
			if items[i].Position == items[j].Position {
				return items[i].ID < items[j].ID
			}
			return items[i].Position < items[j].Position
		})
		out := make([]TreePage, 0, len(items))
		for _, page := range items {
			out = append(out, TreePage{ID: page.ID, PageKey: page.PageKey, Slug: page.Slug, Title: page.Title, Status: page.Status, Position: page.Position, Revision: page.Revision, Children: build(page.ID)})
		}
		return out
	}
	return TreeDocument{TreeRevision: site.TreeRevision, ModelRevision: site.ModelRevision, VisibilityRevision: site.VisibilityRevision, Pages: build(0)}, nil
}

func (p *Provider) siteDocument(ctx context.Context, site *Site) (SiteDocument, error) {
	if site == nil {
		return SiteDocument{}, ErrSiteNotFound
	}
	visibleTo, err := p.store.NodeAudiences(ctx, site.ID, NodeKindSite, SiteNodeKey)
	if err != nil {
		return SiteDocument{}, err
	}
	return SiteDocument{Name: site.Name, OwnerSubjectKey: site.OwnerSubjectKey, BaseURL: site.BaseURL, ApplicationTemplateKey: site.ApplicationTemplateKey, ApplicationTemplateVersion: site.ApplicationTemplateVersion, TreeRevision: site.TreeRevision, ModelRevision: site.ModelRevision, VisibilityRevision: site.VisibilityRevision, VisibleTo: visibleTo, CreatedAt: site.CreatedAt, UpdatedAt: site.UpdatedAt}, nil
}

func (p *Provider) publisherRootDocument(ctx context.Context, root *PublisherRoot) (PublisherRootDocument, error) {
	if root == nil {
		return PublisherRootDocument{}, ErrPublisherRootNotFound
	}
	visibleTo, err := p.store.NodeAudiences(ctx, root.SiteID, NodeKindPublisher, strconv.FormatInt(root.ID, 10))
	if err != nil {
		return PublisherRootDocument{}, err
	}
	return PublisherRootDocument{ID: root.ID, PublisherSubjectKey: root.PublisherSubjectKey, RootURI: string(root.RootURI), Purpose: root.Purpose, Status: root.Status, VisibleTo: visibleTo, CreatedAt: root.CreatedAt, UpdatedAt: root.UpdatedAt}, nil
}

func (p *Provider) setNodeVisibility(ctx context.Context, siteID int64, nodeKind, nodeKey string, input SetVisibilityInput) (VisibilityDocument, error) {
	revision, err := p.store.ReplaceNodeVisibility(ctx, siteID, nodeKind, nodeKey, input.ExpectedVisibilityRevision, input.VisibleTo)
	if err != nil {
		return VisibilityDocument{}, mapProviderError(vfs.OpControl, err)
	}
	values, err := p.store.NodeAudiences(ctx, siteID, nodeKind, nodeKey)
	return VisibilityDocument{VisibilityRevision: revision, VisibleTo: values}, mapProviderError(vfs.OpControl, err)
}

func treeMutationDocument(result *TreeMutationResult) MutationDocument {
	if result == nil {
		return MutationDocument{}
	}
	return MutationDocument{PageID: result.PageID, PageRevision: result.PageRevision, TreeRevision: result.TreeRevision, ModelRevision: result.ModelRevision, VisibilityRevision: result.VisibilityRevision}
}

func pageMutationDocument(pageID int64, result *PageMutationResult) MutationDocument {
	if result == nil {
		return MutationDocument{}
	}
	return MutationDocument{PageID: pageID, PageRevision: result.PageRevision, ModelRevision: result.ModelRevision}
}

func mapProviderError(op vfs.Operation, err error) error {
	if err == nil {
		return nil
	}
	if _, ok := vfs.KindOf(err); ok {
		return err
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || errors.Is(err, os.ErrNotExist) || errors.Is(err, os.ErrPermission) || errors.Is(err, os.ErrInvalid) || errors.Is(err, os.ErrExist) {
		return err
	}
	switch {
	case errors.Is(err, ErrInvalidRecord), errors.Is(err, ErrInvalidEditorXML), errors.Is(err, ErrInvalidAudience), errors.Is(err, ErrInvalidDeleteMode), errors.Is(err, ErrInvalidPosition), errors.Is(err, ErrScopeMismatch), errors.Is(err, ErrInvalidTemplate), errors.Is(err, ErrInvalidBlockType), errors.Is(err, ErrInvalidBlockTree):
		return vfs.NewError(vfs.KindInvalidArgument, op, "invalid HTML operation", err)
	case errors.Is(err, ErrSiteNotFound), errors.Is(err, ErrPublisherRootNotFound), errors.Is(err, ErrPageNotFound), errors.Is(err, ErrBlockNotFound), errors.Is(err, ErrParentNotFound), errors.Is(err, ErrNodeNotVisible), errors.Is(err, ErrTemplateNotFound), errors.Is(err, ErrTemplateAssetNotFound):
		return vfs.NewError(vfs.KindNotFound, op, "HTML resource not found", err)
	case errors.Is(err, ErrAlreadyExists):
		return vfs.NewError(vfs.KindAlreadyExists, op, "HTML resource already exists", err)
	case errors.Is(err, ErrSiteRevisionConflict), errors.Is(err, ErrPageRevisionConflict), errors.Is(err, ErrTreeRevisionConflict), errors.Is(err, ErrBlockRevisionConflict), errors.Is(err, ErrBlockTreeRevisionConflict), errors.Is(err, ErrVisibilityConflict), errors.Is(err, ErrLayoutRevisionConflict):
		return vfs.NewError(vfs.KindConflict, op, "HTML revision conflict", err)
	case errors.Is(err, ErrCycleDetected), errors.Is(err, ErrResourceInUse), errors.Is(err, ErrTargetOutsideRoot), errors.Is(err, ErrUnexpectedTargetType), errors.Is(err, ErrPublisherRootInactive), errors.Is(err, ErrIncompleteBundle):
		return vfs.NewError(vfs.KindFailedPrecondition, op, "HTML precondition failed", err)
	default:
		return vfs.NewError(vfs.KindInternal, op, "HTML provider failed", err)
	}
}
