package html

import "time"

type InitializeInput struct {
	Name                       string   `json:"name" required:"true"`
	BaseURL                    string   `json:"base_url,omitempty"`
	ApplicationTemplateKey     string   `json:"application_template_key,omitempty"`
	ApplicationTemplateVersion string   `json:"application_template_version,omitempty"`
	VisibleTo                  []string `json:"visible_to" required:"true"`
}

type SiteDocument struct {
	Name                       string    `json:"name"`
	OwnerSubjectKey            string    `json:"owner_subject_key"`
	BaseURL                    string    `json:"base_url"`
	ApplicationTemplateKey     string    `json:"application_template_key"`
	ApplicationTemplateVersion string    `json:"application_template_version"`
	TreeRevision               int64     `json:"tree_revision"`
	ModelRevision              int64     `json:"model_revision"`
	VisibilityRevision         int64     `json:"visibility_revision"`
	VisibleTo                  []string  `json:"visible_to"`
	CreatedAt                  time.Time `json:"created_at"`
	UpdatedAt                  time.Time `json:"updated_at"`
}

type UpdateSiteInput struct {
	ExpectedModelRevision int64  `json:"expected_model_revision" required:"true"`
	Name                  string `json:"name" required:"true"`
	BaseURL               string `json:"base_url"`
}

type RegisterRootInput struct {
	PublisherSubjectKey string   `json:"publisher_subject_key,omitempty"`
	RootURI             string   `json:"root_uri" required:"true"`
	Purpose             string   `json:"purpose" required:"true"`
	VisibleTo           []string `json:"visible_to" required:"true"`
}

type PublisherRootDocument struct {
	ID                  int64     `json:"id"`
	PublisherSubjectKey string    `json:"publisher_subject_key"`
	RootURI             string    `json:"root_uri"`
	Purpose             string    `json:"purpose"`
	Status              string    `json:"status"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
	VisibleTo           []string  `json:"visible_to"`
}

type PositionInput struct {
	BeforeID *int64 `json:"before_id,omitempty"`
	AfterID  *int64 `json:"after_id,omitempty"`
	First    bool   `json:"first,omitempty"`
	Last     bool   `json:"last,omitempty"`
}

func (p PositionInput) domain() PositionAnchor {
	return PositionAnchor{BeforeID: p.BeforeID, AfterID: p.AfterID, First: p.First, Last: p.Last}
}

type CreatePageInput struct {
	ExpectedTreeRevision int64         `json:"expected_tree_revision" required:"true"`
	ParentID             *int64        `json:"parent_id,omitempty"`
	Position             PositionInput `json:"position" required:"true"`
	PageKey              string        `json:"page_key" required:"true"`
	Slug                 string        `json:"slug" required:"true"`
	Title                string        `json:"title,omitempty"`
	Note                 string        `json:"note,omitempty"`
	Description          string        `json:"description,omitempty"`
	Status               string        `json:"status" required:"true"`
	BundleRootURI        string        `json:"bundle_root_uri" required:"true"`
	Types                []string      `json:"types,omitempty"`
	SearchTags           []string      `json:"search_tags,omitempty"`
	VisibleTo            []string      `json:"visible_to" required:"true"`
}

type UpdatePageInput struct {
	ExpectedPageRevision int64   `json:"expected_page_revision" required:"true"`
	Slug                 *string `json:"slug,omitempty"`
	Title                *string `json:"title,omitempty"`
	Note                 *string `json:"note,omitempty"`
	Description          *string `json:"description,omitempty"`
	Status               *string `json:"status,omitempty"`
}

type MovePageInput struct {
	ExpectedTreeRevision int64         `json:"expected_tree_revision" required:"true"`
	ParentID             *int64        `json:"parent_id,omitempty"`
	Position             PositionInput `json:"position" required:"true"`
}

type DeletePageInput struct {
	ExpectedPageRevision int64  `json:"expected_page_revision" required:"true"`
	ExpectedTreeRevision int64  `json:"expected_tree_revision" required:"true"`
	Mode                 string `json:"mode" required:"true"`
}

type SetValuesInput struct {
	ExpectedPageRevision int64    `json:"expected_page_revision" required:"true"`
	Values               []string `json:"values"`
}

type SetVisibilityInput struct {
	ExpectedVisibilityRevision int64    `json:"expected_visibility_revision" required:"true"`
	VisibleTo                  []string `json:"visible_to" required:"true"`
}

type VisibilityDocument struct {
	VisibilityRevision int64    `json:"visibility_revision"`
	VisibleTo          []string `json:"visible_to"`
}

type PageDocument struct {
	ID                  int64     `json:"id"`
	ParentID            *int64    `json:"parent_id,omitempty"`
	PageKey             string    `json:"page_key"`
	Slug                string    `json:"slug"`
	Title               string    `json:"title"`
	Note                string    `json:"note"`
	Description         string    `json:"description"`
	Status              string    `json:"status"`
	Position            int       `json:"position"`
	PublisherSubjectKey string    `json:"publisher_subject_key"`
	BundleRootURI       string    `json:"bundle_root_uri"`
	Revision            int64     `json:"revision"`
	Types               []string  `json:"types"`
	SearchTags          []string  `json:"search_tags"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
	VisibleTo           []string  `json:"visible_to"`
}

type CreateBlockInput struct {
	BlockKey      string   `json:"block_key" required:"true"`
	Name          string   `json:"name" required:"true"`
	Type          string   `json:"type" required:"true"`
	BundleRootURI string   `json:"bundle_root_uri" required:"true"`
	VisibleTo     []string `json:"visible_to" required:"true"`
}
type UpdateBlockInput struct {
	ExpectedBlockRevision int64  `json:"expected_block_revision" required:"true"`
	Name                  string `json:"name" required:"true"`
	Type                  string `json:"type" required:"true"`
	BundleRootURI         string `json:"bundle_root_uri" required:"true"`
}
type DeleteBlockInput struct {
	ExpectedBlockRevision int64 `json:"expected_block_revision" required:"true"`
}
type BlockDocument struct {
	BlockKey            string    `json:"block_key"`
	Name                string    `json:"name"`
	Type                string    `json:"type"`
	PublisherSubjectKey string    `json:"publisher_subject_key"`
	BundleRootURI       string    `json:"bundle_root_uri"`
	Revision            int64     `json:"revision"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
	VisibleTo           []string  `json:"visible_to"`
}

type TreeDocument struct {
	TreeRevision       int64      `json:"tree_revision"`
	ModelRevision      int64      `json:"model_revision"`
	VisibilityRevision int64      `json:"visibility_revision"`
	Pages              []TreePage `json:"pages"`
}

type TreePage struct {
	ID       int64      `json:"id"`
	PageKey  string     `json:"page_key"`
	Slug     string     `json:"slug"`
	Title    string     `json:"title"`
	Status   string     `json:"status"`
	Position int        `json:"position"`
	Revision int64      `json:"revision"`
	Children []TreePage `json:"children"`
}

type MutationDocument struct {
	PageID             int64 `json:"page_id,omitempty"`
	PageRevision       int64 `json:"page_revision,omitempty"`
	TreeRevision       int64 `json:"tree_revision,omitempty"`
	ModelRevision      int64 `json:"model_revision"`
	VisibilityRevision int64 `json:"visibility_revision,omitempty"`
}
