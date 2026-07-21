package providers

import (
	"MyServer/internal/acl"
	"MyServer/internal/vfs"
	"context"
	"database/sql"
	"errors"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type fakeSharedBindProvider struct {
	nodes               map[string]vfs.Node
	children            map[string][]vfs.Node
	resolveRelativePath map[string]string
	statCalls           []string
	readDirCalls        []string
	resolveCalls        []string
	openFileCalls       []string
	mkdirCalls          []string
	moveCalls           []string
	deleteCalls         []string
}

func (p *fakeSharedBindProvider) ResolvePathToID(ctx context.Context, filePath string) (string, error) {
	relativeNodeID, _ := ctx.Value("relative_node_id").(string)
	key := relativeNodeID + ":" + filePath
	p.resolveCalls = append(p.resolveCalls, key)
	if id, ok := p.resolveRelativePath[key]; ok {
		return id, nil
	}
	return "", os.ErrNotExist
}

func (p *fakeSharedBindProvider) ReadDir(ctx context.Context, dirID string) ([]vfs.Node, error) {
	p.readDirCalls = append(p.readDirCalls, dirID)
	nodes, ok := p.children[dirID]
	if !ok {
		return nil, os.ErrNotExist
	}
	return nodes, nil
}

func (p *fakeSharedBindProvider) OpenFile(ctx context.Context, fileID string, parentDirID string, name string, flag int) (vfs.File, error) {
	p.openFileCalls = append(p.openFileCalls, fileID+"|"+parentDirID+"|"+name)
	return fakeSharedFile{}, nil
}

func (p *fakeSharedBindProvider) Stat(ctx context.Context, id string) (vfs.Node, error) {
	p.statCalls = append(p.statCalls, id)
	node, ok := p.nodes[id]
	if !ok {
		return vfs.Node{}, os.ErrNotExist
	}
	return node, nil
}

func (p *fakeSharedBindProvider) Mkdir(ctx context.Context, parentDirID string, name string) (vfs.Node, error) {
	p.mkdirCalls = append(p.mkdirCalls, parentDirID+"|"+name)
	return vfs.Node{
		ID:        "node-new-dir",
		ParentID:  parentDirID,
		Name:      name,
		IsDir:     true,
		UpdatedAt: time.Date(2026, 6, 16, 12, 30, 0, 0, time.UTC),
	}, nil
}

func (p *fakeSharedBindProvider) Move(ctx context.Context, id string, newParentID string, newName string) error {
	p.moveCalls = append(p.moveCalls, id+"|"+newParentID+"|"+newName)
	return nil
}

func (p *fakeSharedBindProvider) Delete(ctx context.Context, id string) error {
	p.deleteCalls = append(p.deleteCalls, id)
	return nil
}

type fakeSharedFile struct{}

func (fakeSharedFile) Read(p []byte) (int, error)  { return 0, io.EOF }
func (fakeSharedFile) Write(p []byte) (int, error) { return len(p), nil }
func (fakeSharedFile) Seek(offset int64, whence int) (int64, error) {
	return 0, nil
}
func (fakeSharedFile) Close() error { return nil }
func (fakeSharedFile) Stat() (os.FileInfo, error) {
	return vfs.NewFileInfo(vfs.Node{Name: "fake", UpdatedAt: time.Now()}), nil
}

func openSharedProviderTestDB(t *testing.T) *sql.DB {
	t.Helper()

	dbPath := filepath.Join("testdata", "shared_provider.db")
	if err := os.Remove(dbPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("remove old test db: %v", err)
	}
	t.Cleanup(func() {
		_ = os.Remove(dbPath)
	})

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	_, err = db.Exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY,
			username TEXT NOT NULL
		);
		CREATE TABLE groups (
			id INTEGER PRIMARY KEY,
			name TEXT NOT NULL UNIQUE
		);
		CREATE TABLE permissions (
			id INTEGER PRIMARY KEY,
			key TEXT NOT NULL UNIQUE
		);
		CREATE TABLE user_groups (
			user_id INTEGER NOT NULL,
			group_id INTEGER NOT NULL
		);
		CREATE TABLE group_permissions (
			group_id INTEGER NOT NULL,
			permission_id INTEGER NOT NULL
		);
		CREATE TABLE shares (
			id INTEGER PRIMARY KEY,
			to_id INTEGER NOT NULL,
			resource_id TEXT NOT NULL
		);

		INSERT INTO users(id, username) VALUES (7, 'shared-user');
		INSERT INTO groups(id, name) VALUES (11, 'shared-group');
		INSERT INTO permissions(id, key) VALUES
			(21, 'vfs.shared:node-root'),
			(22, 'vfs.shared:missing-node'),
			(23, 'vfs.home:ignored');
		INSERT INTO user_groups(user_id, group_id) VALUES (7, 11);
		INSERT INTO group_permissions(group_id, permission_id) VALUES
			(11, 21),
			(11, 22),
			(11, 23);
		INSERT INTO shares(id, to_id, resource_id) VALUES
			(31, 7, 'node-root'),
			(32, 7, 'missing-node'),
			(33, 7, 'mount-root');
	`)
	if err != nil {
		t.Fatalf("create test schema: %v", err)
	}

	return db
}

func TestSharedFSProviderUsesVirtualIDsAndDelegatesRealIDs(t *testing.T) {
	ctx := context.Background()
	db := openSharedProviderTestDB(t)

	updatedAt := time.Date(2026, 6, 16, 12, 0, 0, 0, time.UTC)
	bind := &fakeSharedBindProvider{
		nodes: map[string]vfs.Node{
			"node-root": {
				ID:        "node-root",
				ParentID:  "owner-home",
				Name:      "shared-docs",
				IsDir:     true,
				UpdatedAt: updatedAt,
			},
			"node-child-dir": {
				ID:        "node-child-dir",
				ParentID:  "node-root",
				Name:      "nested",
				IsDir:     true,
				UpdatedAt: updatedAt,
			},
		},
		children: map[string][]vfs.Node{
			"node-root": {
				{
					ID:        "node-child-dir",
					ParentID:  "node-root",
					Name:      "nested",
					IsDir:     true,
					UpdatedAt: updatedAt,
				},
			},
			"node-child-dir": {},
		},
		resolveRelativePath: map[string]string{
			"node-root:nested": "node-child-dir",
		},
	}

	provider, err := NewSharedFSProvider(db, 7, bind, "mount-root")
	if err != nil {
		t.Fatalf("new shared provider: %v", err)
	}

	rootNodes, err := provider.ReadDir(ctx, "/")
	if err != nil {
		t.Fatalf("read shared root: %v", err)
	}
	if len(rootNodes) != 1 {
		t.Fatalf("shared root returned %d nodes, want 1: %#v", len(rootNodes), rootNodes)
	}
	if rootNodes[0].ID != "/shared-docs" || rootNodes[0].Name != "shared-docs" {
		t.Fatalf("unexpected shared root node: %#v", rootNodes[0])
	}

	resolvedID, err := provider.ResolvePathToID(ctx, "/shared-docs/nested")
	if err != nil {
		t.Fatalf("resolve nested shared path: %v", err)
	}
	if resolvedID != "/shared-docs/nested" {
		t.Fatalf("resolved id = %q, want /shared-docs/nested", resolvedID)
	}

	children, err := provider.ReadDir(ctx, "/shared-docs")
	if err != nil {
		t.Fatalf("read shared directory by mounted path: %v", err)
	}
	if len(children) != 1 || children[0].ID != "/shared-docs/nested" || children[0].ParentID != "/shared-docs" {
		t.Fatalf("unexpected shared directory children: %#v", children)
	}

	stat, err := provider.Stat(ctx, "/shared-docs/nested")
	if err != nil {
		t.Fatalf("stat nested shared path: %v", err)
	}
	if stat.ID != "/shared-docs/nested" || stat.ParentID != "/shared-docs" {
		t.Fatalf("unexpected stat node: %#v", stat)
	}

	if !reflect.DeepEqual(bind.readDirCalls, []string{"node-root"}) {
		t.Fatalf("bind ReadDir calls = %#v, want only original node-root id", bind.readDirCalls)
	}
	if !reflect.DeepEqual(bind.resolveCalls, []string{"node-root:nested", "node-root:nested"}) {
		t.Fatalf("bind ResolvePathToID calls = %#v, want original node-root context", bind.resolveCalls)
	}
}

func TestSharedFSProviderCRUDDelegatesRealIDsAndReturnsVirtualIDs(t *testing.T) {
	ctx := context.Background()
	db := openSharedProviderTestDB(t)

	updatedAt := time.Date(2026, 6, 16, 12, 0, 0, 0, time.UTC)
	bind := &fakeSharedBindProvider{
		nodes: map[string]vfs.Node{
			"node-root": {
				ID:        "node-root",
				ParentID:  "owner-home",
				Name:      "shared-docs",
				IsDir:     true,
				UpdatedAt: updatedAt,
			},
			"node-child-dir": {
				ID:        "node-child-dir",
				ParentID:  "node-root",
				Name:      "nested",
				IsDir:     true,
				UpdatedAt: updatedAt,
			},
		},
		resolveRelativePath: map[string]string{
			"node-root:nested": "node-child-dir",
		},
	}

	provider, err := NewSharedFSProvider(db, 7, bind, "mount-root")
	if err != nil {
		t.Fatalf("new shared provider: %v", err)
	}

	created, err := provider.Mkdir(ctx, "/shared-docs", "created")
	if err != nil {
		t.Fatalf("mkdir through shared provider: %v", err)
	}
	if created.ID != "/shared-docs/created" || created.ParentID != "/shared-docs" {
		t.Fatalf("created node uses non-virtual ids: %#v", created)
	}
	if !reflect.DeepEqual(bind.mkdirCalls, []string{"node-root|created"}) {
		t.Fatalf("bind Mkdir calls = %#v, want real parent id", bind.mkdirCalls)
	}

	if err := provider.Move(ctx, "/shared-docs/nested", "/shared-docs", "renamed"); err != nil {
		t.Fatalf("move through shared provider: %v", err)
	}
	if !reflect.DeepEqual(bind.moveCalls, []string{"node-child-dir|node-root|renamed"}) {
		t.Fatalf("bind Move calls = %#v, want real ids", bind.moveCalls)
	}

	if err := provider.Move(ctx, "/shared-docs", "/", "renamed-root"); err != nil {
		t.Fatalf("rename shared root resource: %v", err)
	}
	if !reflect.DeepEqual(bind.moveCalls, []string{
		"node-child-dir|node-root|renamed",
		"node-root|owner-home|renamed-root",
	}) {
		t.Fatalf("bind Move calls after root rename = %#v, want real ids", bind.moveCalls)
	}

	if err := provider.Delete(ctx, "/shared-docs/nested"); err != nil {
		t.Fatalf("delete through shared provider: %v", err)
	}
	if !reflect.DeepEqual(bind.deleteCalls, []string{"node-child-dir"}) {
		t.Fatalf("bind Delete calls = %#v, want real id", bind.deleteCalls)
	}

	if _, err := provider.OpenFile(ctx, "", "/shared-docs", "new.txt", os.O_CREATE|os.O_RDWR); err != nil {
		t.Fatalf("open/create through shared provider: %v", err)
	}
	if !reflect.DeepEqual(bind.openFileCalls, []string{"|node-root|new.txt"}) {
		t.Fatalf("bind OpenFile calls = %#v, want real parent id", bind.openFileCalls)
	}
}

func openSharedMountIntegrationDB(t *testing.T) (*sql.DB, string) {
	t.Helper()

	dir := t.TempDir()
	db, err := sql.Open("sqlite3", filepath.Join(dir, "vfs.db")+"?_foreign_keys=on")
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	repo := vfs.NewRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		t.Fatalf("migrate vfs schema: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL)`); err != nil {
		t.Fatalf("create users table: %v", err)
	}
	if err := acl.InitACL(db); err != nil {
		t.Fatalf("init acl schema: %v", err)
	}
	if _, err := db.Exec(`
		CREATE TABLE shares (
			id INTEGER PRIMARY KEY,
			to_id INTEGER NOT NULL,
			resource_id TEXT NOT NULL
		);
		INSERT INTO users(id, username) VALUES (7, 'shared-user');
	`); err != nil {
		t.Fatalf("create shares fixtures: %v", err)
	}

	return db, filepath.Join(dir, "storage")
}

