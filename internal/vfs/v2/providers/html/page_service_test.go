package html

import (
	"MyServer/internal/common"
	"context"
	"errors"
	"reflect"
	"testing"
)

func TestPageServiceCreateUsesAnchorsAndTreeRevision(t *testing.T) {
	store, service, site := newPageServiceTest(t)
	ctx := context.Background()

	a := createPage(t, service, site.ID, 1, nil, PositionAnchor{Last: true}, "a", "a")
	c := createPage(t, service, site.ID, 2, nil, PositionAnchor{Last: true}, "c", "c")
	createPage(t, service, site.ID, 3, nil, PositionAnchor{BeforeID: &c.PageID}, "b", "b")
	first := createPage(t, service, site.ID, 4, nil, PositionAnchor{First: true}, "first", "first")
	after := createPage(t, service, site.ID, 5, nil, PositionAnchor{AfterID: &a.PageID}, "after-a", "after-a")

	if got, want := pageKeysForParent(t, store, site.ID, nil), []string{"first", "a", "after-a", "b", "c"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("root order = %#v, want %#v", got, want)
	}
	if first.TreeRevision != 5 || after.TreeRevision != 6 || after.ModelRevision != 6 {
		t.Fatalf("unexpected revisions: first=%+v after=%+v", first, after)
	}

	_, err := service.CreatePage(ctx, createRequest(site.ID, 1, nil, PositionAnchor{Last: true}, "stale", "stale"))
	var conflict *RevisionConflict
	if !errors.Is(err, ErrTreeRevisionConflict) || !errors.As(err, &conflict) || conflict.Current != 6 {
		t.Fatalf("stale create error = %v, conflict=%+v", err, conflict)
	}
	if _, err := store.PageByKey(ctx, site.ID, "stale"); !errors.Is(err, ErrPageNotFound) {
		t.Fatalf("stale create persisted page: %v", err)
	}
}

func TestPageServiceUpdateUsesPageRevisionAndRollsBackConstraintFailure(t *testing.T) {
	store, service, site := newPageServiceTest(t)
	first := createPage(t, service, site.ID, 1, nil, PositionAnchor{Last: true}, "first", "first")
	second := createPage(t, service, site.ID, 2, nil, PositionAnchor{Last: true}, "second", "second")

	title := "First updated"
	update, err := service.UpdatePage(context.Background(), UpdatePageRequest{
		SiteID:               site.ID,
		PageID:               first.PageID,
		ExpectedPageRevision: 1,
		Title:                &title,
	})
	if err != nil {
		t.Fatalf("UpdatePage(title): %v", err)
	}
	if update.PageRevision != 2 || update.ModelRevision != 4 {
		t.Fatalf("title update result = %+v, want page=2 model=4", update)
	}
	currentSite, err := store.SiteByID(context.Background(), site.ID)
	if err != nil {
		t.Fatalf("SiteByID: %v", err)
	}
	if currentSite.TreeRevision != 3 {
		t.Fatalf("tree revision changed on functional update: %d", currentSite.TreeRevision)
	}

	_, err = service.UpdatePage(context.Background(), UpdatePageRequest{
		SiteID:               site.ID,
		PageID:               first.PageID,
		ExpectedPageRevision: 1,
		Note:                 stringPointer("stale"),
	})
	var conflict *RevisionConflict
	if !errors.Is(err, ErrPageRevisionConflict) || !errors.As(err, &conflict) || conflict.Current != 2 {
		t.Fatalf("stale update error = %v, conflict=%+v", err, conflict)
	}
	newSlug := "first-new"
	slugUpdate, err := service.UpdatePage(context.Background(), UpdatePageRequest{
		SiteID:               site.ID,
		PageID:               first.PageID,
		ExpectedPageRevision: 2,
		Slug:                 &newSlug,
	})
	if err != nil {
		t.Fatalf("UpdatePage(slug): %v", err)
	}
	if slugUpdate.PageRevision != 3 || slugUpdate.ModelRevision != 4 {
		t.Fatalf("slug update result = %+v, want page=3 model=4", slugUpdate)
	}

	duplicateSlug := "first-new"
	newDescription := "must roll back"
	_, err = service.UpdatePage(context.Background(), UpdatePageRequest{
		SiteID:               site.ID,
		PageID:               second.PageID,
		ExpectedPageRevision: 1,
		Slug:                 &duplicateSlug,
		Description:          &newDescription,
	})
	if !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("duplicate slug error = %v, want ErrAlreadyExists", err)
	}
	after, err := store.PageByID(context.Background(), site.ID, second.PageID)
	if err != nil {
		t.Fatalf("PageByID(second): %v", err)
	}
	if after.Revision != 1 || after.Description != "" || after.Slug != "second" {
		t.Fatalf("failed update was not rolled back: %+v", after)
	}
	afterSite, err := store.SiteByID(context.Background(), site.ID)
	if err != nil {
		t.Fatalf("SiteByID(after failure): %v", err)
	}
	if afterSite.ModelRevision != 4 {
		t.Fatalf("model revision after rollback = %d, want 4", afterSite.ModelRevision)
	}
}

