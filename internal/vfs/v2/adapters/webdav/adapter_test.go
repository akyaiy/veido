package webdav

import (
	"MyServer/internal/common"
	vfs "MyServer/internal/vfs/v2"
	"bytes"
	"context"
	"os"
	"reflect"
	"testing"
)

type fakeFrontend struct {
	seen     []common.CanonURI
	statuses map[common.CanonURI]string
}

func (f *fakeFrontend) Stat(ctx context.Context, actor vfs.Actor, uri common.CanonURI) (*vfs.Node, error) {
	f.seen = append(f.seen, uri)
	if uri == mustURINoT("scopes@scopes[system]:///scopes/system/connections/debug@1") {
		return &vfs.Node{Name: "debug@1", Kind: "connection", IsDir: true}, nil
	}
	if uri.Path() == "/info.json" {
		return &vfs.Node{Name: "info.json", Kind: "file", Size: 2}, nil
	}
	return &vfs.Node{Name: "docs", IsDir: true}, nil
}

func (f *fakeFrontend) ReadDir(ctx context.Context, actor vfs.Actor, uri common.CanonURI) ([]*vfs.Node, error) {
	f.seen = append(f.seen, uri)
	switch uri {
	case mustURINoT("scopes@scopes[system]:///scopes"):
		return []*vfs.Node{{Name: "debug", IsDir: true}, {Name: "system", IsDir: true}}, nil
	case mustURINoT("scopes@scopes[system]:///scopes/system/connections"):
		return []*vfs.Node{{Name: "debug@1", IsDir: true}, {Name: "scopes@scopes", IsDir: true}}, nil
	}
	return []*vfs.Node{{Name: "a.txt", Size: 10}}, nil
}

