package html

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
)

type LayoutService struct {
	store      Store
	visibility *VisibilityService
	limits     LayoutLimits
}

func NewLayoutService(store Store) (*LayoutService, error) {
	if store == nil {
		return nil, ErrInvalidRecord
	}
	visibility, err := NewVisibilityService(store)
	if err != nil {
		return nil, err
	}
	return &LayoutService{store: store, visibility: visibility, limits: effectiveLayoutLimits(LayoutLimits{})}, nil
}

func (s *LayoutService) Read(ctx context.Context, siteID int64, actor vfs.Actor) ([]byte, error) {
	state, err := s.load(ctx, siteID, actor)
	if err != nil {
		return nil, err
	}
	return NormalizeEditorLayout(projectLayout(state.stored, state.visiblePages), s.limits)
}

func (s *LayoutService) Replace(ctx context.Context, siteID int64, actor vfs.Actor, data []byte) (int64, error) {
	submitted, err := ParseEditorLayout(data, s.limits)
	if err != nil {
		return 0, err
	}
	state, err := s.load(ctx, siteID, actor)
	if err != nil {
		return 0, err
	}
	if submitted.Revision != state.stored.Revision {
		return 0, &RevisionConflict{Kind: ErrLayoutRevisionConflict, Current: state.stored.Revision}
	}
	if err := validateSubmittedLayout(*submitted, state.visiblePages); err != nil {
		return 0, err
	}

	merged := mergeLayout(state.stored, *submitted, state.allPages, state.visiblePages)
	merged.SchemaVersion = EditorXMLSchemaVersion
	merged.Revision = state.stored.Revision + 1
	normalized, err := NormalizeEditorLayout(merged, s.limits)
	if err != nil {
		return 0, err
	}
	updated, err := s.store.ReplaceEditorLayout(ctx, siteID, state.stored.Revision, EditorXMLSchemaVersion, normalized)
	if err != nil {
		return 0, err
	}
	return updated.Revision, nil
}

type layoutState struct {
	stored       LayoutDocument
	allPages     []Page
	visiblePages []Page
}

func (s *LayoutService) load(ctx context.Context, siteID int64, actor vfs.Actor) (*layoutState, error) {
	if siteID <= 0 {
		return nil, ErrInvalidRecord
	}
	if _, err := s.store.SiteByID(ctx, siteID); err != nil {
		return nil, err
	}
	visible, err := s.visibility.CanSeeSite(ctx, siteID, actor)
	if err != nil {
		return nil, err
	}
	if !visible {
		return nil, ErrSiteNotFound
	}
	pages, err := s.store.ListPages(ctx, siteID)
	if err != nil {
		return nil, err
	}
	visiblePages, err := s.visibility.VisiblePages(ctx, siteID, actor, pages)
	if err != nil {
		return nil, err
	}
	layout, err := s.store.EditorLayout(ctx, siteID)
	if err != nil {
		return nil, err
	}
	stored, err := parseStoredLayout(layout, s.limits)
	if err != nil {
		return nil, err
	}
	return &layoutState{stored: *stored, allPages: pages, visiblePages: visiblePages}, nil
}

func parseStoredLayout(layout *EditorLayout, limits LayoutLimits) (*LayoutDocument, error) {
	if layout == nil || layout.SchemaVersion != EditorXMLSchemaVersion || layout.Revision <= 0 {
		return nil, ErrInvalidRecord
	}
	if len(layout.XML) == 0 {
		return &LayoutDocument{SchemaVersion: layout.SchemaVersion, Revision: layout.Revision}, nil
	}
	document, err := ParseEditorLayout(layout.XML, limits)
	if err != nil {
		return nil, err
	}
	if document.SchemaVersion != layout.SchemaVersion || document.Revision != layout.Revision {
		return nil, ErrInvalidRecord
	}
	return document, nil
}

func validateSubmittedLayout(layout LayoutDocument, visiblePages []Page) error {
	visible := pageMap(visiblePages)
	nodes := make(map[int64]struct{}, len(layout.Nodes))
	for _, node := range layout.Nodes {
		if _, ok := visible[node.PageID]; !ok {
			return ErrPageNotFound
		}
		nodes[node.PageID] = struct{}{}
	}
	for _, connection := range layout.Connections {
		if _, ok := nodes[connection.FromID]; !ok {
			return ErrPageNotFound
		}
		if _, ok := nodes[connection.ToID]; !ok {
			return ErrPageNotFound
		}
		child, ok := visible[connection.ToID]
		if !ok || child.ParentID == nil || *child.ParentID != connection.FromID {
			return editorXMLInvalid("layout connection does not match the page tree")
		}
	}
	return nil
}

func projectLayout(layout LayoutDocument, visiblePages []Page) LayoutDocument {
	visible := pageMap(visiblePages)
	projected := LayoutDocument{SchemaVersion: layout.SchemaVersion, Revision: layout.Revision}
	nodes := make(map[int64]struct{})
	for _, node := range layout.Nodes {
		if _, ok := visible[node.PageID]; ok {
			projected.Nodes = append(projected.Nodes, node)
			nodes[node.PageID] = struct{}{}
		}
	}
	for _, connection := range layout.Connections {
		if _, fromVisible := nodes[connection.FromID]; !fromVisible {
			continue
		}
		if _, toVisible := nodes[connection.ToID]; !toVisible {
			continue
		}
		child := visible[connection.ToID]
		if child.ParentID != nil && *child.ParentID == connection.FromID {
			projected.Connections = append(projected.Connections, connection)
		}
	}
	return projected
}

func mergeLayout(current, submitted LayoutDocument, allPages, visiblePages []Page) LayoutDocument {
	all := pageMap(allPages)
	visible := pageMap(visiblePages)
	merged := LayoutDocument{SchemaVersion: EditorXMLSchemaVersion}
	for _, node := range current.Nodes {
		if _, exists := all[node.PageID]; !exists {
			continue
		}
		if _, actorCanSee := visible[node.PageID]; !actorCanSee {
			merged.Nodes = append(merged.Nodes, node)
		}
	}
	merged.Nodes = append(merged.Nodes, submitted.Nodes...)

	mergedNodeIDs := make(map[int64]struct{}, len(merged.Nodes))
	for _, node := range merged.Nodes {
		mergedNodeIDs[node.PageID] = struct{}{}
	}
	for _, connection := range current.Connections {
		fromPage, fromExists := all[connection.FromID]
		toPage, toExists := all[connection.ToID]
		if !fromExists || !toExists || toPage.ParentID == nil || *toPage.ParentID != fromPage.ID {
			continue
		}
		_, fromVisible := visible[connection.FromID]
		_, toVisible := visible[connection.ToID]
		if fromVisible && toVisible {
			continue
		}
		if _, ok := mergedNodeIDs[connection.FromID]; !ok {
			continue
		}
		if _, ok := mergedNodeIDs[connection.ToID]; !ok {
			continue
		}
		merged.Connections = append(merged.Connections, connection)
	}
	merged.Connections = append(merged.Connections, submitted.Connections...)
	return merged
}

func pageMap(pages []Page) map[int64]Page {
	out := make(map[int64]Page, len(pages))
	for _, page := range pages {
		out[page.ID] = page
	}
	return out
}
