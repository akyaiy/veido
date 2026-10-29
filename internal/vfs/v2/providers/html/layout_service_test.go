package html

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"errors"
	"testing"
)

func TestLayoutServiceFiltersAndPreservesInvisibleLayout(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	alice := vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}
	bob := vfs.Actor{Kind: vfs.ActorUser, ID: "bob"}
	site, err := store.CreateSite(ctx, NewSite{
		ConnectionID:    700,
		Name:            "Shared editor",
		OwnerSubjectKey: alice.String(),
		VisibleTo:       []string{alice.String(), bob.String()},
	})
	if err != nil {
		t.Fatalf("CreateSite: %v", err)
	}
	alicePage := insertLayoutPage(t, store, site.ID, nil, "alice-page", 0, alice.String())
	bobPage := insertLayoutPage(t, store, site.ID, nil, "bob-page", 1, bob.String())

	fullXML := normalizeLayoutForTest(t, LayoutDocument{
		SchemaVersion: 1,
		Revision:      2,
		Nodes: []LayoutNode{
			{PageID: alicePage.ID, X: 10, Y: 10, Width: 100, Height: 50, View: "expanded"},
			{PageID: bobPage.ID, X: 20, Y: 20, Width: 100, Height: 50, View: "collapsed"},
		},
	})
	if _, err := store.ReplaceEditorLayout(ctx, site.ID, 1, 1, fullXML); err != nil {
		t.Fatalf("seed layout: %v", err)
	}

	service, err := NewLayoutService(store)
	if err != nil {
		t.Fatalf("NewLayoutService: %v", err)
	}
	aliceView := parseLayoutForTest(t, mustReadLayout(t, service, site.ID, alice))
	if aliceView.Revision != 2 || len(aliceView.Nodes) != 1 || aliceView.Nodes[0].PageID != alicePage.ID {
		t.Fatalf("alice view = %#v", aliceView)
	}
	bobView := parseLayoutForTest(t, mustReadLayout(t, service, site.ID, bob))
	if bobView.Revision != 2 || len(bobView.Nodes) != 1 || bobView.Nodes[0].PageID != bobPage.ID {
		t.Fatalf("bob view = %#v", bobView)
	}

	aliceReplacement := normalizeLayoutForTest(t, LayoutDocument{
		SchemaVersion: 1,
		Revision:      2,
		Nodes:         []LayoutNode{{PageID: alicePage.ID, X: 111, Y: 222, Width: 120, Height: 60, View: "collapsed"}},
	})
	revision, err := service.Replace(ctx, site.ID, alice, aliceReplacement)
	if err != nil || revision != 3 {
		t.Fatalf("Replace = revision %d, %v", revision, err)
	}

	persisted, err := store.EditorLayout(ctx, site.ID)
	if err != nil {
		t.Fatalf("EditorLayout: %v", err)
	}
	full := parseLayoutForTest(t, persisted.XML)
	if full.Revision != 3 || len(full.Nodes) != 2 {
		t.Fatalf("full layout = %#v", full)
	}
	byID := map[int64]LayoutNode{}
	for _, node := range full.Nodes {
		byID[node.PageID] = node
	}
	if byID[alicePage.ID].X != 111 || byID[bobPage.ID].X != 20 {
		t.Fatalf("merged layout nodes = %#v", byID)
	}
	bobView = parseLayoutForTest(t, mustReadLayout(t, service, site.ID, bob))
	if bobView.Revision != 3 || len(bobView.Nodes) != 1 || bobView.Nodes[0].X != 20 {
		t.Fatalf("bob view after alice update = %#v", bobView)
	}

	invisibleReference := normalizeLayoutForTest(t, LayoutDocument{
		SchemaVersion: 1,
		Revision:      3,
		Nodes:         []LayoutNode{{PageID: bobPage.ID, X: 0, Y: 0, Width: 1, Height: 1, View: "expanded"}},
	})
	if _, err := service.Replace(ctx, site.ID, alice, invisibleReference); !errors.Is(err, ErrPageNotFound) {
		t.Fatalf("invisible page error = %v, want ErrPageNotFound", err)
	}

	if _, err := service.Replace(ctx, site.ID, alice, aliceReplacement); !errors.Is(err, ErrLayoutRevisionConflict) {
		t.Fatalf("stale layout error = %v", err)
	} else {
		var conflict *RevisionConflict
		if !errors.As(err, &conflict) || conflict.Current != 3 {
			t.Fatalf("stale conflict = %#v", err)
		}
	}
}

