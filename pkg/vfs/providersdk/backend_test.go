package providersdk_test

import (
	"MyServer/pkg/vfs"
	sdk "MyServer/pkg/vfs/providersdk"
	"MyServer/pkg/vfs/providertest"
	"context"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

type diskBackend struct{ root string }

func (b diskBackend) disk(p string) string {
	return filepath.Join(b.root, filepath.FromSlash(strings.TrimPrefix(p, "/")))
}
func (b diskBackend) Stat(ctx context.Context, p string) (*vfs.Node, error) {
	return sdk.FromFS(os.DirFS(b.root)).Stat(ctx, p)
}
func (b diskBackend) ReadDir(ctx context.Context, p string) ([]*vfs.Node, error) {
	return sdk.FromFS(os.DirFS(b.root)).ReadDir(ctx, p)
}
func (b diskBackend) OpenRead(ctx context.Context, p string) (io.ReadCloser, error) {
	return os.Open(b.disk(p))
}
func (b diskBackend) OpenWrite(ctx context.Context, p string, flags int) (vfs.File, error) {
	return os.OpenFile(b.disk(p), flags, 0600)
}
func (b diskBackend) Mkdir(ctx context.Context, p, name string) (*vfs.Node, error) {
	target := b.disk(path.Join(p, name))
	if err := os.Mkdir(target, 0700); err != nil {
		return nil, err
	}
	return b.Stat(ctx, path.Join(p, name))
}
func (b diskBackend) Move(ctx context.Context, source, target, name string) error {
	return os.Rename(b.disk(source), b.disk(target+"/"+name))
}
func (b diskBackend) Delete(ctx context.Context, p string) error { return os.Remove(b.disk(p)) }

func TestOrdinaryFilesystemAndHiddenComposition(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	base := sdk.FromBackend(diskBackend{root})
	if err := os.Mkdir(filepath.Join(root, "%account%"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "%account%", "native-secret"), []byte("hidden backend entry"), 0600); err != nil {
		t.Fatal(err)
	}
	tree := sdk.New()
	sdk.Bytes(tree.Root(), "info.txt", func(context.Context, sdk.Request, sdk.Unit) ([]byte, error) { return []byte("account\n"), nil })
	control, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	p, err := sdk.Compose(base, sdk.Mount{Path: "/%account%", Provider: control, Hidden: true})
	if err != nil {
		t.Fatal(err)
	}
	h := harness(t, p, providertest.Options{})
	if _, err = h.Frontend.Mkdir(ctx, h.Actor, h.URI("/docs")); err != nil {
		t.Fatal(err)
	}
	f, err := h.Frontend.OpenFile(ctx, h.Actor, h.URI("/docs/file.bin"), os.O_CREATE|os.O_EXCL|os.O_WRONLY)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = f.Write([]byte{0, 1, 2, 3}); err != nil {
		t.Fatal(err)
	}
	if err = vfs.FinishWrite(f, nil); err != nil {
		t.Fatal(err)
	}
	f, err = h.Frontend.OpenFile(ctx, h.Actor, h.URI("/docs/file.bin"), os.O_APPEND|os.O_WRONLY)
	if err != nil {
		t.Fatal(err)
	}
	_, err = f.Write([]byte{4})
	if err = vfs.FinishWrite(f, err); err != nil {
		t.Fatal(err)
	}
	f, err = h.Frontend.OpenFile(ctx, h.Actor, h.URI("/docs/file.bin"), os.O_RDONLY)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = f.Seek(3, io.SeekStart); err != nil {
		t.Fatal(err)
	}
	tail, err := io.ReadAll(f)
	_ = f.Close()
	if err != nil || string(tail) != string([]byte{3, 4}) {
		t.Fatalf("seek/read %v %v", tail, err)
	}
	if err = h.Frontend.Move(ctx, h.Actor, h.URI("/docs/file.bin"), h.URI("/docs/moved.bin")); err != nil {
		t.Fatal(err)
	}
	if _, err = h.Frontend.OpenFile(ctx, h.Actor, h.URI("/docs/moved.bin"), os.O_CREATE|os.O_EXCL|os.O_WRONLY); !errors.Is(err, os.ErrExist) {
		t.Fatalf("exclusive create: %v", err)
	}
	nodes, err := h.Frontend.ReadDir(ctx, h.Actor, h.URI("/"))
	if err != nil || len(nodes) != 1 || nodes[0].Name != "docs" {
		t.Fatalf("hidden root: %+v %v", nodes, err)
	}
	providertest.CheckTree(t, ctx, h, providertest.CheckOptions{Expected: []string{"/docs/moved.bin", "/%account%/info.txt"}})
	if _, err = p.Stat(ctx, "/%account%/native-secret"); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("fell through mount: %v", err)
	}
	if err = p.Move(ctx, "/docs/moved.bin", "/%account%", "moved.bin"); !errors.Is(err, vfs.ErrUnsupported) {
		t.Fatalf("cross mount move: %v", err)
	}
	if err = p.Delete(ctx, "/%account%"); !errors.Is(err, os.ErrPermission) {
		t.Fatalf("deleted mount root: %v", err)
	}
	if _, err = p.Mkdir(ctx, "/", "%account%"); !errors.Is(err, os.ErrPermission) {
		t.Fatalf("created shadowed root: %v", err)
	}
	if err = h.Frontend.Delete(ctx, h.Actor, h.URI("/docs/moved.bin")); err != nil {
		t.Fatal(err)
	}
	if err = h.Frontend.Delete(ctx, h.Actor, h.URI("/docs")); err != nil {
		t.Fatal(err)
	}
}

