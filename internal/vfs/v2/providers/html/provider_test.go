package html

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	sdk "MyServer/pkg/vfs/providersdk"
	"MyServer/pkg/vfs/providertest"
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"reflect"
	"sort"
	"sync"
	"testing"
)

const (
	testScope       = "site-acme"
	testHTMLConn    = "site"
	testFixtureConn = "files"
)

var providerTestActor = vfs.Actor{Kind: vfs.ActorUser, ID: "17"}

type providerTestResolver struct {
	connections map[string]vfs.ProviderConnection
}

func (r providerTestResolver) ResolveExplicitScope(_ context.Context, key string) (*vfs.Scope, error) {
	if key != testScope {
		return nil, vfs.ErrNotFound
	}
	return &vfs.Scope{Key: key, Kind: "user", OwnerSubjectKey: common.SubjectKey(providerTestActor.String())}, nil
}

func (r providerTestResolver) ResolveDefaultScope(context.Context, vfs.Actor) (*vfs.Scope, error) {
	return r.ResolveExplicitScope(context.Background(), testScope)
}

func (r providerTestResolver) ResolveConnection(_ context.Context, scope vfs.Scope, provider, key string) (*vfs.ProviderConnection, error) {
	connection, ok := r.connections[provider+"@"+key]
	if !ok || scope.Key != testScope {
		return nil, vfs.ErrConnectionNotFound
	}
	return &connection, nil
}

type authorizationCall struct {
	actor  vfs.Actor
	action common.Action
	ref    common.ResourceRef
}

type recordingAuthorizer struct {
	mu     sync.Mutex
	calls  []authorizationCall
	denied map[string]struct{}
}

func (a *recordingAuthorizer) Can(_ context.Context, actor vfs.Actor, action common.Action, ref common.ResourceRef) (bool, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.calls = append(a.calls, authorizationCall{actor: actor, action: action, ref: ref})
	if _, denied := a.denied[string(action)+"\x00"+ref.ProviderKey+"\x00"+ref.Path]; denied {
		return false, nil
	}
	return true, nil
}

func (a *recordingAuthorizer) deny(action common.Action, provider, path string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.denied == nil {
		a.denied = make(map[string]struct{})
	}
	a.denied[string(action)+"\x00"+provider+"\x00"+path] = struct{}{}
}

func (a *recordingAuthorizer) snapshot() []authorizationCall {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]authorizationCall(nil), a.calls...)
}

