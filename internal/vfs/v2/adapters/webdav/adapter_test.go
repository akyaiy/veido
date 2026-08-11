package webdav

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"context"
	"os"
	"reflect"
	"testing"
)

type fakeFrontend struct {
	seen []common.CanonURI
}

func (f *fakeFrontend) Stat(ctx context.Context, actor vfs.Actor, uri common.CanonURI) (*vfs.Node, error) {
	f.seen = append(f.seen, uri)
	return &vfs.Node{Name: "docs", IsDir: true}, nil
}

func (f *fakeFrontend) ReadDir(ctx context.Context, actor vfs.Actor, uri common.CanonURI) ([]*vfs.Node, error) {
	f.seen = append(f.seen, uri)
	return []*vfs.Node{{Name: "a.txt", Size: 10}}, nil
}

func (f *fakeFrontend) OpenFile(ctx context.Context, actor vfs.Actor, uri common.CanonURI, flag int) (vfs.File, error) {
	f.seen = append(f.seen, uri)
	return nil, os.ErrNotExist
}

func (f *fakeFrontend) Mkdir(ctx context.Context, actor vfs.Actor, uri common.CanonURI) (*vfs.Node, error) {
	f.seen = append(f.seen, uri)
	return &vfs.Node{Name: "new", IsDir: true}, nil
}

func (f *fakeFrontend) Move(ctx context.Context, actor vfs.Actor, source common.CanonURI, target common.CanonURI) error {
	f.seen = append(f.seen, source, target)
	return nil
}

func (f *fakeFrontend) Delete(ctx context.Context, actor vfs.Actor, uri common.CanonURI) error {
	f.seen = append(f.seen, uri)
	return nil
}

func (f *fakeFrontend) Control(ctx context.Context, actor vfs.Actor, uri common.CanonURI, command string, input []byte) ([]byte, error) {
	return nil, nil
}

func TestAdapterJoinsDAVPathToBaseURI(t *testing.T) {
	frontend := &fakeFrontend{}
	adapter, err := NewWebDAVAdapter(frontend, vfs.Actor{Kind: vfs.ActorUser, ID: "1"}, mustURI(t, "debug@default[debug]:///root"))
	if err != nil {
		t.Fatalf("NewWebDAVAdapter() error = %v", err)
	}

	if _, err := adapter.Stat(context.Background(), "/docs"); err != nil {
		t.Fatalf("Stat() error = %v", err)
	}
	if err := adapter.Mkdir(context.Background(), "new", 0755); err != nil {
		t.Fatalf("Mkdir() error = %v", err)
	}

	want := []common.CanonURI{
		mustURI(t, "debug@default[debug]:///root/docs"),
		mustURI(t, "debug@default[debug]:///root/new"),
	}
	if !reflect.DeepEqual(frontend.seen, want) {
		t.Fatalf("seen URIs = %#v, want %#v", frontend.seen, want)
	}
}

func mustURI(t *testing.T, raw string) common.CanonURI {
	t.Helper()
	uri, err := common.CastURI(raw)
	if err != nil {
		t.Fatalf("CastURI(%q) error = %v", raw, err)
	}
	return uri
}
