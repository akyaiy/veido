package html

import (
	"MyServer/internal/common"
	"context"
	"errors"
)

var (
	ErrSiteNotFound              = errors.New("html site not found")
	ErrSiteRevisionConflict      = errors.New("site revision conflict")
	ErrPublisherRootNotFound     = errors.New("html publisher root not found")
	ErrPageNotFound              = errors.New("html page not found")
	ErrAlreadyExists             = errors.New("html store record already exists")
	ErrInvalidRecord             = errors.New("invalid html store record")
	ErrNodeNotVisible            = errors.New("html node not visible")
	ErrInvalidAudience           = errors.New("invalid html visibility audience")
	ErrVisibilityConflict        = errors.New("visibility revision conflict")
	ErrTemplateNotFound          = errors.New("html application template not found")
	ErrTemplateAssetNotFound     = errors.New("html application template asset not found")
	ErrInvalidTemplate           = errors.New("invalid html application template")
	ErrBlockNotFound             = errors.New("html block not found")
	ErrBlockRevisionConflict     = errors.New("block revision conflict")
	ErrBlockTreeRevisionConflict = errors.New("block tree revision conflict")
	ErrInvalidBlockType          = errors.New("invalid block type")
	ErrInvalidBlockTree          = errors.New("invalid block tree")
)

// Store owns only HTML Provider metadata. Its records do not grant access to
// logical or physical VFS resources.
type Store interface {
	CreateSite(ctx context.Context, input NewSite) (*Site, error)
	UpdateSite(ctx context.Context, siteID, expectedModelRevision int64, name, baseURL string) (*Site, error)
	SiteByID(ctx context.Context, siteID int64) (*Site, error)
	SiteByConnection(ctx context.Context, connectionID int64) (*Site, error)

	CreatePublisherRoot(ctx context.Context, input NewPublisherRoot) (*PublisherRoot, error)
	ListPublisherRoots(ctx context.Context, siteID int64) ([]PublisherRoot, error)

	PageByID(ctx context.Context, siteID, pageID int64) (*Page, error)
	PageByKey(ctx context.Context, siteID int64, pageKey string) (*Page, error)
	ListPages(ctx context.Context, siteID int64) ([]Page, error)
	CreateBlock(ctx context.Context, input NewBlock) (*Block, error)
	BlockByKey(ctx context.Context, siteID int64, blockKey string) (*Block, error)
	ListBlocks(ctx context.Context, siteID int64) ([]Block, error)
	UpdateBlock(ctx context.Context, siteID int64, blockKey, name, typ, publisher string, bundle common.CanonURI, expectedRevision int64) (*Block, error)
	DeleteBlock(ctx context.Context, siteID int64, blockKey string, expectedRevision int64) error
	ReadBlockTree(ctx context.Context, siteID int64) (*BlockTree, error)
	ReplaceBlockTree(ctx context.Context, siteID, expectedRevision int64, document []byte) (*BlockTree, error)
	PageTypes(ctx context.Context, siteID, pageID int64) ([]string, error)
	PageSearchTags(ctx context.Context, siteID, pageID int64) ([]string, error)

	EditorLayout(ctx context.Context, siteID int64) (*EditorLayout, error)
	ReplaceEditorLayout(ctx context.Context, siteID, expectedRevision int64, schemaVersion int, xml []byte) (*EditorLayout, error)
	SiteSEO(ctx context.Context, siteID int64) (*SiteSEO, error)
	NodeVisible(ctx context.Context, siteID int64, nodeKind, nodeKey string, audiences []string) (bool, error)
	NodeAudiences(ctx context.Context, siteID int64, nodeKind, nodeKey string) ([]string, error)
	VisibleNodeKeys(ctx context.Context, siteID int64, nodeKind string, audiences []string) (map[string]struct{}, error)
	ReplaceNodeVisibility(ctx context.Context, siteID int64, nodeKind, nodeKey string, expectedRevision int64, audiences []string) (int64, error)

	InstallTemplate(ctx context.Context, input NewTemplatePackage) (*ApplicationTemplate, error)
	ListTemplateKeys(ctx context.Context, siteID int64) ([]string, error)
	ListTemplateVersions(ctx context.Context, siteID int64, templateKey string) ([]ApplicationTemplate, error)
	TemplateByKeyVersion(ctx context.Context, siteID int64, templateKey, version string) (*ApplicationTemplate, error)
	ListTemplateAssets(ctx context.Context, packageID int64) ([]TemplateAsset, error)
	TemplateAssetByPath(ctx context.Context, packageID int64, assetPath string) (*TemplateAsset, error)
}