func TestPageServiceMoveNormalizesGroupsAndRejectsCycles(t *testing.T) {
	store, service, site := newPageServiceTest(t)
	a := createPage(t, service, site.ID, 1, nil, PositionAnchor{Last: true}, "a", "a")
	b := createPage(t, service, site.ID, 2, nil, PositionAnchor{Last: true}, "b", "b")
	c := createPage(t, service, site.ID, 3, &a.PageID, PositionAnchor{Last: true}, "c", "c")
	d := createPage(t, service, site.ID, 4, &a.PageID, PositionAnchor{Last: true}, "d", "d")

	_, err := service.MovePage(context.Background(), MovePageRequest{
		SiteID:               site.ID,
		PageID:               a.PageID,
		ParentID:             &c.PageID,
		Anchor:               PositionAnchor{Last: true},
		ExpectedTreeRevision: 5,
	})
	if !errors.Is(err, ErrCycleDetected) {
		t.Fatalf("cycle move error = %v, want ErrCycleDetected", err)
	}
	currentSite, err := store.SiteByID(context.Background(), site.ID)
	if err != nil {
		t.Fatalf("SiteByID: %v", err)
	}
	if currentSite.TreeRevision != 5 {
		t.Fatalf("cycle failure changed tree revision to %d", currentSite.TreeRevision)
	}

	move, err := service.MovePage(context.Background(), MovePageRequest{
		SiteID:               site.ID,
		PageID:               c.PageID,
		ParentID:             nil,
		Anchor:               PositionAnchor{BeforeID: &b.PageID},
		ExpectedTreeRevision: 5,
	})
	if err != nil {
		t.Fatalf("MovePage(c to root): %v", err)
	}
	if move.TreeRevision != 6 || move.ModelRevision != 6 || move.PageRevision != 1 {
		t.Fatalf("move result = %+v", move)
	}
	if got, want := pageKeysForParent(t, store, site.ID, nil), []string{"a", "c", "b"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("root order = %#v, want %#v", got, want)
	}
	if got, want := pageKeysForParent(t, store, site.ID, &a.PageID), []string{"d"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("a children = %#v, want %#v", got, want)
	}
	move, err = service.MovePage(context.Background(), MovePageRequest{
		SiteID:               site.ID,
		PageID:               b.PageID,
		ParentID:             nil,
		Anchor:               PositionAnchor{First: true},
		ExpectedTreeRevision: 6,
	})
	if err != nil {
		t.Fatalf("MovePage(b first): %v", err)
	}
	if move.TreeRevision != 7 {
		t.Fatalf("same-parent move revision = %d, want 7", move.TreeRevision)
	}
	if got, want := pageKeysForParent(t, store, site.ID, nil), []string{"b", "a", "c"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("same-parent root order = %#v, want %#v", got, want)
	}

	other := createTestSite(t, store, 202, "Other")
	foreignParent := createPage(t, service, other.ID, 1, nil, PositionAnchor{Last: true}, "foreign", "foreign")
	_, err = service.MovePage(context.Background(), MovePageRequest{
		SiteID:               site.ID,
		PageID:               d.PageID,
		ParentID:             &foreignParent.PageID,
		Anchor:               PositionAnchor{Last: true},
		ExpectedTreeRevision: 7,
	})
	if !errors.Is(err, ErrParentNotFound) {
		t.Fatalf("foreign parent error = %v, want ErrParentNotFound", err)
	}
}