func TestProviderIncrementThreeEndToEnd(t *testing.T) {
	frontend, store, authorizer := newProviderTestVFS(t)
	ctx := context.Background()

	if nodes, err := frontend.ReadDir(ctx, providerTestActor, htmlTestURI(t, "/")); err != nil || len(nodes) != 0 {
		t.Fatalf("uninitialized root listing = %+v, %v; want empty", nodes, err)
	}

	site := controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{providerTestActor.String()}, BaseURL: "https://acme.test"})
	if site.OwnerSubjectKey != providerTestActor.String() || site.TreeRevision != 1 || site.ModelRevision != 1 {
		t.Fatalf("initialize result = %+v", site)
	}
	second := controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{providerTestActor.String()}, BaseURL: "https://acme.test"})
	if second.CreatedAt != site.CreatedAt {
		t.Fatalf("initialize is not idempotent: first=%+v second=%+v", site, second)
	}

	root := controlResult[PublisherRootDocument](t, frontend, "/publishers", "register-root", RegisterRootInput{VisibleTo: []string{providerTestActor.String()}, RootURI: string(fixtureTestURI(t, "/content")), Purpose: "content"})
	if root.PublisherSubjectKey != providerTestActor.String() || root.Status != "active" {
		t.Fatalf("registered root = %+v", root)
	}
	rootAgain := controlResult[PublisherRootDocument](t, frontend, "/publishers", "register-root", RegisterRootInput{VisibleTo: []string{providerTestActor.String()}, RootURI: string(fixtureTestURI(t, "/content")), Purpose: "content"})
	if rootAgain.ID != root.ID {
		t.Fatalf("register-root duplicated root: first=%+v second=%+v", root, rootAgain)
	}

	create := controlResult[MutationDocument](t, frontend, "/pages", "create", CreatePageInput{VisibleTo: []string{providerTestActor.String()},
		ExpectedTreeRevision: 1,
		Position:             PositionInput{Last: true},
		PageKey:              "home",
		Slug:                 "home",
		Title:                "Home",
		Status:               "draft",
		BundleRootURI:        string(fixtureTestURI(t, "/content/home")),
		Types:                []string{"Landing", "page"},
		SearchTags:           []string{"Home", "demo"},
	})
	if create.PageID <= 0 || create.PageRevision != 1 || create.TreeRevision != 2 || create.ModelRevision != 2 {
		t.Fatalf("create result = %+v", create)
	}

	page := readJSONDocument[PageDocument](t, frontend, "/pages/home/info.json")
	if page.PageKey != "home" || page.BundleRootURI != string(fixtureTestURI(t, "/content/home")) || !reflect.DeepEqual(page.Types, []string{"landing", "page"}) {
		t.Fatalf("page document = %+v", page)
	}
	tree := readJSONDocument[TreeDocument](t, frontend, "/tree.json")
	if tree.TreeRevision != 2 || len(tree.Pages) != 1 || tree.Pages[0].PageKey != "home" {
		t.Fatalf("tree document = %+v", tree)
	}
	model := readEditorModelForActor(t, frontend, providerTestActor)
	if model.TreeRevision != 2 || model.ModelRevision != 2 || len(model.Nodes.Pages) != 1 || model.Nodes.Pages[0].Key != "home" {
		t.Fatalf("editor model = %+v", model)
	}
	initialLayout := parseLayoutForTest(t, readDocumentForActor(t, frontend, providerTestActor, "/editor/layout.xml"))
	if initialLayout.Revision != 1 || len(initialLayout.Nodes) != 0 {
		t.Fatalf("initial editor layout = %#v", initialLayout)
	}
	layoutWrite := normalizeLayoutForTest(t, LayoutDocument{
		SchemaVersion: 1,
		Revision:      1,
		Nodes:         []LayoutNode{{PageID: create.PageID, X: 120, Y: 80, Width: 240, Height: 120, View: "expanded"}},
	})
	if err := replaceDocumentForActor(t, frontend, providerTestActor, "/editor/layout.xml", layoutWrite); err != nil {
		t.Fatalf("replace layout: %v", err)
	}
	savedLayout := parseLayoutForTest(t, readDocumentForActor(t, frontend, providerTestActor, "/editor/layout.xml"))
	if savedLayout.Revision != 2 || len(savedLayout.Nodes) != 1 || savedLayout.Nodes[0].PageID != create.PageID {
		t.Fatalf("saved editor layout = %#v", savedLayout)
	}
	if err := replaceDocumentForActor(t, frontend, providerTestActor, "/editor/layout.xml", layoutWrite); !vfs.IsKind(err, vfs.KindConflict) {
		t.Fatalf("stale layout error = %v, want conflict", err)
	} else {
		code, details, ok := vfs.PublicDetailsOf(err)
		if !ok || code != "layout_revision_conflict" || details["current_revision"] != int64(2) {
			t.Fatalf("layout conflict = code %q details %+v found=%v", code, details, ok)
		}
	}
	if err := replaceDocumentForActor(t, frontend, providerTestActor, "/editor/layout.xml", []byte(`<site-layout schema-version="1" layout-revision="2"><unknown/></site-layout>`)); !vfs.IsKind(err, vfs.KindInvalidArgument) {
		t.Fatalf("invalid layout error = %v, want invalid argument", err)
	}
	if err := replaceDocumentForActor(t, frontend, providerTestActor, "/editor/layout.xml", bytes.Repeat([]byte("x"), defaultLayoutLimits.MaxBytes+1)); !vfs.IsKind(err, vfs.KindResourceExhausted) {
		t.Fatalf("oversized layout error = %v, want resource exhausted", err)
	}
	if _, err := frontend.OpenFile(ctx, providerTestActor, htmlTestURI(t, "/editor/model.xml"), os.O_WRONLY|os.O_TRUNC); !vfs.IsKind(err, vfs.KindUnsupported) {
		t.Fatalf("model write error = %v, want unsupported", err)
	}

	newTitle := "Home updated"
	update := controlResult[MutationDocument](t, frontend, "/pages/home", "update", UpdatePageInput{ExpectedPageRevision: 1, Title: &newTitle})
	if update.PageRevision != 2 || update.ModelRevision != 3 {
		t.Fatalf("update result = %+v", update)
	}
	types := controlResult[MutationDocument](t, frontend, "/pages/home", "set-types", SetValuesInput{ExpectedPageRevision: 2, Values: []string{"article"}})
	if types.PageRevision != 3 {
		t.Fatalf("set-types result = %+v", types)
	}
	tags := controlResult[MutationDocument](t, frontend, "/pages/home", "set-search-tags", SetValuesInput{ExpectedPageRevision: 3, Values: []string{"updated"}})
	if tags.PageRevision != 4 {
		t.Fatalf("set-search-tags result = %+v", tags)
	}

	child := controlResult[MutationDocument](t, frontend, "/pages", "create", CreatePageInput{VisibleTo: []string{providerTestActor.String()},
		ExpectedTreeRevision: 2, ParentID: &create.PageID, Position: PositionInput{Last: true}, PageKey: "child", Slug: "child", Title: "Child", Status: "draft", BundleRootURI: string(fixtureTestURI(t, "/content/child")),
	})
	move := controlResult[MutationDocument](t, frontend, "/pages/child", "move", MovePageInput{ExpectedTreeRevision: 3, Position: PositionInput{Last: true}})
	if move.TreeRevision != 4 {
		t.Fatalf("move result = %+v", move)
	}
	deleted := controlResult[MutationDocument](t, frontend, "/pages/child", "delete", DeletePageInput{ExpectedPageRevision: child.PageRevision, ExpectedTreeRevision: 4, Mode: DeleteReject})
	if deleted.TreeRevision != 5 {
		t.Fatalf("delete result = %+v", deleted)
	}

	stored, err := store.SiteByConnection(ctx, 101)
	if err != nil || stored.TreeRevision != 5 {
		t.Fatalf("stored site = %+v, %v", stored, err)
	}
	assertTargetAuthorization(t, authorizer.snapshot(), providerTestActor, "/content", "/content/home", "/content/home/content.md", "/content/home/style.css", "/content/home/script.js")

	harness, err := providertest.New(ctx, Factory(store), providertest.Options{
		Connection: vfs.ProviderConnection{ID: 101, ScopeKey: testScope, ProviderKey: ProviderKey, ConnectionKey: testHTMLConn, Config: []byte("{}"), ConfigVersion: 1, Status: "active", Ready: true},
		Actor:      providerTestActor,
	})
	if err != nil {
		t.Fatal(err)
	}
	defer harness.Close()
	providertest.CheckTree(t, ctx, harness, providertest.CheckOptions{Expected: []string{"/site.json", "/tree.json", "/editor/model.xml", "/editor/layout.xml", "/publishers/1/info.json", "/pages/home/info.json"}})
}

