package shared

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"context"
	"errors"
	"os"
	"testing"
	"time"
)

func TestProviderBuildsActorScopedTreeAndDelegatesToTarget(t *testing.T) {
	target := mustURI(t, "local@default[alice]:///projects/demo")
	store := &memoryLinkStore{links: []Link{{
		RecipientUserID: 2,
		RecipientName:   "bob",
		GrantedByUserID: 1,
		GrantedByName:   "alice",
		TargetURI:       target,
		Alias:           "demo",
		AccessMode:      AccessViewer,
		Status:          StatusActive,
	}}}
	provider, err := NewProvider(store)
	if err != nil {
		t.Fatalf("NewProvider: %v", err)
	}
	bound := &recordingBoundVFS{}
	ctx := providerContext(vfs.Actor{Kind: vfs.ActorUser, ID: "2"}, bound)

	root, err := provider.ReadDir(ctx, "/")
	if err != nil {
		t.Fatalf("ReadDir root: %v", err)
	}
	assertNodeNames(t, root, "incoming", "outgoing")
	t.Logf("Bob sees shared root: %v", nodeNames(root))

	groups, err := provider.ReadDir(ctx, "/incoming")
	if err != nil {
		t.Fatalf("ReadDir incoming: %v", err)
	}
	assertNodeNames(t, groups, "alice")
	t.Logf("Bob sees incoming grantors: %v", nodeNames(groups))

	links, err := provider.ReadDir(ctx, "/incoming/alice")
	if err != nil {
		t.Fatalf("ReadDir grantor: %v", err)
	}
	assertNodeNames(t, links, "demo")
	t.Logf("Bob sees Alice links: %v", nodeNames(links))
	if len(bound.stats) != 2 || bound.stats[0] != target || bound.stats[1] != target {
		t.Fatalf("Stat calls = %v, want target checked for group and link listing", bound.stats)
	}

	if _, err := provider.ReadDir(ctx, "/incoming/alice/demo/docs"); err != nil {
		t.Fatalf("ReadDir delegated path: %v", err)
	}
	wantNested := mustURI(t, "local@default[alice]:///projects/demo/docs")
	if len(bound.readDirs) != 1 || bound.readDirs[0] != wantNested {
		t.Fatalf("ReadDir calls = %v, want [%s]", bound.readDirs, wantNested)
	}
	t.Logf("Delegated shared path /incoming/alice/demo/docs to canonical target %s", bound.readDirs[0])
}

func TestSQLiteBackedProviderDelegatesStoredTarget(t *testing.T) {
	db := openStoreTestDB(t)
	store, err := NewSQLiteStore(db)
	if err != nil {
		t.Fatalf("NewSQLiteStore: %v", err)
	}
	target := mustURI(t, "local@default[alice]:///projects/demo")
	if err := store.Create(context.Background(), Link{
		RecipientUserID: 2,
		RecipientName:   "bob",
		GrantedByUserID: 1,
		GrantedByName:   "alice",
		TargetURI:       target,
		Alias:           "demo",
		AccessMode:      AccessViewer,
		Status:          StatusActive,
	}); err != nil {
		t.Fatalf("Create: %v", err)
	}

	provider, err := NewProvider(store)
	if err != nil {
		t.Fatalf("NewProvider: %v", err)
	}
	bound := &recordingBoundVFS{}
	ctx := providerContext(vfs.Actor{Kind: vfs.ActorUser, ID: "2"}, bound)
	if _, err := provider.ReadDir(ctx, "/incoming/alice/demo/docs"); err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	want := mustURI(t, "local@default[alice]:///projects/demo/docs")
	if len(bound.readDirs) != 1 || bound.readDirs[0] != want {
		t.Fatalf("ReadDir calls = %v, want [%s]", bound.readDirs, want)
	}
}

func TestProviderDoesNotExposeAnotherActorsIncomingLinks(t *testing.T) {
	store := &memoryLinkStore{links: []Link{{
		RecipientUserID: 2,
		RecipientName:   "bob",
		GrantedByUserID: 1,
		GrantedByName:   "alice",
		TargetURI:       mustURI(t, "local@default[alice]:///demo"),
		Alias:           "demo",
		Status:          StatusActive,
	}}}
	provider, _ := NewProvider(store)
	ctx := providerContext(vfs.Actor{Kind: vfs.ActorUser, ID: "3"}, &recordingBoundVFS{})

	groups, err := provider.ReadDir(ctx, "/incoming")
	if err != nil {
		t.Fatalf("ReadDir incoming: %v", err)
	}
	if len(groups) != 0 {
		t.Fatalf("another actor saw groups: %#v", groups)
	}
	t.Log("Carol sees no links addressed to Bob")
	if _, err := provider.Stat(ctx, "/incoming/alice"); !errors.Is(err, vfs.ErrNotFound) {
		t.Fatalf("Stat foreign group error = %v, want not found", err)
	} else {
		t.Logf("Foreign group lookup is hidden as not found: %v", err)
	}
}

