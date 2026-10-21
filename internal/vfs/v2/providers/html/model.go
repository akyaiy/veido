package html

import (
	"MyServer/internal/common"
	"time"
)

const ProviderKey = "html"

const (
	NodeKindSite        = "site"
	NodeKindPage        = "page"
	NodeKindBlock       = "block"
	NodeKindTheme       = "theme"
	NodeKindPublisher   = "publisher"
	NodeKindPublication = "publication"
	SiteNodeKey         = "site"
	AudienceAll         = "all"
	AudienceGuest       = "guest"
)

const (
	ContentMarkdownName = "content.md"
	StyleSheetName      = "style.css"
	ScriptName          = "script.js"
)

var BundleFileNames = [...]string{ContentMarkdownName, StyleSheetName, ScriptName}

type Site struct {
	ID                         int64
	ConnectionID               int64
	Name                       string
	OwnerSubjectKey            string
	BaseURL                    string
	ApplicationTemplateKey     string
	ApplicationTemplateVersion string
	TreeRevision               int64
	ModelRevision              int64
	VisibilityRevision         int64
	CreatedAt                  time.Time
	UpdatedAt                  time.Time
}

type PublisherRoot struct {
	ID                  int64
	SiteID              int64
	PublisherSubjectKey string
	RootURI             common.CanonURI
	Purpose             string
	Status              string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type Page struct {
	ID                  int64
	SiteID              int64
	ParentID            *int64
	PageKey             string
	Slug                string
	Title               string
	Note                string
	Description         string
	Status              string
	Position            int
	PublisherSubjectKey string
	BundleRootURI       common.CanonURI
	Revision            int64
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

type EditorLayout struct {
	SiteID        int64
	SchemaVersion int
	Revision      int64
	XML           []byte
	UpdatedAt     time.Time
}

type SiteSEO struct {
	SiteID     int64
	RobotsText string
	UpdatedAt  time.Time
}

// ApplicationTemplate is an immutable, site-local application runtime
// package. Package identity is the (site, key, version) tuple; bytes are
// exposed only through TemplateAsset records in its manifest allowlist.
type ApplicationTemplate struct {
	ID             int64
	SiteID         int64
	TemplateKey    string
	Version        string
	Entrypoint     string
	PackageDigest  string
	ManifestDigest string
	ManifestJSON   []byte
	CreatedAt      time.Time
}

type TemplateAsset struct {
	PackageID   int64
	Path        string
	ContentType string
	Digest      string
	Size        int64
	Data        []byte
}

type NewTemplatePackage struct {
	SiteID         int64
	TemplateKey    string
	Version        string
	Entrypoint     string
	PackageDigest  string
	ManifestDigest string
	ManifestJSON   []byte
	Assets         []NewTemplateAsset
}

type NewTemplateAsset struct {
	Path        string
	ContentType string
	Digest      string
	Data        []byte
}

type NewSite struct {
	ConnectionID               int64
	Name                       string
	OwnerSubjectKey            string
	BaseURL                    string
	ApplicationTemplateKey     string
	ApplicationTemplateVersion string
	InitialLayoutXML           []byte
	VisibleTo                  []string
}

type NewPublisherRoot struct {
	SiteID              int64
	PublisherSubjectKey string
	RootURI             common.CanonURI
	Purpose             string
	Status              string
	VisibleTo           []string
}

type NewPage struct {
	SiteID              int64
	ParentID            *int64
	PageKey             string
	Slug                string
	Title               string
	Note                string
	Description         string
	Status              string
	Position            int
	PublisherSubjectKey string
	BundleRootURI       common.CanonURI
	Types               []string
	SearchTags          []string
	VisibleTo           []string
}

type NodeVisibility struct {
	SiteID      int64
	NodeKind    string
	NodeKey     string
	AudienceKey string
	CreatedAt   time.Time
}