func TestProviderUpdatesSiteSettingsWithOptimisticRevision(t *testing.T) {
	frontend, _, _ := newProviderTestVFS(t)
	site := controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{providerTestActor.String()}, BaseURL: "https://acme.test"})
	updated := controlResult[SiteDocument](t, frontend, "/", "update", UpdateSiteInput{ExpectedModelRevision: site.ModelRevision, Name: "Acme Docs", BaseURL: "https://docs.acme.test"})
	if updated.Name != "Acme Docs" || updated.BaseURL != "https://docs.acme.test" || updated.ModelRevision != site.ModelRevision+1 {
		t.Fatalf("updated site = %+v", updated)
	}
	_, err := control(t, frontend, "/", "update", UpdateSiteInput{ExpectedModelRevision: site.ModelRevision, Name: "Stale"})
	if !errors.Is(err, ErrSiteRevisionConflict) {
		t.Fatalf("stale site update error = %v, want site revision conflict", err)
	}
}

func TestProviderInstanceSupportsConcurrentActors(t *testing.T) {
	frontend, _, _ := newProviderTestVFS(t)
	controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{AudienceAll}})
	siteURI := htmlTestURI(t, "/site.json")

	var wait sync.WaitGroup
	errorsFound := make(chan error, 32)
	for i := 0; i < 32; i++ {
		actor := vfs.Actor{Kind: vfs.ActorUser, ID: fmt.Sprintf("reader-%d", i%2)}
		wait.Add(1)
		go func() {
			defer wait.Done()
			file, err := frontend.OpenFile(context.Background(), actor, siteURI, os.O_RDONLY)
			if err != nil {
				errorsFound <- err
				return
			}
			_, readErr := io.ReadAll(file)
			errorsFound <- errors.Join(readErr, file.Close())
		}()
	}
	wait.Wait()
	close(errorsFound)
	for err := range errorsFound {
		if err != nil {
			t.Fatalf("concurrent read: %v", err)
		}
	}
}

func TestProviderRejectsUnsafeCreateAndStrictJSON(t *testing.T) {
	frontend, store, _ := newProviderTestVFS(t)
	ctx := context.Background()
	controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{providerTestActor.String()}})
	_, err := control(t, frontend, "/publishers", "register-root", RegisterRootInput{VisibleTo: []string{providerTestActor.String()}, RootURI: "demo@files[other-scope]:///content", Purpose: "content"})
	if kind, ok := vfs.KindOf(err); !ok || kind != vfs.KindInvalidArgument {
		t.Fatalf("cross-scope root error = %v, kind=%q", err, kind)
	}
	_, err = control(t, frontend, "/publishers", "register-root", RegisterRootInput{VisibleTo: []string{providerTestActor.String()}, RootURI: string(fixtureTestURI(t, "/missing")), Purpose: "content"})
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("missing root error = %v", err)
	}
	controlResult[PublisherRootDocument](t, frontend, "/publishers", "register-root", RegisterRootInput{VisibleTo: []string{providerTestActor.String()}, RootURI: string(fixtureTestURI(t, "/content")), Purpose: "content"})

	tests := []struct {
		name  string
		input CreatePageInput
		kind  vfs.ErrorKind
	}{
		{"missing visibility", CreatePageInput{ExpectedTreeRevision: 1, Position: PositionInput{Last: true}, PageKey: "private", Slug: "private", Status: "draft", BundleRootURI: string(fixtureTestURI(t, "/content/home"))}, vfs.KindInvalidArgument},
		{"outside root", CreatePageInput{VisibleTo: []string{providerTestActor.String()}, ExpectedTreeRevision: 1, Position: PositionInput{Last: true}, PageKey: "outside", Slug: "outside", Status: "draft", BundleRootURI: string(fixtureTestURI(t, "/outside"))}, vfs.KindFailedPrecondition},
		{"file instead of bundle", CreatePageInput{VisibleTo: []string{providerTestActor.String()}, ExpectedTreeRevision: 1, Position: PositionInput{Last: true}, PageKey: "file", Slug: "file", Status: "draft", BundleRootURI: string(fixtureTestURI(t, "/content/home/content.md"))}, vfs.KindFailedPrecondition},
		{"incomplete bundle", CreatePageInput{VisibleTo: []string{providerTestActor.String()}, ExpectedTreeRevision: 1, Position: PositionInput{Last: true}, PageKey: "incomplete", Slug: "incomplete", Status: "draft", BundleRootURI: string(fixtureTestURI(t, "/content/incomplete"))}, vfs.KindFailedPrecondition},
		{"invalid page key", CreatePageInput{VisibleTo: []string{providerTestActor.String()}, ExpectedTreeRevision: 1, Position: PositionInput{Last: true}, PageKey: "bad/key", Slug: "bad", Status: "draft", BundleRootURI: string(fixtureTestURI(t, "/content/home"))}, vfs.KindInvalidArgument},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := control(t, frontend, "/pages", "create", test.input)
			if kind, ok := vfs.KindOf(err); !ok || kind != test.kind {
				t.Fatalf("create error = %v, kind=%q; want %q", err, kind, test.kind)
			}
		})
	}

	_, err = frontend.Control(ctx, providerTestActor, htmlTestURI(t, "/pages"), "create", []byte(`{"expected_tree_revision":1,"position":{"last":true},"page_key":"bad","slug":"bad","status":"draft","bundle_root_uri":"demo@files[site-acme]:///content/home","unknown":true}`))
	if kind, ok := vfs.KindOf(err); !ok || kind != vfs.KindInvalidArgument {
		t.Fatalf("unknown field error = %v, kind=%q", err, kind)
	}
	site, err := store.SiteByConnection(ctx, 101)
	if err != nil || site.TreeRevision != 1 {
		t.Fatalf("failed creates changed site = %+v, %v", site, err)
	}
	pages, err := store.ListPages(ctx, site.ID)
	if err != nil || len(pages) != 0 {
		t.Fatalf("failed creates persisted pages = %+v, %v", pages, err)
	}
}