func TestProviderProtectsLinkRootsAndOutgoingMutations(t *testing.T) {
	store := &memoryLinkStore{links: []Link{{
		RecipientUserID: 2,
		RecipientName:   "bob",
		GrantedByUserID: 1,
		GrantedByName:   "alice",
		TargetURI:       mustURI(t, "local@default[alice]:///demo"),
		Alias:           "demo",
		Status:          StatusActive,
	}}}
	provider, _ := NewProvider(store)
	bound := &recordingBoundVFS{}
	bobCtx := providerContext(vfs.Actor{Kind: vfs.ActorUser, ID: "2"}, bound)
	aliceCtx := providerContext(vfs.Actor{Kind: vfs.ActorUser, ID: "1"}, bound)

	if err := provider.Delete(bobCtx, "/incoming/alice/demo"); !errors.Is(err, vfs.ErrPermissionDenied) {
		t.Fatalf("Delete link root error = %v, want permission denied", err)
	} else {
		t.Logf("Deleting an incoming link root is blocked: %v", err)
	}
	if _, err := provider.OpenFile(aliceCtx, "/outgoing/bob/demo/file.txt", os.O_WRONLY); !errors.Is(err, vfs.ErrPermissionDenied) {
		t.Fatalf("write through outgoing error = %v, want permission denied", err)
	} else {
		t.Logf("Writing through outgoing is blocked: %v", err)
	}
	if _, err := provider.Control(aliceCtx, "/outgoing", "create", nil); !errors.Is(err, vfs.ErrUnsupported) {
		t.Fatalf("Control error = %v, want unsupported", err)
	} else {
		t.Logf("Share management stays disabled until its state machine is implemented: %v", err)
	}
	if len(bound.deletes) != 0 || len(bound.openFiles) != 0 {
		t.Fatalf("forbidden operations reached BoundVFS: deletes=%v open=%v", bound.deletes, bound.openFiles)
	}
}

type memoryLinkStore struct{ links []Link }

func (s *memoryLinkStore) ListIncomingActive(_ context.Context, userID int64) ([]Link, error) {
	return filterLinks(s.links, func(link Link) bool { return link.RecipientUserID == userID && link.Status == StatusActive }), nil
}
func (s *memoryLinkStore) ListOutgoingActive(_ context.Context, userID int64) ([]Link, error) {
	return filterLinks(s.links, func(link Link) bool { return link.GrantedByUserID == userID && link.Status == StatusActive }), nil
}
func (s *memoryLinkStore) FindIncomingActive(_ context.Context, userID int64, grantor, alias string) (*Link, error) {
	return findLink(s.links, func(link Link) bool {
		return link.RecipientUserID == userID && link.GrantedByName == grantor && link.Alias == alias && link.Status == StatusActive
	})
}
func (s *memoryLinkStore) FindOutgoingActive(_ context.Context, userID int64, recipient, alias string) (*Link, error) {
	return findLink(s.links, func(link Link) bool {
		return link.GrantedByUserID == userID && link.RecipientName == recipient && link.Alias == alias && link.Status == StatusActive
	})
}

func filterLinks(links []Link, keep func(Link) bool) []Link {
	result := make([]Link, 0)
	for _, link := range links {
		if keep(link) {
			result = append(result, link)
		}
	}
	return result
}

func findLink(links []Link, match func(Link) bool) (*Link, error) {
	for _, link := range links {
		if match(link) {
			copy := link
			return &copy, nil
		}
	}
	return nil, ErrLinkNotFound
}

type recordingBoundVFS struct {
	stats     []common.CanonURI
	readDirs  []common.CanonURI
	openFiles []common.CanonURI
	deletes   []common.CanonURI
}

func (b *recordingBoundVFS) Stat(_ context.Context, uri common.CanonURI) (*vfs.Node, error) {
	b.stats = append(b.stats, uri)
	return &vfs.Node{Name: "target", Kind: "dir", IsDir: true, UpdatedAt: time.Unix(1, 0)}, nil
}
func (b *recordingBoundVFS) ReadDir(_ context.Context, uri common.CanonURI) ([]*vfs.Node, error) {
	b.readDirs = append(b.readDirs, uri)
	return []*vfs.Node{}, nil
}
func (b *recordingBoundVFS) OpenFile(_ context.Context, uri common.CanonURI, _ int) (vfs.File, error) {
	b.openFiles = append(b.openFiles, uri)
	return nil, errors.New("not implemented by test")
}
func (b *recordingBoundVFS) Mkdir(context.Context, common.CanonURI) (*vfs.Node, error) {
	return nil, errors.New("not implemented by test")
}
func (b *recordingBoundVFS) Move(context.Context, common.CanonURI, common.CanonURI) error {
	return errors.New("not implemented by test")
}
func (b *recordingBoundVFS) Delete(_ context.Context, uri common.CanonURI) error {
	b.deletes = append(b.deletes, uri)
	return nil
}
func (b *recordingBoundVFS) Control(context.Context, common.CanonURI, string, []byte) ([]byte, error) {
	return nil, errors.New("not implemented by test")
}
func (b *recordingBoundVFS) SelfURI(string) (common.CanonURI, error) {
	return common.EmptyURI, errors.New("not implemented by test")
}

func providerContext(actor vfs.Actor, bound vfs.BoundVFS) context.Context {
	ctx := vfs.ContextWithRequestContext(context.Background(), vfs.RequestContext{ActorKey: actor})
	return vfs.ContextWithBoundVFS(ctx, bound)
}

func mustURI(t *testing.T, raw string) common.CanonURI {
	t.Helper()
	uri, err := common.CastURI(raw)
	if err != nil {
		t.Fatalf("CastURI(%q): %v", raw, err)
	}
	return uri
}

func assertNodeNames(t *testing.T, nodes []*vfs.Node, want ...string) {
	t.Helper()
	if len(nodes) != len(want) {
		t.Fatalf("node count = %d, want %d (%#v)", len(nodes), len(want), nodes)
	}
	for i := range want {
		if nodes[i].Name != want[i] {
			t.Fatalf("node[%d].Name = %q, want %q", i, nodes[i].Name, want[i])
		}
	}
}

func nodeNames(nodes []*vfs.Node) []string {
	names := make([]string, 0, len(nodes))
	for _, node := range nodes {
		if node != nil {
			names = append(names, node.Name)
		}
	}
	return names
}