func TestPageServiceDeleteRejectAndPromoteChildren(t *testing.T) {
	store, service, site := newPageServiceTest(t)
	a := createPage(t, service, site.ID, 1, nil, PositionAnchor{Last: true}, "a", "a")
	x := createPage(t, service, site.ID, 2, nil, PositionAnchor{Last: true}, "x", "x")
	b := createPage(t, service, site.ID, 3, nil, PositionAnchor{Last: true}, "b", "b")
	x1 := createPage(t, service, site.ID, 4, &x.PageID, PositionAnchor{Last: true}, "x1", "x1")
	x2 := createPage(t, service, site.ID, 5, &x.PageID, PositionAnchor{Last: true}, "x2", "x2")

	_, err := service.DeletePage(context.Background(), DeletePageRequest{
		SiteID:               site.ID,
		PageID:               x.PageID,
		ExpectedPageRevision: 1,
		ExpectedTreeRevision: 6,
		Mode:                 DeleteReject,
	})
	if !errors.Is(err, ErrResourceInUse) {
		t.Fatalf("reject delete error = %v, want ErrResourceInUse", err)
	}
	currentSite, err := store.SiteByID(context.Background(), site.ID)
	if err != nil {
		t.Fatalf("SiteByID: %v", err)
	}
	if currentSite.TreeRevision != 6 {
		t.Fatalf("rejected delete changed tree revision to %d", currentSite.TreeRevision)
	}

	deleted, err := service.DeletePage(context.Background(), DeletePageRequest{
		SiteID:               site.ID,
		PageID:               x.PageID,
		ExpectedPageRevision: 1,
		ExpectedTreeRevision: 6,
		Mode:                 DeletePromoteChildren,
	})
	if err != nil {
		t.Fatalf("DeletePage(promote): %v", err)
	}
	if deleted.TreeRevision != 7 || deleted.ModelRevision != 7 {
		t.Fatalf("promote result = %+v", deleted)
	}
	if got, want := pageKeysForParent(t, store, site.ID, nil), []string{"a", "x1", "x2", "b"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("promoted root order = %#v, want %#v", got, want)
	}
	for _, pageID := range []int64{x1.PageID, x2.PageID} {
		page, err := store.PageByID(context.Background(), site.ID, pageID)
		if err != nil {
			t.Fatalf("PageByID(promoted %d): %v", pageID, err)
		}
		if page.ParentID != nil {
			t.Fatalf("promoted page %d parent = %v, want root", pageID, page.ParentID)
		}
	}
	if _, err := store.PageByID(context.Background(), site.ID, x.PageID); !errors.Is(err, ErrPageNotFound) {
		t.Fatalf("deleted page lookup error = %v", err)
	}
	_ = a
	_ = b
}