func TestFromFSReadOnlyAndPathRules(t *testing.T) {
	p := sdk.FromFS(fstest.MapFS{"dir/file.txt": &fstest.MapFile{Data: []byte("hello")}})
	ctx := context.Background()
	h := harness(t, p, providertest.Options{})
	providertest.CheckTree(t, ctx, h, providertest.CheckOptions{Expected: []string{"/dir/file.txt"}})
	for _, path := range []string{"/../file", "/dir/../file", "//dir/file.txt"} {
		if _, err := p.Stat(ctx, path); !errors.Is(err, os.ErrInvalid) {
			t.Fatalf("accepted %s: %v", path, err)
		}
	}
	if _, err := p.OpenFile(ctx, "/dir/file.txt", os.O_WRONLY|os.O_TRUNC); !errors.Is(err, os.ErrPermission) {
		t.Fatal(err)
	}
	if _, err := p.Mkdir(ctx, "/", "new"); !errors.Is(err, os.ErrPermission) {
		t.Fatal(err)
	}
}

func TestMountKeepsSelfURIPrefix(t *testing.T) {
	tree := sdk.New()
	sdk.JSON(tree.Root(), "self.json", func(ctx context.Context, req sdk.Request, _ sdk.Unit) (vfs.URI, error) {
		return sdk.SelfURI(ctx, "/info.json")
	})
	component, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	provider, err := sdk.Compose(sdk.FromFS(fstest.MapFS{}), sdk.Mount{Path: "/service", Provider: component})
	if err != nil {
		t.Fatal(err)
	}
	h := harness(t, provider, providertest.Options{})
	file, err := h.Frontend.OpenFile(context.Background(), h.Actor, h.URI("/service/self.json"), os.O_RDONLY)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(file)
	_ = file.Close()
	if err != nil || !strings.Contains(string(data), string(h.URI("/service/info.json"))) {
		t.Fatalf("mount SelfURI=%s error=%v", data, err)
	}
}

func TestMissingDynamicMountIsOmittedFromParentListing(t *testing.T) {
	tree := sdk.New()
	tree.Root().Metadata(func(context.Context, sdk.Request, sdk.Unit) (*vfs.Node, error) {
		return nil, os.ErrNotExist
	})
	missing, err := tree.Build()
	if err != nil {
		t.Fatal(err)
	}
	provider, err := sdk.Compose(sdk.FromFS(fstest.MapFS{}), sdk.Mount{Path: "/dynamic", Provider: missing})
	if err != nil {
		t.Fatal(err)
	}
	nodes, err := provider.ReadDir(context.Background(), "/")
	if err != nil || len(nodes) != 0 {
		t.Fatalf("root listing = %+v, %v; want empty", nodes, err)
	}
	if _, err := provider.Stat(context.Background(), "/dynamic"); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("dynamic mount stat = %v, want not exist", err)
	}
}