func readProviderFile(t *testing.T, ctx context.Context, provider vfs.FSProvider, id string) string {
	t.Helper()

	file, err := provider.OpenFile(ctx, id, "", "", os.O_RDONLY)
	if err != nil {
		t.Fatalf("open file for read: %v", err)
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		t.Fatalf("read file: %v", err)
	}
	return string(data)
}

func writeProviderFile(t *testing.T, file vfs.File, content string) {
	t.Helper()

	if _, err := file.Write([]byte(content)); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close file: %v", err)
	}
}

func TestSharedMountReadsAndCreatesNonEmptyFiles(t *testing.T) {
	ctx := context.Background()
	db, storagePath := openSharedMountIntegrationDB(t)

	localFS := vfs.NewLocalFSProvider(db, vfs.NewLocalStorageDriver(storagePath))
	mountManager := NewMountManagerFSProvider(db, localFS)
	mountManager.RegisterDriver("shared", func(parentID, config string) (vfs.FSProvider, error) {
		userID, err := strconv.Atoi(config)
		if err != nil {
			return nil, err
		}
		return NewSharedFSProvider(db, userID, mountManager, parentID)
	})

	ownerDir, err := localFS.Mkdir(ctx, "0", "shared-docs")
	if err != nil {
		t.Fatalf("create owner shared dir: %v", err)
	}
	created, err := localFS.OpenFile(ctx, "", ownerDir.ID, "file1", os.O_CREATE|os.O_WRONLY)
	if err != nil {
		t.Fatalf("create owner file: %v", err)
	}
	writeProviderFile(t, created, "owner content")

	mountDir, err := localFS.Mkdir(ctx, "0", "shared")
	if err != nil {
		t.Fatalf("create mount dir: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO shares(to_id, resource_id) VALUES (?, ?)`, 7, ownerDir.ID); err != nil {
		t.Fatalf("insert share: %v", err)
	}
	if err := mountManager.Mount(ctx, mountDir.ID, "shared", "7"); err != nil {
		t.Fatalf("mount shared provider: %v", err)
	}

	sharedFileID, err := mountManager.ResolvePathToID(ctx, "/shared/shared-docs/file1")
	if err != nil {
		t.Fatalf("resolve shared file path: %v", err)
	}
	if got := readProviderFile(t, ctx, mountManager, sharedFileID); got != "owner content" {
		t.Fatalf("shared file content = %q, want %q", got, "owner content")
	}

	sharedParentID, err := mountManager.ResolvePathToID(ctx, "/shared/shared-docs")
	if err != nil {
		t.Fatalf("resolve shared parent path: %v", err)
	}
	newFile, err := mountManager.OpenFile(ctx, "", sharedParentID, "new.txt", os.O_CREATE|os.O_WRONLY)
	if err != nil {
		t.Fatalf("create file through shared mount: %v", err)
	}
	writeProviderFile(t, newFile, "new content")

	newFileID, err := mountManager.ResolvePathToID(ctx, "/shared/shared-docs/new.txt")
	if err != nil {
		t.Fatalf("resolve new shared file path: %v", err)
	}
	if got := readProviderFile(t, ctx, mountManager, newFileID); got != "new content" {
		t.Fatalf("new shared file content = %q, want %q", got, "new content")
	}
}