func TestProviderRevisionConflictHasPublicDetails(t *testing.T) {
	frontend, _, _ := newProviderTestVFS(t)
	controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{providerTestActor.String()}})
	controlResult[PublisherRootDocument](t, frontend, "/publishers", "register-root", RegisterRootInput{VisibleTo: []string{providerTestActor.String()}, RootURI: string(fixtureTestURI(t, "/content")), Purpose: "content"})
	controlResult[MutationDocument](t, frontend, "/pages", "create", CreatePageInput{VisibleTo: []string{providerTestActor.String()}, ExpectedTreeRevision: 1, Position: PositionInput{Last: true}, PageKey: "home", Slug: "home", Status: "draft", BundleRootURI: string(fixtureTestURI(t, "/content/home"))})

	_, err := control(t, frontend, "/pages", "create", CreatePageInput{VisibleTo: []string{providerTestActor.String()}, ExpectedTreeRevision: 1, Position: PositionInput{Last: true}, PageKey: "stale", Slug: "stale", Status: "draft", BundleRootURI: string(fixtureTestURI(t, "/content/child"))})
	if kind, ok := vfs.KindOf(err); !ok || kind != vfs.KindConflict {
		t.Fatalf("conflict = %v, kind=%q", err, kind)
	}
	code, details, ok := vfs.PublicDetailsOf(err)
	if !ok || code != "tree_revision_conflict" || details["current_revision"] != int64(2) {
		t.Fatalf("public conflict = code %q details %+v found=%v", code, details, ok)
	}
}

