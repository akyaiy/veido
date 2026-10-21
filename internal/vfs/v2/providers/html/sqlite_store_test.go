package html

import (
	"MyServer/internal/common"
	"context"
	"database/sql"
	"errors"
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestInitDBIsIdempotentAndRecordsOwnedSchemaVersion(t *testing.T) {
	db := openTestDB(t)
	if err := InitDB(db); err != nil {
		t.Fatalf("second InitDB() error = %v", err)
	}

	var versions int
	var version int
	if err := db.QueryRow(`SELECT COUNT(*), MAX(version) FROM html_schema_migrations`).Scan(&versions, &version); err != nil {
		t.Fatalf("read migrations: %v", err)
	}
	if versions != schemaVersion || version != schemaVersion {
		t.Fatalf("migrations = count %d version %d, want %d/%d", versions, version, schemaVersion, schemaVersion)
	}
}

func TestSchemaV2BackfillsBundleRootFromLegacySourceURI(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	defer db.Close()
	if _, err := db.Exec(migrationTableSQL); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(schemaV1SQL); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO html_schema_migrations(version) VALUES (1)`); err != nil {
		t.Fatal(err)
	}
	result, err := db.Exec(`INSERT INTO html_sites(connection_id, name, owner_subject_key) VALUES (17, 'Legacy', 'user:17')`)
	if err != nil {
		t.Fatal(err)
	}
	siteID, err := result.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}
	legacySource := "local@alice[site]:///website/pages/home.html"
	if _, err := db.Exec(`INSERT INTO html_pages(site_id, page_key, slug, title, status, position, publisher_subject_key, source_uri) VALUES (?, 'home', 'home', 'Home', 'draft', 0, 'user:17', ?)`, siteID, legacySource); err != nil {
		t.Fatal(err)
	}

	if err := InitDB(db); err != nil {
		t.Fatal(err)
	}
	store, err := NewSQLiteStore(db)
	if err != nil {
		t.Fatal(err)
	}
	page, err := store.PageByKey(context.Background(), siteID, "home")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := string(page.BundleRootURI), "local@alice[site]:///website/pages/home"; got != want {
		t.Fatalf("BundleRootURI = %q, want %q", got, want)
	}
	var preservedSource string
	if err := db.QueryRow(`SELECT source_uri FROM html_pages WHERE id = ?`, page.ID).Scan(&preservedSource); err != nil {
		t.Fatal(err)
	}
	if preservedSource != legacySource {
		t.Fatalf("legacy source_uri = %q, want preserved %q", preservedSource, legacySource)
	}
	visibleTo, err := store.NodeAudiences(context.Background(), siteID, NodeKindPage, "home")
	if err != nil || !reflect.DeepEqual(visibleTo, []string{"user:17"}) {
		t.Fatalf("migrated visibility = %v, %v", visibleTo, err)
	}
	if _, err := db.Exec(`INSERT INTO html_pages(site_id, page_key, slug, title, status, position, publisher_subject_key, source_uri) VALUES (?, 'invalid', 'invalid', 'Invalid', 'draft', 1, 'user:17', ?)`, siteID, legacySource); err == nil {
		t.Fatal("schema v2 accepted an insert without bundle_root_uri")
	}
	if _, err := db.Exec(`UPDATE html_pages SET bundle_root_uri = '://' WHERE id = ?`, page.ID); err == nil {
		t.Fatal("schema v2 accepted the migration placeholder as a bundle root")
	}
}

func TestSQLiteStoreVisibilityRequiresExplicitAudienceAndUsesRevision(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	if _, err := store.CreateSite(ctx, NewSite{ConnectionID: 100, Name: "Invisible", OwnerSubjectKey: "user:test"}); !errors.Is(err, ErrInvalidAudience) {
		t.Fatalf("site without visibility error = %v", err)
	}
	site := createTestSite(t, store, 101, "Alice")
	if _, err := store.CreatePublisherRoot(ctx, NewPublisherRoot{
		SiteID: site.ID, PublisherSubjectKey: "user:test", RootURI: mustURI(t, "local@test[site]:///content"), Purpose: "content", Status: "active",
	}); !errors.Is(err, ErrInvalidAudience) {
		t.Fatalf("publisher root without visibility error = %v", err)
	}
	pageWithoutVisibility := testPage(site.ID, nil, "invisible", "invisible", 0)
	pageWithoutVisibility.VisibleTo = nil
	if _, err := store.insertPage(ctx, pageWithoutVisibility); !errors.Is(err, ErrInvalidAudience) {
		t.Fatalf("page without visibility error = %v", err)
	}
	page := insertTestPage(t, store, site.ID, nil, "home", "home", 0)

	visible, err := store.NodeVisible(ctx, site.ID, NodeKindPage, page.PageKey, []string{AudienceAll, "user:test"})
	if err != nil || !visible {
		t.Fatalf("owner visibility = %v, %v", visible, err)
	}
	visible, err = store.NodeVisible(ctx, site.ID, NodeKindPage, page.PageKey, []string{AudienceAll, "user:other"})
	if err != nil || visible {
		t.Fatalf("other visibility = %v, %v", visible, err)
	}

	revision, err := store.ReplaceNodeVisibility(ctx, site.ID, NodeKindPage, page.PageKey, site.VisibilityRevision+1, []string{AudienceGuest, AudienceAll, AudienceAll})
	if err != nil {
		t.Fatal(err)
	}
	if revision != site.VisibilityRevision+2 {
		t.Fatalf("visibility revision = %d", revision)
	}
	if got, err := store.NodeAudiences(ctx, site.ID, NodeKindPage, page.PageKey); err != nil || !reflect.DeepEqual(got, []string{AudienceAll, AudienceGuest}) {
		t.Fatalf("audiences = %v, %v", got, err)
	}
	retriedRevision, err := store.ReplaceNodeVisibility(ctx, site.ID, NodeKindPage, page.PageKey, revision-1, []string{AudienceAll, AudienceGuest})
	if err != nil || retriedRevision != revision {
		t.Fatalf("idempotent visibility retry = revision %d, %v; want %d", retriedRevision, err, revision)
	}
	if _, err := store.ReplaceNodeVisibility(ctx, site.ID, NodeKindPage, page.PageKey, revision-1, []string{"user:test"}); !errors.Is(err, ErrVisibilityConflict) {
		t.Fatalf("stale visibility error = %v", err)
	}
	if _, err := store.ReplaceNodeVisibility(ctx, site.ID, NodeKindPage, page.PageKey, revision, nil); !errors.Is(err, ErrInvalidAudience) {
		t.Fatalf("empty visibility error = %v", err)
	}
}

func TestMigratedBundleRoot(t *testing.T) {
	tests := map[string]string{
		"legacy html file": "local@alice[site]:///website/pages/home.html",
		"bundle content":   "local@alice[site]:///website/pages/home/content.md",
	}
	wants := map[string]string{
		"legacy html file": "local@alice[site]:///website/pages/home",
		"bundle content":   "local@alice[site]:///website/pages/home",
	}
	for name, raw := range tests {
		t.Run(name, func(t *testing.T) {
			root, err := migratedBundleRoot(mustURI(t, raw))
			if err != nil {
				t.Fatal(err)
			}
			if got := string(root); got != wants[name] {
				t.Fatalf("migratedBundleRoot() = %q, want %q", got, wants[name])
			}
		})
	}
}

func TestSQLiteStoreIsolatesConnectionsAndPageKeys(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	alice := createTestSite(t, store, 101, "Alice")
	bob := createTestSite(t, store, 202, "Bob")

	alicePage := insertTestPage(t, store, alice.ID, nil, "home", "home", 0)
	bobPage := insertTestPage(t, store, bob.ID, nil, "home", "home", 0)
	if alicePage.ID == bobPage.ID {
		t.Fatalf("page IDs unexpectedly reused: %d", alicePage.ID)
	}

	gotAlice, err := store.PageByKey(ctx, alice.ID, "home")
	if err != nil {
		t.Fatalf("PageByKey(alice): %v", err)
	}
	gotBob, err := store.PageByKey(ctx, bob.ID, "home")
	if err != nil {
		t.Fatalf("PageByKey(bob): %v", err)
	}
	if gotAlice.SiteID != alice.ID || gotBob.SiteID != bob.ID {
		t.Fatalf("pages crossed sites: alice=%+v bob=%+v", gotAlice, gotBob)
	}
	if _, err := store.PageByID(ctx, alice.ID, bobPage.ID); !errors.Is(err, ErrPageNotFound) {
		t.Fatalf("cross-site PageByID error = %v, want ErrPageNotFound", err)
	}
}

func TestSQLiteStoreRejectsCrossSiteParent(t *testing.T) {
	db := openTestDB(t)
	store, err := NewSQLiteStore(db)
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	alice := createTestSite(t, store, 101, "Alice")
	bob := createTestSite(t, store, 202, "Bob")
	parent := insertTestPage(t, store, alice.ID, nil, "parent", "parent", 0)
	// The trigger keeps this invariant even on a pooled connection where the
	// connection-local SQLite foreign_keys pragma was not enabled.
	if _, err := db.Exec(`PRAGMA foreign_keys = OFF`); err != nil {
		t.Fatalf("disable foreign keys: %v", err)
	}

	_, err = store.insertPage(context.Background(), NewPage{
		SiteID:              bob.ID,
		ParentID:            &parent.ID,
		PageKey:             "child",
		Slug:                "child",
		Title:               "Child",
		Status:              "draft",
		Position:            0,
		PublisherSubjectKey: "user:202",
		BundleRootURI:       mustURI(t, "local@bob[site]:///bundles/child"),
		VisibleTo:           []string{"user:202"},
	})
	if err == nil {
		t.Fatal("InsertPage accepted parent from another site")
	}
	if !errors.Is(err, ErrInvalidRecord) {
		t.Fatalf("cross-site parent error = %v, want ErrInvalidRecord", err)
	}
}

func TestSQLiteStoreEnforcesSiblingSlugAndPosition(t *testing.T) {
	store := openTestStore(t)
	site := createTestSite(t, store, 101, "Alice")
	parent := insertTestPage(t, store, site.ID, nil, "parent", "parent", 0)
	insertTestPage(t, store, site.ID, &parent.ID, "first", "same", 0)

	_, err := store.insertPage(context.Background(), testPage(site.ID, &parent.ID, "second", "same", 1))
	if !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("duplicate sibling slug error = %v, want ErrAlreadyExists", err)
	}
	_, err = store.insertPage(context.Background(), testPage(site.ID, &parent.ID, "third", "third", 0))
	if !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("duplicate sibling position error = %v, want ErrAlreadyExists", err)
	}
}

func TestSQLiteStoreEnforcesRootSlugAndConnectionUniqueness(t *testing.T) {
	store := openTestStore(t)
	site := createTestSite(t, store, 101, "Alice")
	insertTestPage(t, store, site.ID, nil, "home", "home", 0)

	_, err := store.insertPage(context.Background(), testPage(site.ID, nil, "other", "home", 1))
	if !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("duplicate root slug error = %v, want ErrAlreadyExists", err)
	}
	_, err = store.CreateSite(context.Background(), NewSite{
		ConnectionID:    site.ConnectionID,
		Name:            "Duplicate",
		OwnerSubjectKey: "user:other",
		VisibleTo:       []string{"user:other"},
	})
	if !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("duplicate connection error = %v, want ErrAlreadyExists", err)
	}
}

func TestSQLiteStorePersistsPublisherRootsInsideSite(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	site := createTestSite(t, store, 101, "Alice")
	root, err := store.CreatePublisherRoot(ctx, NewPublisherRoot{
		SiteID:              site.ID,
		PublisherSubjectKey: "user:101",
		RootURI:             mustURI(t, "local@alice[site]:///website"),
		Purpose:             "content",
		Status:              "active",
		VisibleTo:           []string{"user:101"},
	})
	if err != nil {
		t.Fatalf("CreatePublisherRoot: %v", err)
	}
	roots, err := store.ListPublisherRoots(ctx, site.ID)
	if err != nil {
		t.Fatalf("ListPublisherRoots: %v", err)
	}
	if len(roots) != 1 || roots[0].ID != root.ID || roots[0].RootURI != root.RootURI {
		t.Fatalf("roots = %#v, want root %#v", roots, root)
	}
	_, err = store.CreatePublisherRoot(ctx, NewPublisherRoot{
		SiteID:              site.ID,
		PublisherSubjectKey: "user:101",
		RootURI:             common.CanonURI("not-a-uri"),
		Purpose:             "content",
		Status:              "active",
		VisibleTo:           []string{"user:101"},
	})
	if !errors.Is(err, ErrInvalidRecord) {
		t.Fatalf("invalid root URI error = %v, want ErrInvalidRecord", err)
	}
}

func TestSQLiteStoreCreatesLayoutSEOAndNormalizedSetsAtomically(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	site, err := store.CreateSite(ctx, NewSite{
		ConnectionID:     101,
		Name:             "Alice",
		OwnerSubjectKey:  "user:101",
		InitialLayoutXML: []byte("<site-layout schema-version=\"1\" layout-revision=\"1\"/>"),
		VisibleTo:        []string{"user:101"},
	})
	if err != nil {
		t.Fatalf("CreateSite: %v", err)
	}
	layout, err := store.EditorLayout(ctx, site.ID)
	if err != nil {
		t.Fatalf("EditorLayout: %v", err)
	}
	wantLayout, err := initialEditorLayout(nil)
	if err != nil {
		t.Fatalf("initialEditorLayout: %v", err)
	}
	if layout.Revision != 1 || string(layout.XML) != string(wantLayout) {
		t.Fatalf("layout = %+v", layout)
	}
	seo, err := store.SiteSEO(ctx, site.ID)
	if err != nil || seo.RobotsText != "" {
		t.Fatalf("SiteSEO = %+v, %v", seo, err)
	}

	page, err := store.insertPage(ctx, NewPage{
		SiteID:              site.ID,
		PageKey:             "home",
		Slug:                "home",
		Title:               "Home",
		Status:              "draft",
		Position:            0,
		PublisherSubjectKey: "user:101",
		BundleRootURI:       mustURI(t, "local@alice[site]:///bundles/home"),
		Types:               []string{" Landing ", "landing", "ARTICLE", ""},
		SearchTags:          []string{" news ", "news", "News", ""},
		VisibleTo:           []string{"user:101"},
	})
	if err != nil {
		t.Fatalf("InsertPage: %v", err)
	}
	types, err := store.PageTypes(ctx, site.ID, page.ID)
	if err != nil {
		t.Fatalf("PageTypes: %v", err)
	}
	if want := []string{"article", "landing"}; !reflect.DeepEqual(types, want) {
		t.Fatalf("types = %#v, want %#v", types, want)
	}
	tags, err := store.PageSearchTags(ctx, site.ID, page.ID)
	if err != nil {
		t.Fatalf("PageSearchTags: %v", err)
	}
	if want := []string{"News", "news"}; !reflect.DeepEqual(tags, want) {
		t.Fatalf("tags = %#v, want %#v", tags, want)
	}
}

func TestSQLiteStoreReplacesEditorLayoutWithRevisionCAS(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	site := createTestSite(t, store, 101, "Alice")

	nextXML, err := NormalizeEditorLayout(LayoutDocument{
		SchemaVersion: 1,
		Revision:      2,
		Nodes:         []LayoutNode{{PageID: 7, X: 10, Y: 20, Width: 100, Height: 50, View: "expanded"}},
	}, LayoutLimits{})
	if err != nil {
		t.Fatalf("NormalizeEditorLayout: %v", err)
	}
	updated, err := store.ReplaceEditorLayout(ctx, site.ID, 1, 1, nextXML)
	if err != nil {
		t.Fatalf("ReplaceEditorLayout: %v", err)
	}
	if updated.Revision != 2 || string(updated.XML) != string(nextXML) {
		t.Fatalf("updated layout = %+v", updated)
	}
	if _, err := store.ReplaceEditorLayout(ctx, site.ID, 2, 1, nextXML); !errors.Is(err, ErrInvalidRecord) {
		t.Fatalf("mismatched embedded revision error = %v, want ErrInvalidRecord", err)
	}

	_, err = store.ReplaceEditorLayout(ctx, site.ID, 1, 1, nextXML)
	var conflict *RevisionConflict
	if !errors.As(err, &conflict) || !errors.Is(err, ErrLayoutRevisionConflict) || conflict.Current != 2 {
		t.Fatalf("stale error = %#v, want layout conflict at revision 2", err)
	}
	if conflict.PublicCode() != "layout_revision_conflict" {
		t.Fatalf("conflict code = %q", conflict.PublicCode())
	}

	after, err := store.SiteByID(ctx, site.ID)
	if err != nil {
		t.Fatalf("SiteByID: %v", err)
	}
	if after.TreeRevision != site.TreeRevision || after.ModelRevision != site.ModelRevision || after.VisibilityRevision != site.VisibilityRevision {
		t.Fatalf("layout update changed unrelated revisions: before=%+v after=%+v", site, after)
	}
	persisted, err := store.EditorLayout(ctx, site.ID)
	if err != nil || persisted.Revision != 2 || string(persisted.XML) != string(nextXML) {
		t.Fatalf("persisted layout = %+v, %v", persisted, err)
	}
}

func TestSQLiteStoreRejectsInvalidInitialEditorLayout(t *testing.T) {
	store := openTestStore(t)
	_, err := store.CreateSite(context.Background(), NewSite{
		ConnectionID:     303,
		Name:             "Invalid layout",
		OwnerSubjectKey:  "user:owner",
		VisibleTo:        []string{"user:owner"},
		InitialLayoutXML: []byte(`<site-layout schema-version="1" layout-revision="2"/>`),
	})
	if !errors.Is(err, ErrInvalidRecord) {
		t.Fatalf("CreateSite error = %v, want ErrInvalidRecord", err)
	}
}

func TestSQLiteStoreEditorLayoutCASAllowsOneConcurrentWriter(t *testing.T) {
	store := openTestStore(t)
	site := createTestSite(t, store, 404, "Concurrent")
	first := normalizeLayoutForTest(t, LayoutDocument{SchemaVersion: 1, Revision: 2})
	second := normalizeLayoutForTest(t, LayoutDocument{
		SchemaVersion: 1,
		Revision:      2,
		Nodes:         []LayoutNode{{PageID: 1, X: 1, Y: 1, Width: 1, Height: 1, View: "expanded"}},
	})

	type result struct {
		layout *EditorLayout
		err    error
	}
	start := make(chan struct{})
	results := make(chan result, 2)
	for _, data := range [][]byte{first, second} {
		data := data
		go func() {
			<-start
			layout, err := store.ReplaceEditorLayout(context.Background(), site.ID, 1, 1, data)
			results <- result{layout: layout, err: err}
		}()
	}
	close(start)

	successes, conflicts := 0, 0
	for range 2 {
		result := <-results
		switch {
		case result.err == nil && result.layout != nil && result.layout.Revision == 2:
			successes++
		case errors.Is(result.err, ErrLayoutRevisionConflict):
			conflicts++
		default:
			t.Fatalf("unexpected CAS result: layout=%+v error=%v", result.layout, result.err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("CAS results: successes=%d conflicts=%d", successes, conflicts)
	}
}

func TestSQLiteStoreRollsBackLocalRevisionChanges(t *testing.T) {
	store := openTestStore(t)
	site := createTestSite(t, store, 101, "Alice")
	sentinel := errors.New("stop")
	err := store.withTx(context.Background(), func(tx *sql.Tx) error {
		if _, err := tx.Exec(`UPDATE html_sites SET tree_revision = tree_revision + 1 WHERE id = ?`, site.ID); err != nil {
			return err
		}
		return sentinel
	})
	if !errors.Is(err, sentinel) {
		t.Fatalf("withTx error = %v, want sentinel", err)
	}
	after, err := store.SiteByID(context.Background(), site.ID)
	if err != nil {
		t.Fatalf("SiteByID: %v", err)
	}
	if after.TreeRevision != 1 {
		t.Fatalf("tree revision = %d, want rollback to 1", after.TreeRevision)
	}
}

func TestSQLiteStoreOwnsNoForeignKeysToOtherDomains(t *testing.T) {
	db := openTestDB(t)
	rows, err := db.Query(`
		SELECT m.name, fk."table"
		FROM sqlite_master m, pragma_foreign_key_list(m.name) fk
		WHERE m.type = 'table' AND m.name LIKE 'html_%'`)
	if err != nil {
		t.Fatalf("foreign key query: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var from, target string
		if err := rows.Scan(&from, &target); err != nil {
			t.Fatalf("scan foreign key: %v", err)
		}
		if len(target) < len("html_") || target[:len("html_")] != "html_" {
			t.Fatalf("table %s references foreign domain table %s", from, target)
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("foreign key rows: %v", err)
	}
}

func TestHTMLProviderPackageDoesNotImportOtherDomains(t *testing.T) {
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatalf("Glob: %v", err)
	}
	banned := []string{
		"MyServer/internal/auth",
		"MyServer/internal/acl",
		"MyServer/internal/vfs/v2/storage",
		"MyServer/internal/vfs/v2/providers/local",
		"MyServer/internal/vfs/v2/providers/shared",
		"MyServer/internal/vfs/v2/providers/system",
	}
	for _, file := range files {
		parsed, err := parser.ParseFile(token.NewFileSet(), file, nil, parser.ImportsOnly)
		if err != nil {
			t.Fatalf("ParseFile(%s): %v", file, err)
		}
		for _, declaration := range parsed.Decls {
			imports, ok := declaration.(*ast.GenDecl)
			if !ok || imports.Tok != token.IMPORT {
				continue
			}
			for _, spec := range imports.Specs {
				path, err := strconv.Unquote(spec.(*ast.ImportSpec).Path.Value)
				if err != nil {
					t.Fatalf("unquote import in %s: %v", file, err)
				}
				for _, prefix := range banned {
					if path == prefix || strings.HasPrefix(path, prefix+"/") {
						t.Fatalf("%s imports forbidden domain %s", file, path)
					}
				}
			}
		}
	}
}

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	if err := InitDB(db); err != nil {
		t.Fatalf("InitDB: %v", err)
	}
	return db
}

func openTestStore(t *testing.T) *SQLiteStore {
	t.Helper()
	store, err := NewSQLiteStore(openTestDB(t))
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	return store
}

func createTestSite(t *testing.T, store *SQLiteStore, connectionID int64, name string) *Site {
	t.Helper()
	site, err := store.CreateSite(context.Background(), NewSite{
		ConnectionID:    connectionID,
		Name:            name,
		OwnerSubjectKey: "user:" + name,
		VisibleTo:       []string{"user:" + name},
	})
	if err != nil {
		t.Fatalf("CreateSite(%s): %v", name, err)
	}
	return site
}

func insertTestPage(t *testing.T, store *SQLiteStore, siteID int64, parentID *int64, key, slug string, position int) *Page {
	t.Helper()
	page, err := store.insertPage(context.Background(), testPage(siteID, parentID, key, slug, position))
	if err != nil {
		t.Fatalf("InsertPage(%s): %v", key, err)
	}
	return page
}

func testPage(siteID int64, parentID *int64, key, slug string, position int) NewPage {
	return NewPage{
		SiteID:              siteID,
		ParentID:            parentID,
		PageKey:             key,
		Slug:                slug,
		Title:               key,
		Status:              "draft",
		Position:            position,
		PublisherSubjectKey: "user:test",
		BundleRootURI:       common.CanonURI("local@test[site]:///bundles/" + key),
		VisibleTo:           []string{"user:test"},
	}
}

func mustURI(t *testing.T, raw string) common.CanonURI {
	t.Helper()
	uri, err := common.CastURI(raw)
	if err != nil {
		t.Fatalf("CastURI(%q): %v", raw, err)
	}
	return uri
}