func TestPageServiceDeleteCascadeAndNeverReusesPageID(t *testing.T) {
	store, service, site := newPageServiceTest(t)
	root := createPage(t, service, site.ID, 1, nil, PositionAnchor{Last: true}, "root", "root")
	child := createPage(t, service, site.ID, 2, &root.PageID, PositionAnchor{Last: true}, "child", "child")
	grandchild := createPage(t, service, site.ID, 3, &child.PageID, PositionAnchor{Last: true}, "grandchild", "grandchild")
	keep := createPage(t, service, site.ID, 4, nil, PositionAnchor{Last: true}, "keep", "keep")

	_, err := service.DeletePage(context.Background(), DeletePageRequest{
		SiteID:               site.ID,
		PageID:               root.PageID,
		ExpectedPageRevision: 1,
		ExpectedTreeRevision: 5,
		Mode:                 DeleteCascade,
	})
	if err != nil {
		t.Fatalf("DeletePage(cascade): %v", err)
	}
	for _, id := range []int64{root.PageID, child.PageID, grandchild.PageID} {
		if _, err := store.PageByID(context.Background(), site.ID, id); !errors.Is(err, ErrPageNotFound) {
			t.Fatalf("cascade page %d lookup error = %v", id, err)
		}
	}
	if got, want := pageKeysForParent(t, store, site.ID, nil), []string{"keep"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("remaining roots = %#v, want %#v", got, want)
	}
	created := createPage(t, service, site.ID, 6, nil, PositionAnchor{Last: true}, "new", "new")
	if created.PageID <= keep.PageID {
		t.Fatalf("new page ID %d reused deleted range ending before %d", created.PageID, keep.PageID)
	}
}

func TestPageServiceSetsTypesAndTagsAtomically(t *testing.T) {
	store, service, site := newPageServiceTest(t)
	page := createPage(t, service, site.ID, 1, nil, PositionAnchor{Last: true}, "page", "page")

	typesResult, err := service.SetTypes(context.Background(), SetPageValuesRequest{
		SiteID:               site.ID,
		PageID:               page.PageID,
		ExpectedPageRevision: 1,
		Values:               []string{" Landing ", "landing", "ARTICLE"},
	})
	if err != nil {
		t.Fatalf("SetTypes: %v", err)
	}
	if typesResult.PageRevision != 2 || typesResult.ModelRevision != 2 {
		t.Fatalf("SetTypes result = %+v", typesResult)
	}
	if got, want := mustPageTypes(t, store, site.ID, page.PageID), []string{"article", "landing"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("types = %#v, want %#v", got, want)
	}

	_, err = service.SetTypes(context.Background(), SetPageValuesRequest{
		SiteID:               site.ID,
		PageID:               page.PageID,
		ExpectedPageRevision: 1,
		Values:               []string{"stale"},
	})
	var conflict *RevisionConflict
	if !errors.Is(err, ErrPageRevisionConflict) || !errors.As(err, &conflict) || conflict.Current != 2 {
		t.Fatalf("stale SetTypes error = %v, conflict=%+v", err, conflict)
	}
	if got, want := mustPageTypes(t, store, site.ID, page.PageID), []string{"article", "landing"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("stale SetTypes changed values: %#v", got)
	}

	tagsResult, err := service.SetSearchTags(context.Background(), SetPageValuesRequest{
		SiteID:               site.ID,
		PageID:               page.PageID,
		ExpectedPageRevision: 2,
		Values:               []string{" News ", "News", "news"},
	})
	if err != nil {
		t.Fatalf("SetSearchTags: %v", err)
	}
	if tagsResult.PageRevision != 3 {
		t.Fatalf("tag revision = %d, want 3", tagsResult.PageRevision)
	}
	tags, err := store.PageSearchTags(context.Background(), site.ID, page.PageID)
	if err != nil {
		t.Fatalf("PageSearchTags: %v", err)
	}
	if want := []string{"News", "news"}; !reflect.DeepEqual(tags, want) {
		t.Fatalf("tags = %#v, want %#v", tags, want)
	}
}