func TestProviderVisibilityFiltersListsLookupsTreesAndKeepsACLAuthoritative(t *testing.T) {
	frontend, _, authorizer := newProviderTestVFS(t)
	owner := providerTestActor
	other := vfs.Actor{Kind: vfs.ActorUser, ID: "other"}
	guest := vfs.Actor{Kind: vfs.ActorGuest}
	controlForActor[SiteDocument](t, frontend, owner, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{AudienceAll}})
	root := controlForActor[PublisherRootDocument](t, frontend, owner, "/publishers", "register-root", RegisterRootInput{RootURI: string(fixtureTestURI(t, "/content")), Purpose: "content", VisibleTo: []string{AudienceAll}})

	revision := int64(1)
	create := func(key string, visibleTo []string) MutationDocument {
		result := controlForActor[MutationDocument](t, frontend, owner, "/pages", "create", CreatePageInput{
			ExpectedTreeRevision: revision, Position: PositionInput{Last: true}, PageKey: key, Slug: key, Status: "draft",
			BundleRootURI: string(fixtureTestURI(t, "/content/"+key)), VisibleTo: visibleTo,
		})
		revision = result.TreeRevision
		return result
	}
	home := create("home", []string{owner.String()})
	child := controlForActor[MutationDocument](t, frontend, owner, "/pages", "create", CreatePageInput{
		ExpectedTreeRevision: revision, ParentID: &home.PageID, Position: PositionInput{Last: true}, PageKey: "child", Slug: "child", Status: "draft",
		BundleRootURI: string(fixtureTestURI(t, "/content/child")), VisibleTo: []string{AudienceAll},
	})
	revision = child.TreeRevision
	create("public", []string{AudienceAll})
	create("guest", []string{AudienceGuest})
	hidden := create("hidden", []string{other.String()})

	assertPageNames(t, frontend, owner, "child", "home", "public")
	assertPageNames(t, frontend, guest, "guest", "public")
	assertPageNames(t, frontend, other, "hidden", "public")
	if _, err := frontend.Stat(context.Background(), owner, htmlTestURI(t, "/pages/hidden")); !errors.Is(err, vfs.ErrNotFound) {
		t.Fatalf("hidden direct lookup error = %v, want not found", err)
	}
	ownerTree := readJSONForActor[TreeDocument](t, frontend, owner, "/tree.json")
	if got := treePageKeys(ownerTree.Pages); !reflect.DeepEqual(got, []string{"child", "home", "public"}) {
		t.Fatalf("owner tree pages = %v", got)
	}
	if _, err := frontend.Stat(context.Background(), guest, htmlTestURI(t, "/pages/child")); !errors.Is(err, vfs.ErrNotFound) {
		t.Fatalf("child below hidden parent error = %v, want not found", err)
	}
	if got := editorModelPageKeys(t, readEditorModelForActor(t, frontend, owner)); !reflect.DeepEqual(got, []string{"child", "home", "public"}) {
		t.Fatalf("owner editor model pages = %v", got)
	}
	if got := editorModelPageKeys(t, readEditorModelForActor(t, frontend, guest)); !reflect.DeepEqual(got, []string{"guest", "public"}) {
		t.Fatalf("guest editor model pages = %v", got)
	}
	hiddenLayout := normalizeLayoutForTest(t, LayoutDocument{
		SchemaVersion: 1,
		Revision:      1,
		Nodes:         []LayoutNode{{PageID: hidden.PageID, X: 0, Y: 0, Width: 1, Height: 1, View: "expanded"}},
	})
	if err := replaceDocumentForActor(t, frontend, owner, "/editor/layout.xml", hiddenLayout); !vfs.IsKind(err, vfs.KindNotFound) {
		t.Fatalf("hidden layout page error = %v, want not found", err)
	}

	visibility := controlForActor[VisibilityDocument](t, frontend, owner, "/pages/home", "set-visibility", SetVisibilityInput{ExpectedVisibilityRevision: hidden.VisibilityRevision, VisibleTo: []string{AudienceAll}})
	if visibility.VisibilityRevision != hidden.VisibilityRevision+1 || !reflect.DeepEqual(visibility.VisibleTo, []string{AudienceAll}) {
		t.Fatalf("set visibility result = %+v", visibility)
	}
	assertPageNames(t, frontend, guest, "child", "guest", "home", "public")
	_, err := controlAs(t, frontend, owner, "/pages/home", "set-visibility", SetVisibilityInput{ExpectedVisibilityRevision: hidden.VisibilityRevision, VisibleTo: []string{owner.String()}})
	if !vfs.IsKind(err, vfs.KindConflict) {
		t.Fatalf("stale visibility error = %v, want conflict", err)
	}

	authorizer.deny(common.ActionRead, ProviderKey, "/pages/public")
	if _, err := frontend.Stat(context.Background(), owner, htmlTestURI(t, "/pages/public")); !errors.Is(err, vfs.ErrPermissionDenied) {
		t.Fatalf("ACL deny error = %v, want permission denied", err)
	}
	authorizer.deny(common.ActionRead, ProviderKey, "/editor/model.xml")
	if _, err := frontend.OpenFile(context.Background(), owner, htmlTestURI(t, "/editor/model.xml"), os.O_RDONLY); !errors.Is(err, vfs.ErrPermissionDenied) {
		t.Fatalf("editor model ACL deny error = %v, want permission denied", err)
	}
	publisherVisibility := controlForActor[VisibilityDocument](t, frontend, owner, fmt.Sprintf("/publishers/%d", root.ID), "set-visibility", SetVisibilityInput{
		ExpectedVisibilityRevision: visibility.VisibilityRevision, VisibleTo: []string{owner.String()},
	})
	publishers, err := frontend.ReadDir(context.Background(), guest, htmlTestURI(t, "/publishers"))
	if err != nil || len(publishers) != 0 {
		t.Fatalf("guest publishers = %+v, %v; want empty", publishers, err)
	}
	siteVisibility := controlForActor[VisibilityDocument](t, frontend, owner, "/", "set-visibility", SetVisibilityInput{
		ExpectedVisibilityRevision: publisherVisibility.VisibilityRevision, VisibleTo: []string{owner.String()},
	})
	if siteVisibility.VisibilityRevision != publisherVisibility.VisibilityRevision+1 {
		t.Fatalf("site visibility result = %+v", siteVisibility)
	}
	if _, err := frontend.Stat(context.Background(), guest, htmlTestURI(t, "/site.json")); !errors.Is(err, vfs.ErrNotFound) {
		t.Fatalf("hidden site error = %v, want not found", err)
	}
}

