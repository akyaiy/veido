package html

import (
	"context"
	"errors"
	"testing"
)

func TestMergeVisibleBlockTreePreservesHiddenBlocks(t *testing.T) {
	base := BlockTreeDocument{Revision: 7, Folders: []BlockFolder{
		{Key: "shared", Name: "Shared", Blocks: []string{"hidden-a", "visible-a", "hidden-b"}},
		{Key: "private", Name: "Private", Blocks: []string{"hidden-c"}},
	}}
	submitted := BlockTreeDocument{Revision: 7, Folders: []BlockFolder{
		{Key: "mine", Name: "Mine", Blocks: []string{"visible-a"}},
	}}

	got := mergeVisibleBlockTree(base, submitted, map[string]bool{"visible-a": true})
	if got.Revision != 7 {
		t.Fatalf("revision = %d, want 7", got.Revision)
	}
	if len(got.Folders) != 3 {
		t.Fatalf("folders = %#v", got.Folders)
	}
	if got.Folders[0].Key != "shared" || len(got.Folders[0].Blocks) != 2 || got.Folders[0].Blocks[0] != "hidden-a" || got.Folders[0].Blocks[1] != "hidden-b" {
		t.Fatalf("shared folder = %#v; hidden blocks must stay untouched", got.Folders[0])
	}
	if got.Folders[1].Key != "private" || len(got.Folders[1].Blocks) != 1 || got.Folders[1].Blocks[0] != "hidden-c" {
		t.Fatalf("private folder = %#v; hidden folder must stay untouched", got.Folders[1])
	}
	if got.Folders[2].Key != "mine" || len(got.Folders[2].Blocks) != 1 || got.Folders[2].Blocks[0] != "visible-a" {
		t.Fatalf("visible placement = %#v", got.Folders[2])
	}
}

func TestDeleteBlockRemovesItsTreeReferenceAtomically(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	site := createTestSite(t, store, 901, "Blocks")
	service, err := NewBlockService(store)
	if err != nil {
		t.Fatal(err)
	}
	block, err := service.CreateBlock(ctx, CreateBlockRequest{
		SiteID: site.ID, BlockKey: "removable", Name: "Removable", Type: "content",
		PublisherSubjectKey: "user:901", BundleRootURI: mustURI(t, "local@blocks[site]:///content/removable"), VisibleTo: []string{"user:901"},
	})
	if err != nil {
		t.Fatalf("CreateBlock: %v", err)
	}
	if _, err := service.ReplaceTree(ctx, site.ID, []byte(`{"revision":1,"folders":[{"key":"catalog","name":"Catalog","blocks":["removable"]}]}`)); err != nil {
		t.Fatalf("ReplaceTree: %v", err)
	}
	if err := service.DeleteBlock(ctx, site.ID, block.BlockKey, block.Revision); err != nil {
		t.Fatalf("DeleteBlock: %v", err)
	}
	tree, err := store.ReadBlockTree(ctx, site.ID)
	if err != nil {
		t.Fatal(err)
	}
	document, err := ParseBlockTree(tree.DocumentJSON)
	if err != nil {
		t.Fatal(err)
	}
	if tree.Revision != 3 || document.Revision != 3 || len(document.Folders) != 1 || len(document.Folders[0].Blocks) != 0 {
		t.Fatalf("tree after delete = store %#v document %#v", tree, document)
	}
	if _, err := store.BlockByKey(ctx, site.ID, block.BlockKey); !errors.Is(err, ErrBlockNotFound) {
		t.Fatalf("BlockByKey after delete = %v, want ErrBlockNotFound", err)
	}
}

func TestCreateBlockNormalizesKeyAndReservesTreeDocument(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	site := createTestSite(t, store, 902, "BlockKeys")
	service, err := NewBlockService(store)
	if err != nil {
		t.Fatal(err)
	}
	base := CreateBlockRequest{
		SiteID: site.ID, Name: "Block", Type: "content", PublisherSubjectKey: "user:902",
		BundleRootURI: mustURI(t, "local@blocks[site]:///content/block"), VisibleTo: []string{"user:902"},
	}
	base.BlockKey = "  normalized  "
	block, err := service.CreateBlock(ctx, base)
	if err != nil {
		t.Fatalf("CreateBlock: %v", err)
	}
	if block.BlockKey != "normalized" {
		t.Fatalf("BlockKey = %q, want normalized", block.BlockKey)
	}
	if _, err := store.BlockByKey(ctx, site.ID, "normalized"); err != nil {
		t.Fatalf("normalized BlockByKey: %v", err)
	}
	base.BlockKey = "tree.json"
	if _, err := service.CreateBlock(ctx, base); !errors.Is(err, ErrInvalidRecord) {
		t.Fatalf("reserved key error = %v, want ErrInvalidRecord", err)
	}
}

func TestParseBlockTreeRejectsTrailingJSON(t *testing.T) {
	if _, err := ParseBlockTree([]byte(`{"revision":1,"folders":[]} {}`)); !errors.Is(err, ErrInvalidBlockTree) {
		t.Fatalf("trailing JSON error = %v, want ErrInvalidBlockTree", err)
	}
}

func TestBlockServiceRejectsEmptyVisibilityAndInvalidTreeReferences(t *testing.T) {
	store := openTestStore(t)
	ctx := context.Background()
	first := createTestSite(t, store, 903, "First")
	second := createTestSite(t, store, 904, "Second")
	service, err := NewBlockService(store)
	if err != nil {
		t.Fatal(err)
	}
	base := CreateBlockRequest{
		Name: "Block", Type: "content", PublisherSubjectKey: "user:test",
		BundleRootURI: mustURI(t, "local@blocks[site]:///content/block"),
	}
	base.SiteID, base.BlockKey = first.ID, "invisible"
	if _, err := service.CreateBlock(ctx, base); !errors.Is(err, ErrInvalidAudience) {
		t.Fatalf("empty visibility = %v, want ErrInvalidAudience", err)
	}
	blocks, err := store.ListBlocks(ctx, first.ID)
	if err != nil || len(blocks) != 0 {
		t.Fatalf("empty visibility persisted blocks = %#v, %v", blocks, err)
	}

	base.SiteID, base.BlockKey, base.VisibleTo = second.ID, "foreign", []string{"user:Second"}
	if _, err := service.CreateBlock(ctx, base); err != nil {
		t.Fatalf("create foreign block: %v", err)
	}
	if _, err := service.ReplaceTree(ctx, first.ID, []byte(`{"revision":1,"folders":[{"key":"catalog","name":"Catalog","blocks":["foreign"]}]}`)); !errors.Is(err, ErrBlockNotFound) {
		t.Fatalf("foreign Block tree reference = %v, want ErrBlockNotFound", err)
	}
	tree, err := store.ReadBlockTree(ctx, first.ID)
	if err != nil || tree.Revision != 1 {
		t.Fatalf("foreign reference changed tree = %#v, %v", tree, err)
	}
	if _, err := service.ReplaceTree(ctx, first.ID, []byte(`{"revision":1,"folders":[{"key":"one","name":"One","blocks":["same"]},{"key":"two","name":"Two","blocks":["same"]}]}`)); !errors.Is(err, ErrInvalidBlockTree) {
		t.Fatalf("duplicate tree Block key = %v, want ErrInvalidBlockTree", err)
	}
}