func TestPageServiceRejectsInvalidAnchorsAndDeleteModesWithoutMutation(t *testing.T) {
	store, service, site := newPageServiceTest(t)
	page := createPage(t, service, site.ID, 1, nil, PositionAnchor{Last: true}, "page", "page")

	_, err := service.CreatePage(context.Background(), createRequest(site.ID, 2, nil, PositionAnchor{}, "bad", "bad"))
	if !errors.Is(err, ErrInvalidPosition) {
		t.Fatalf("missing anchor error = %v", err)
	}
	_, err = service.MovePage(context.Background(), MovePageRequest{
		SiteID:               site.ID,
		PageID:               page.PageID,
		Anchor:               PositionAnchor{First: true, Last: true},
		ExpectedTreeRevision: 2,
	})
	if !errors.Is(err, ErrInvalidPosition) {
		t.Fatalf("multiple anchor error = %v", err)
	}
	_, err = service.DeletePage(context.Background(), DeletePageRequest{
		SiteID:               site.ID,
		PageID:               page.PageID,
		ExpectedPageRevision: 1,
		ExpectedTreeRevision: 2,
		Mode:                 "unknown",
	})
	if !errors.Is(err, ErrInvalidDeleteMode) {
		t.Fatalf("invalid mode error = %v", err)
	}
	current, err := store.SiteByID(context.Background(), site.ID)
	if err != nil {
		t.Fatalf("SiteByID: %v", err)
	}
	if current.TreeRevision != 2 || current.ModelRevision != 2 {
		t.Fatalf("invalid operations changed revisions: %+v", current)
	}
}

func newPageServiceTest(t *testing.T) (*SQLiteStore, *PageService, *Site) {
	t.Helper()
	store := openTestStore(t)
	service, err := NewPageService(store)
	if err != nil {
		t.Fatalf("NewPageService: %v", err)
	}
	site := createTestSite(t, store, 101, "Alice")
	return store, service, site
}

func createPage(t *testing.T, service *PageService, siteID, treeRevision int64, parentID *int64, anchor PositionAnchor, key, slug string) *TreeMutationResult {
	t.Helper()
	result, err := service.CreatePage(context.Background(), createRequest(siteID, treeRevision, parentID, anchor, key, slug))
	if err != nil {
		t.Fatalf("CreatePage(%s): %v", key, err)
	}
	return result
}

func createRequest(siteID, treeRevision int64, parentID *int64, anchor PositionAnchor, key, slug string) CreatePageRequest {
	return CreatePageRequest{
		SiteID:               siteID,
		ExpectedTreeRevision: treeRevision,
		ParentID:             parentID,
		Anchor:               anchor,
		PageKey:              key,
		Slug:                 slug,
		Title:                key,
		Status:               "draft",
		PublisherSubjectKey:  "user:test",
		BundleRootURI:        mustCanonicalURI("local@test[site]:///bundles/" + key),
		VisibleTo:            []string{"user:test"},
	}
}

func pageKeysForParent(t *testing.T, store *SQLiteStore, siteID int64, parentID *int64) []string {
	t.Helper()
	query := `SELECT page_key FROM html_pages WHERE site_id = ? AND parent_id IS NULL ORDER BY position`
	args := []any{siteID}
	if parentID != nil {
		query = `SELECT page_key FROM html_pages WHERE site_id = ? AND parent_id = ? ORDER BY position`
		args = append(args, *parentID)
	}
	rows, err := store.db.Query(query, args...)
	if err != nil {
		t.Fatalf("query page keys: %v", err)
	}
	defer rows.Close()
	keys := make([]string, 0)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			t.Fatalf("scan page key: %v", err)
		}
		keys = append(keys, key)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("page key rows: %v", err)
	}
	return keys
}

func mustPageTypes(t *testing.T, store *SQLiteStore, siteID, pageID int64) []string {
	t.Helper()
	values, err := store.PageTypes(context.Background(), siteID, pageID)
	if err != nil {
		t.Fatalf("PageTypes: %v", err)
	}
	return values
}

func mustCanonicalURI(raw string) common.CanonURI {
	uri, err := common.CastURI(raw)
	if err != nil {
		panic(err)
	}
	return uri
}

func stringPointer(value string) *string { return &value }