func TestProviderBlocksUseBoundVFSVisibilityAndRevisions(t *testing.T) {
	frontend, _, authorizer := newProviderTestVFS(t)
	owner := providerTestActor
	other := vfs.Actor{Kind: vfs.ActorUser, ID: "other"}
	controlForActor[SiteDocument](t, frontend, owner, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{AudienceAll}})
	controlForActor[PublisherRootDocument](t, frontend, owner, "/publishers", "register-root", RegisterRootInput{
		RootURI: string(fixtureTestURI(t, "/content")), Purpose: "content", VisibleTo: []string{AudienceAll},
	})

	for _, test := range []struct {
		name  string
		input CreateBlockInput
		kind  vfs.ErrorKind
	}{
		{"ui requires all contract files", CreateBlockInput{BlockKey: "incomplete", Name: "Incomplete", Type: "ui-component", BundleRootURI: string(fixtureTestURI(t, "/content/incomplete")), VisibleTo: []string{owner.String()}}, vfs.KindFailedPrecondition},
		{"content rejects css", CreateBlockInput{BlockKey: "styled", Name: "Styled", Type: "content", BundleRootURI: string(fixtureTestURI(t, "/content/block-ui")), VisibleTo: []string{owner.String()}}, vfs.KindFailedPrecondition},
		{"outside publisher root", CreateBlockInput{BlockKey: "outside", Name: "Outside", Type: "content", BundleRootURI: string(fixtureTestURI(t, "/outside")), VisibleTo: []string{owner.String()}}, vfs.KindFailedPrecondition},
		{"other scope", CreateBlockInput{BlockKey: "scope", Name: "Scope", Type: "content", BundleRootURI: "demo@files[other-scope]:///content/block-content", VisibleTo: []string{owner.String()}}, vfs.KindInvalidArgument},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := controlAs(t, frontend, owner, "/blocks", "create", test.input)
			if kind, ok := vfs.KindOf(err); !ok || kind != test.kind {
				t.Fatalf("create error = %v, kind=%q; want %q", err, kind, test.kind)
			}
		})
	}

	ui := controlForActor[BlockDocument](t, frontend, owner, "/blocks", "create", CreateBlockInput{
		BlockKey: "ui", Name: "UI", Type: "ui-component", BundleRootURI: string(fixtureTestURI(t, "/content/block-ui")), VisibleTo: []string{owner.String()},
	})
	hidden := controlForActor[BlockDocument](t, frontend, other, "/blocks", "create", CreateBlockInput{
		BlockKey: "private", Name: "Private", Type: "content", BundleRootURI: string(fixtureTestURI(t, "/content/block-content")), VisibleTo: []string{other.String()},
	})
	if ui.BundleRootURI != string(fixtureTestURI(t, "/content/block-ui")) || ui.PublisherSubjectKey != owner.String() {
		t.Fatalf("ui document = %+v", ui)
	}
	assertBlockNames(t, frontend, owner, "ui")
	assertBlockNames(t, frontend, other, "private")
	if _, err := frontend.Stat(context.Background(), owner, htmlTestURI(t, "/blocks/private")); !errors.Is(err, vfs.ErrNotFound) {
		t.Fatalf("hidden Block lookup = %v, want not found", err)
	}

	ownerTree := readJSONForActor[BlockTreeDocument](t, frontend, owner, "/blocks/tree.json")
	ownerTree.Folders = []BlockFolder{{Key: "components", Name: "Components", Blocks: []string{"ui"}}}
	ownerBytes, err := json.Marshal(ownerTree)
	if err != nil {
		t.Fatal(err)
	}
	if err := replaceDocumentForActor(t, frontend, owner, "/blocks/tree.json", ownerBytes); err != nil {
		t.Fatalf("owner tree replace: %v", err)
	}
	uiAfterMove := readJSONForActor[BlockDocument](t, frontend, owner, "/blocks/ui/meta.json")
	if uiAfterMove.Revision != ui.Revision || uiAfterMove.BundleRootURI != ui.BundleRootURI || !reflect.DeepEqual(uiAfterMove.VisibleTo, ui.VisibleTo) {
		t.Fatalf("tree move changed Block metadata: before=%+v after=%+v", ui, uiAfterMove)
	}

	otherTree := readJSONForActor[BlockTreeDocument](t, frontend, other, "/blocks/tree.json")
	if len(otherTree.Folders) != 0 {
		t.Fatalf("other filtered tree = %#v", otherTree)
	}
	otherTree.Folders = []BlockFolder{{Key: "private", Name: "Private", Blocks: []string{"private"}}}
	otherBytes, err := json.Marshal(otherTree)
	if err != nil {
		t.Fatal(err)
	}
	if err := replaceDocumentForActor(t, frontend, other, "/blocks/tree.json", otherBytes); err != nil {
		t.Fatalf("other tree replace: %v", err)
	}
	ownerTree = readJSONForActor[BlockTreeDocument](t, frontend, owner, "/blocks/tree.json")
	if len(ownerTree.Folders) != 1 || ownerTree.Folders[0].Blocks[0] != "ui" {
		t.Fatalf("owner tree lost its Block after other update: %#v", ownerTree)
	}
	if err := replaceDocumentForActor(t, frontend, owner, "/blocks/tree.json", ownerBytes); !vfs.IsKind(err, vfs.KindConflict) {
		t.Fatalf("stale tree replace = %v, want conflict", err)
	}

	updated := controlForActor[BlockDocument](t, frontend, owner, "/blocks/ui", "update", UpdateBlockInput{
		ExpectedBlockRevision: ui.Revision, Name: "UI updated", Type: "ui-component", BundleRootURI: ui.BundleRootURI,
	})
	if updated.Revision != ui.Revision+1 {
		t.Fatalf("updated block = %+v", updated)
	}
	_, err = controlAs(t, frontend, owner, "/blocks/ui", "update", UpdateBlockInput{
		ExpectedBlockRevision: ui.Revision, Name: "Stale", Type: "ui-component", BundleRootURI: ui.BundleRootURI,
	})
	if !vfs.IsKind(err, vfs.KindConflict) {
		t.Fatalf("stale block update = %v, want conflict", err)
	}
	if _, err := controlAs(t, frontend, owner, "/blocks/ui", "update", UpdateBlockInput{
		ExpectedBlockRevision: updated.Revision, Name: "Invalid", Type: "content", BundleRootURI: ui.BundleRootURI,
	}); !vfs.IsKind(err, vfs.KindFailedPrecondition) {
		t.Fatalf("type-specific bundle validation = %v, want failed precondition", err)
	}
	if _, err := frontend.Stat(context.Background(), owner, fixtureTestURI(t, "/content/block-ui")); err != nil {
		t.Fatalf("physical bundle before delete: %v", err)
	}
	if _, err := controlAs(t, frontend, owner, "/blocks/ui", "delete", DeleteBlockInput{ExpectedBlockRevision: ui.Revision}); !vfs.IsKind(err, vfs.KindConflict) {
		t.Fatalf("stale block delete = %v, want conflict", err)
	}
	if _, err := controlAs(t, frontend, owner, "/blocks/ui", "delete", DeleteBlockInput{ExpectedBlockRevision: updated.Revision}); err != nil {
		t.Fatalf("delete Block: %v", err)
	}
	if _, err := frontend.Stat(context.Background(), owner, fixtureTestURI(t, "/content/block-ui")); err != nil {
		t.Fatalf("delete removed physical bundle: %v", err)
	}
	assertBlockNames(t, frontend, owner)
	assertTargetAuthorization(t, authorizer.snapshot(), owner, "/content/block-ui", "/content/block-ui/content.md", "/content/block-ui/style.css", "/content/block-ui/script.js")
	_ = hidden
}