func TestLayoutServiceValidatesTreeConnectionsAndSiteVisibility(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	owner := vfs.Actor{Kind: vfs.ActorUser, ID: "owner"}
	outsider := vfs.Actor{Kind: vfs.ActorUser, ID: "outsider"}
	site, err := store.CreateSite(ctx, NewSite{
		ConnectionID:    701,
		Name:            "Tree editor",
		OwnerSubjectKey: owner.String(),
		VisibleTo:       []string{owner.String()},
	})
	if err != nil {
		t.Fatalf("CreateSite: %v", err)
	}
	parent := insertLayoutPage(t, store, site.ID, nil, "parent", 0, owner.String())
	child := insertLayoutPage(t, store, site.ID, &parent.ID, "child", 0, owner.String())
	other := insertLayoutPage(t, store, site.ID, nil, "other", 1, owner.String())
	service, err := NewLayoutService(store)
	if err != nil {
		t.Fatal(err)
	}

	valid := LayoutDocument{
		SchemaVersion: 1,
		Revision:      1,
		Nodes: []LayoutNode{
			{PageID: parent.ID, X: 0, Y: 0, Width: 1, Height: 1, View: "expanded"},
			{PageID: child.ID, X: 1, Y: 1, Width: 1, Height: 1, View: "expanded"},
		},
		Connections: []LayoutConnection{{FromID: parent.ID, ToID: child.ID}},
	}
	if revision, err := service.Replace(ctx, site.ID, owner, normalizeLayoutForTest(t, valid)); err != nil || revision != 2 {
		t.Fatalf("valid Replace = %d, %v", revision, err)
	}

	invalid := valid
	invalid.Revision = 2
	invalid.Nodes = append(invalid.Nodes, LayoutNode{PageID: other.ID, X: 2, Y: 2, Width: 1, Height: 1, View: "expanded"})
	invalid.Connections = []LayoutConnection{{FromID: other.ID, ToID: child.ID}}
	if _, err := service.Replace(ctx, site.ID, owner, normalizeLayoutForTest(t, invalid)); !errors.Is(err, ErrInvalidEditorXML) {
		t.Fatalf("invalid tree connection error = %v", err)
	}
	if _, err := service.Read(ctx, site.ID, outsider); !errors.Is(err, ErrSiteNotFound) {
		t.Fatalf("invisible site error = %v, want ErrSiteNotFound", err)
	}
}

func insertLayoutPage(t *testing.T, store *SQLiteStore, siteID int64, parentID *int64, key string, position int, audience string) *Page {
	t.Helper()
	page := testPage(siteID, parentID, key, key, position)
	page.VisibleTo = []string{audience}
	created, err := store.insertPage(context.Background(), page)
	if err != nil {
		t.Fatalf("insert page %s: %v", key, err)
	}
	return created
}

func normalizeLayoutForTest(t *testing.T, document LayoutDocument) []byte {
	t.Helper()
	data, err := NormalizeEditorLayout(document, LayoutLimits{})
	if err != nil {
		t.Fatalf("NormalizeEditorLayout: %v", err)
	}
	return data
}

func parseLayoutForTest(t *testing.T, data []byte) *LayoutDocument {
	t.Helper()
	document, err := ParseEditorLayout(data, LayoutLimits{})
	if err != nil {
		t.Fatalf("ParseEditorLayout: %v\n%s", err, data)
	}
	return document
}

func mustReadLayout(t *testing.T, service *LayoutService, siteID int64, actor vfs.Actor) []byte {
	t.Helper()
	data, err := service.Read(context.Background(), siteID, actor)
	if err != nil {
		t.Fatalf("Read layout: %v", err)
	}
	return data
}