func (f *fakeFrontend) OpenFile(ctx context.Context, actor vfs.Actor, uri common.CanonURI, flag int) (vfs.File, error) {
	f.seen = append(f.seen, uri)
	if status, ok := f.statuses[uri]; ok {
		return &staticFile{
			Reader: bytes.NewReader([]byte(status)),
			name:   pathBase(uri.Path()),
			size:   int64(len(status)),
		}, nil
	}
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

type staticFile struct {
	*bytes.Reader
	name string
	size int64
}

func (f *staticFile) Write(p []byte) (int, error) {
	return 0, os.ErrInvalid
}

func (f *staticFile) Close() error {
	return nil
}

func (f *staticFile) Stat() (os.FileInfo, error) {
	return newFileInfo(f.name, &vfs.Node{Name: f.name, Size: f.size}), nil
}

func pathBase(value string) string {
	if value == "" || value == "/" {
		return "/"
	}
	index := len(value) - 1
	for index > 0 && value[index] == '/' {
		index--
	}
	end := index + 1
	for index >= 0 && value[index] != '/' {
		index--
	}
	return value[index+1 : end]
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

func TestRootAdapterListsScopesAndConnections(t *testing.T) {
	frontend := &fakeFrontend{statuses: map[common.CanonURI]string{
		mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@1/status.json"):       `{"status":"active","ready":true}`,
		mustURI(t, "scopes@scopes[system]:///scopes/system/connections/scopes@scopes/status.json"): `{"status":"active","ready":true}`,
	}}
	adapter, err := NewWebDAVRootAdapter(frontend, vfs.Actor{Kind: vfs.ActorUser, ID: "1"}, mustURI(t, "scopes@scopes[system]:///"))
	if err != nil {
		t.Fatalf("NewWebDAVRootAdapter() error = %v", err)
	}

	root, err := adapter.OpenFile(context.Background(), "/", os.O_RDONLY, 0)
	if err != nil {
		t.Fatalf("OpenFile(/) error = %v", err)
	}
	rootEntries, err := root.Readdir(0)
	if err != nil {
		t.Fatalf("root Readdir() error = %v", err)
	}
	if got, want := names(rootEntries), []string{".system", "debug"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("root entries = %+v, want %+v", got, want)
	}

	scopeDir, err := adapter.OpenFile(context.Background(), "/.system", os.O_RDONLY, 0)
	if err != nil {
		t.Fatalf("OpenFile(/system) error = %v", err)
	}
	scopeEntries, err := scopeDir.Readdir(0)
	if err != nil {
		t.Fatalf("scope Readdir() error = %v", err)
	}
	if got, want := names(scopeEntries), []string{"debug@1", "scopes@scopes"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("scope entries = %+v, want %+v", got, want)
	}
}

func TestRootAdapterStatsConnectionMountThroughScopesProvider(t *testing.T) {
	frontend := &fakeFrontend{statuses: map[common.CanonURI]string{
		mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@1/status.json"): `{"status":"active","ready":true}`,
	}}
	adapter, err := NewWebDAVRootAdapter(frontend, vfs.Actor{Kind: vfs.ActorUser, ID: "1"}, mustURI(t, "scopes@scopes[system]:///"))
	if err != nil {
		t.Fatalf("NewWebDAVRootAdapter() error = %v", err)
	}

	info, err := adapter.Stat(context.Background(), "/.system/debug@1")
	if err != nil {
		t.Fatalf("Stat(connection mountpoint) error = %v", err)
	}
	if info.Name() != "debug@1" || !info.IsDir() {
		t.Fatalf("Stat(connection mountpoint) = %+v, want debug@1 dir", info)
	}

	want := []common.CanonURI{
		mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@1"),
		mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@1/status.json"),
	}
	if !reflect.DeepEqual(frontend.seen, want) {
		t.Fatalf("seen URIs = %#v, want %#v", frontend.seen, want)
	}
}

func TestRootAdapterHidesInactiveConnectionMount(t *testing.T) {
	frontend := &fakeFrontend{statuses: map[common.CanonURI]string{
		mustURI(t, "scopes@scopes[system]:///scopes/system/connections/debug@1/status.json"):       `{"status":"inactive","ready":false}`,
		mustURI(t, "scopes@scopes[system]:///scopes/system/connections/scopes@scopes/status.json"): `{"status":"active","ready":true}`,
	}}
	adapter, err := NewWebDAVRootAdapter(frontend, vfs.Actor{Kind: vfs.ActorUser, ID: "1"}, mustURI(t, "scopes@scopes[system]:///"))
	if err != nil {
		t.Fatalf("NewWebDAVRootAdapter() error = %v", err)
	}

	scopeDir, err := adapter.OpenFile(context.Background(), "/.system", os.O_RDONLY, 0)
	if err != nil {
		t.Fatalf("OpenFile(/.system) error = %v", err)
	}
	scopeEntries, err := scopeDir.Readdir(0)
	if err != nil {
		t.Fatalf("scope Readdir() error = %v", err)
	}
	if got, want := names(scopeEntries), []string{"scopes@scopes"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("scope entries = %+v, want %+v", got, want)
	}

	if _, err := adapter.Stat(context.Background(), "/.system/debug@1"); !errorsIsNotExist(err) {
		t.Fatalf("Stat(inactive connection) error = %v, want not exist", err)
	}
}

func TestRootAdapterTranslatesMountedPathToCanonURI(t *testing.T) {
	frontend := &fakeFrontend{}
	adapter, err := NewWebDAVRootAdapter(frontend, vfs.Actor{Kind: vfs.ActorUser, ID: "1"}, mustURI(t, "scopes@scopes[system]:///"))
	if err != nil {
		t.Fatalf("NewWebDAVRootAdapter() error = %v", err)
	}

	if _, err := adapter.Stat(context.Background(), "/.system/scopes@scopes/info.json"); err != nil {
		t.Fatalf("Stat(mapped path) error = %v", err)
	}

	want := []common.CanonURI{
		mustURI(t, "scopes@scopes[system]:///info.json"),
	}
	if !reflect.DeepEqual(frontend.seen, want) {
		t.Fatalf("seen URIs = %#v, want %#v", frontend.seen, want)
	}
}

func names(infos []os.FileInfo) []string {
	out := make([]string, 0, len(infos))
	for _, info := range infos {
		out = append(out, info.Name())
	}
	return out
}

func errorsIsNotExist(err error) bool {
	return err != nil && os.IsNotExist(err)
}

func mustURI(t *testing.T, raw string) common.CanonURI {
	t.Helper()
	uri, err := common.CastURI(raw)
	if err != nil {
		t.Fatalf("CastURI(%q) error = %v", raw, err)
	}
	return uri
}

func mustURINoT(raw string) common.CanonURI {
	uri, err := common.CastURI(raw)
	if err != nil {
		panic(err)
	}
	return uri
}