func newProviderTestVFS(t *testing.T) (vfs.VFSFrontend, *SQLiteStore, *recordingAuthorizer) {
	t.Helper()
	db := openTestDB(t)
	store, err := NewSQLiteStore(db)
	if err != nil {
		t.Fatal(err)
	}
	htmlConnection := vfs.ProviderConnection{ID: 101, ScopeKey: testScope, ProviderKey: ProviderKey, ConnectionKey: testHTMLConn, Config: []byte("{}"), ConfigVersion: 1, Status: "active", Ready: true}
	fixtureConnection := vfs.ProviderConnection{ID: 202, ScopeKey: testScope, ProviderKey: "demo", ConnectionKey: testFixtureConn, Config: []byte("{}"), ConfigVersion: 1, Status: "active", Ready: true}
	resolver := providerTestResolver{connections: map[string]vfs.ProviderConnection{ProviderKey + "@" + testHTMLConn: htmlConnection, "demo@" + testFixtureConn: fixtureConnection}}
	registry := vfs.NewProviderRegistry()
	registry.Register(ProviderKey, Factory(store))
	registry.Register("demo", func(context.Context, vfs.ProviderConnection) (vfs.FSProvider, error) {
		return fixtureProviderForTest(t), nil
	})
	pool, err := vfs.NewProviderPool(registry)
	if err != nil {
		t.Fatal(err)
	}
	authorizer := &recordingAuthorizer{}
	frontend, err := vfs.NewVFS(resolver, resolver, pool, authorizer, vfs.NewNoopResourceLifecycle())
	if err != nil {
		t.Fatal(err)
	}
	return frontend, store, authorizer
}

func fixtureProviderForTest(t *testing.T) vfs.FSProvider {
	t.Helper()
	tree := sdk.New()
	content := sdk.Directory(tree.Root(), "content")
	addFixtureBundle(content, "home")
	addFixtureBundle(content, "child")
	addFixtureBundle(content, "public")
	addFixtureBundle(content, "guest")
	addFixtureBundle(content, "hidden")
	addFixtureBundle(content, "block-ui")
	addFixtureContentBlock(content, "block-content")
	incomplete := sdk.Directory(content, "incomplete")
	sdk.Bytes(incomplete, ContentMarkdownName, fixtureBytes("incomplete"))
	sdk.Bytes(incomplete, StyleSheetName, fixtureBytes(""))
	addFixtureBundle(tree.Root(), "outside")
	provider, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	return provider
}

func addFixtureBundle(parent *sdk.Resource[sdk.Unit], name string) {
	bundle := sdk.Directory(parent, name)
	sdk.Bytes(bundle, ContentMarkdownName, fixtureBytes("# "+name+"\n<div>HTML is allowed</div>"))
	sdk.Bytes(bundle, StyleSheetName, fixtureBytes("."+name+" {}"))
	sdk.Bytes(bundle, ScriptName, fixtureBytes("export default {};"))
}

func addFixtureContentBlock(parent *sdk.Resource[sdk.Unit], name string) {
	bundle := sdk.Directory(parent, name)
	sdk.Bytes(bundle, ContentMarkdownName, fixtureBytes("# "+name))
}

func fixtureBytes(value string) func(context.Context, sdk.Request, sdk.Unit) ([]byte, error) {
	return func(context.Context, sdk.Request, sdk.Unit) ([]byte, error) { return []byte(value), nil }
}

func controlResult[T any](t *testing.T, frontend vfs.VFSFrontend, path, command string, input any) T {
	return controlForActor[T](t, frontend, providerTestActor, path, command, input)
}

func controlForActor[T any](t *testing.T, frontend vfs.VFSFrontend, actor vfs.Actor, path, command string, input any) T {
	t.Helper()
	data, err := controlAs(t, frontend, actor, path, command, input)
	if err != nil {
		t.Fatalf("Control(%s, %s): %v", path, command, err)
	}
	var result T
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("decode Control(%s, %s): %v; data=%s", path, command, err, data)
	}
	return result
}

func control(t *testing.T, frontend vfs.VFSFrontend, path, command string, input any) ([]byte, error) {
	return controlAs(t, frontend, providerTestActor, path, command, input)
}

func controlAs(t *testing.T, frontend vfs.VFSFrontend, actor vfs.Actor, path, command string, input any) ([]byte, error) {
	t.Helper()
	data, err := json.Marshal(input)
	if err != nil {
		t.Fatal(err)
	}
	return frontend.Control(context.Background(), actor, htmlTestURI(t, path), command, data)
}

func readJSONDocument[T any](t *testing.T, frontend vfs.VFSFrontend, path string) T {
	return readJSONForActor[T](t, frontend, providerTestActor, path)
}

func readJSONForActor[T any](t *testing.T, frontend vfs.VFSFrontend, actor vfs.Actor, path string) T {
	t.Helper()
	file, err := frontend.OpenFile(context.Background(), actor, htmlTestURI(t, path), os.O_RDONLY)
	if err != nil {
		t.Fatal(err)
	}
	data, readErr := io.ReadAll(file)
	closeErr := file.Close()
	if err := errors.Join(readErr, closeErr); err != nil {
		t.Fatal(err)
	}
	var result T
	if err := json.NewDecoder(bytes.NewReader(data)).Decode(&result); err != nil {
		t.Fatal(err)
	}
	return result
}

func readDocumentForActor(t *testing.T, frontend vfs.VFSFrontend, actor vfs.Actor, path string) []byte {
	t.Helper()
	file, err := frontend.OpenFile(context.Background(), actor, htmlTestURI(t, path), os.O_RDONLY)
	if err != nil {
		t.Fatal(err)
	}
	data, readErr := io.ReadAll(file)
	if err := errors.Join(readErr, file.Close()); err != nil {
		t.Fatal(err)
	}
	return data
}

func replaceDocumentForActor(t *testing.T, frontend vfs.VFSFrontend, actor vfs.Actor, path string, data []byte) error {
	t.Helper()
	file, err := frontend.OpenFile(context.Background(), actor, htmlTestURI(t, path), os.O_WRONLY|os.O_TRUNC)
	if err != nil {
		return err
	}
	_, writeErr := file.Write(data)
	return vfs.FinishWrite(file, writeErr)
}

func readEditorModelForActor(t *testing.T, frontend vfs.VFSFrontend, actor vfs.Actor) siteModelXML {
	t.Helper()
	data := readDocumentForActor(t, frontend, actor, "/editor/model.xml")
	var model siteModelXML
	if err := xml.Unmarshal(data, &model); err != nil {
		t.Fatalf("decode editor model: %v\n%s", err, data)
	}
	return model
}

func editorModelPageKeys(t *testing.T, model siteModelXML) []string {
	t.Helper()
	keys := make([]string, 0, len(model.Nodes.Pages))
	for _, page := range model.Nodes.Pages {
		keys = append(keys, page.Key)
	}
	sort.Strings(keys)
	return keys
}

func assertPageNames(t *testing.T, frontend vfs.VFSFrontend, actor vfs.Actor, want ...string) {
	t.Helper()
	nodes, err := frontend.ReadDir(context.Background(), actor, htmlTestURI(t, "/pages"))
	if err != nil {
		t.Fatal(err)
	}
	got := make([]string, 0, len(nodes))
	for _, node := range nodes {
		got = append(got, node.Name)
	}
	sort.Strings(got)
	sort.Strings(want)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("page names for %s = %v, want %v", actor.String(), got, want)
	}
}

func assertBlockNames(t *testing.T, frontend vfs.VFSFrontend, actor vfs.Actor, want ...string) {
	t.Helper()
	nodes, err := frontend.ReadDir(context.Background(), actor, htmlTestURI(t, "/blocks"))
	if err != nil {
		t.Fatal(err)
	}
	got := make([]string, 0, len(nodes))
	for _, node := range nodes {
		if node.Name != "tree.json" {
			got = append(got, node.Name)
		}
	}
	if len(want) == 0 {
		want = []string{}
	}
	sort.Strings(got)
	sort.Strings(want)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("block names for %s = %v, want %v", actor.String(), got, want)
	}
}

func treePageKeys(pages []TreePage) []string {
	out := make([]string, 0)
	var walk func([]TreePage)
	walk = func(items []TreePage) {
		for _, page := range items {
			out = append(out, page.PageKey)
			walk(page.Children)
		}
	}
	walk(pages)
	sort.Strings(out)
	return out
}

func htmlTestURI(t *testing.T, resourcePath string) common.CanonURI {
	t.Helper()
	uri, err := (common.ResourceAddress{ProviderKey: ProviderKey, ConnectionKey: testHTMLConn, ScopeKey: testScope, Path: resourcePath}).URI()
	if err != nil {
		t.Fatal(err)
	}
	return uri
}

func fixtureTestURI(t *testing.T, resourcePath string) common.CanonURI {
	t.Helper()
	uri, err := (common.ResourceAddress{ProviderKey: "demo", ConnectionKey: testFixtureConn, ScopeKey: testScope, Path: resourcePath}).URI()
	if err != nil {
		t.Fatal(err)
	}
	return uri
}

func assertTargetAuthorization(t *testing.T, calls []authorizationCall, actor vfs.Actor, paths ...string) {
	t.Helper()
	found := make([]string, 0)
	for _, call := range calls {
		if call.ref.ProviderKey == "demo" && call.action == common.ActionRead {
			if call.actor != actor {
				continue
			}
			found = append(found, call.ref.Path)
		}
	}
	sort.Strings(found)
	for _, expected := range paths {
		present := false
		for _, actual := range found {
			if actual == expected {
				present = true
				break
			}
		}
		if !present {
			t.Fatalf("missing target authorization for %s; calls=%v", expected, found)
		}
	}
}
