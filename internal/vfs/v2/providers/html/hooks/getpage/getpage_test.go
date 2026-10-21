package getpage

import (
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	sdk "MyServer/pkg/vfs/providersdk"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"testing"
)

type call struct {
	actor vfs.Actor
	uri   vfs.URI
}

type frontend struct {
	mu    sync.Mutex
	files map[string][]byte
	calls []call
}

func (f *frontend) OpenFile(ctx context.Context, actor vfs.Actor, uri vfs.URI, _ int) (vfs.File, error) {
	f.mu.Lock()
	f.calls = append(f.calls, call{actor: actor, uri: uri})
	f.mu.Unlock()
	data, ok := f.files[string(uri)]
	if !ok {
		return nil, vfs.ErrNotFound
	}
	return sdk.ReadFile(ctx, sdk.FileNode(pathName(uri.Path()), int64(len(data))), io.NopCloser(bytes.NewReader(data))), nil
}
func (f *frontend) Stat(context.Context, vfs.Actor, vfs.URI) (*vfs.Node, error) {
	return nil, vfs.ErrUnsupported
}
func (f *frontend) ReadDir(_ context.Context, actor vfs.Actor, uri vfs.URI) ([]*vfs.Node, error) {
	f.mu.Lock()
	f.calls = append(f.calls, call{actor: actor, uri: uri})
	f.mu.Unlock()
	return []*vfs.Node{{Name: "1", Kind: "application_template", IsDir: true}}, nil
}
func (f *frontend) Mkdir(context.Context, vfs.Actor, vfs.URI) (*vfs.Node, error) {
	return nil, vfs.ErrUnsupported
}
func (f *frontend) Move(context.Context, vfs.Actor, vfs.URI, vfs.URI) error {
	return vfs.ErrUnsupported
}
func (f *frontend) Delete(context.Context, vfs.Actor, vfs.URI) error { return vfs.ErrUnsupported }
func (f *frontend) Control(context.Context, vfs.Actor, vfs.URI, string, []byte) ([]byte, error) {
	return nil, vfs.ErrUnsupported
}

func TestGetPageResolvesNestedSlugPathAndReturnsEntrypoint(t *testing.T) {
	siteURI := mustURI(t, "html@site[site-acme]:///")
	index := []byte("<html>app</html>")
	digest := sha256.Sum256(index)
	digestText := hex.EncodeToString(digest[:])
	tree := []byte(`{"tree_revision":3,"model_revision":4,"visibility_revision":2,"pages":[{"id":1,"page_key":"docs","slug":"docs","title":"Docs","status":"ready","position":0,"revision":1,"children":[{"id":2,"page_key":"install","slug":"install","title":"Install","status":"ready","position":0,"revision":1,"children":[]}]}]}`)
	manifest := []byte(`{"schema_version":1,"template_key":"default-spa","version":"1","entrypoint":"index.html","package_digest":"` + strings.Repeat("a", 64) + `","assets":[{"path":"index.html","content_type":"text/html; charset=utf-8","digest":"` + digestText + `","size":` + stringInt(len(index)) + `}]}`)
	f := &frontend{files: map[string][]byte{
		"html@site[site-acme]:///tree.json":                                tree,
		"html@site[site-acme]:///site.json":                                []byte(`{"name":"Acme"}`),
		"html@site[site-acme]:///pages/install/info.json":                  []byte(`{"page_key":"install","bundle_root_uri":"demo@files[site-acme]:///content/install"}`),
		"html@site[site-acme]:///templates/default-spa/1/manifest.json":    manifest,
		"html@site[site-acme]:///templates/default-spa/1/files/index.html": index,
	}}
	runtime := newRuntime(t, f)
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}
	result, err := runtime.Run(context.Background(), actor, HookKey, pageInput(t, siteURI, "/docs/install"), hooks.RunOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var output Output
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	if !output.Found || output.Route != "/docs/install" || output.PageKey != "install" || output.Bootstrap.SiteURI != string(siteURI) || output.Bootstrap.SiteName != "Acme" || output.Bootstrap.PageTitle != "Install" || output.Bootstrap.BundleRootURI != "demo@files[site-acme]:///content/install" || !bytes.Equal(output.Content, index) || !output.Entrypoint {
		t.Fatalf("output = %+v", output)
	}
	if len(f.calls) != 6 {
		t.Fatalf("VFS calls = %+v", f.calls)
	}
	for _, got := range f.calls {
		if got.actor != actor {
			t.Fatalf("actor = %+v, want %+v", got.actor, actor)
		}
	}
}

func TestGetPageReturnsNotFoundAndRejectsInvalidRoutes(t *testing.T) {
	siteURI := mustURI(t, "html@site[site-acme]:///")
	f := &frontend{files: map[string][]byte{
		"html@site[site-acme]:///tree.json": []byte(`{"tree_revision":1,"model_revision":1,"visibility_revision":1,"pages":[]}`),
	}}
	runtime := newRuntime(t, f)
	actor := vfs.Actor{Kind: vfs.ActorGuest}

	result, err := runtime.Run(context.Background(), actor, HookKey, pageInput(t, siteURI, "/missing/child"), hooks.RunOptions{})
	if err != nil {
		t.Fatalf("unknown route returned hook error: %v", err)
	}
	var output Output
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	if output.Found || output.Code != NotFoundCode || output.Route != "/missing/child" || output.PageKey != "" || len(output.Content) != 0 {
		t.Fatalf("unknown route output = %+v", output)
	}
	if bytes.Contains(result.Output, []byte(`"content"`)) || bytes.Contains(result.Output, []byte(`"bootstrap"`)) {
		t.Fatalf("unknown route output contains irrelevant fields: %s", result.Output)
	}
	before := len(f.calls)
	_, err = runtime.Run(context.Background(), actor, HookKey, pageInput(t, siteURI, "/docs/../secret"), hooks.RunOptions{})
	assertCause(t, err, "invalid_argument", "")
	if len(f.calls) != before {
		t.Fatal("invalid route reached VFS")
	}
}

func TestResolveExposesOnlyReadyPageChains(t *testing.T) {
	pages := []treePage{
		{PageKey: "ready", Slug: "ready", Status: "ready"},
		{PageKey: "draft", Slug: "draft", Status: "draft"},
		{PageKey: "hidden", Slug: "hidden", Status: "hidden"},
		{PageKey: "archived", Slug: "archived", Status: "archived"},
		{PageKey: "draft-parent", Slug: "draft-parent", Status: "draft", Children: []treePage{{PageKey: "ready-child", Slug: "child", Status: "ready"}}},
	}
	if page, found := resolve(pages, []string{"ready"}); !found || page.PageKey != "ready" {
		t.Fatalf("ready route = %+v, found=%v", page, found)
	}
	for _, route := range [][]string{{"draft"}, {"hidden"}, {"archived"}, {"draft-parent", "child"}} {
		if page, found := resolve(pages, route); found {
			t.Errorf("inactive route %v resolved to %+v", route, page)
		}
	}
}

func newRuntime(t *testing.T, frontend vfs.Frontend) hooks.Runtime {
	t.Helper()
	registry := hooks.NewRegistry(hooks.DefaultEngines())
	if err := registry.Register(Definition()); err != nil {
		t.Fatal(err)
	}
	if err := registry.Freeze(context.Background()); err != nil {
		t.Fatal(err)
	}
	runtime, err := hooks.NewRuntime(registry, frontend, hooks.NewMemoryExecutionStore())
	if err != nil {
		t.Fatal(err)
	}
	return runtime
}

func pageInput(t *testing.T, siteURI vfs.URI, route string) json.RawMessage {
	t.Helper()
	data, err := json.Marshal(Input{SiteURI: siteURI, TemplateKey: "default-spa", Path: route})
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func assertCause(t *testing.T, err error, cause, step string) {
	t.Helper()
	var runErr *hooks.RunError
	if !errors.As(err, &runErr) || runErr.Cause != cause || runErr.FailedStep != step {
		t.Fatalf("error = %#v, want cause=%q step=%q", err, cause, step)
	}
}

func mustURI(t *testing.T, raw string) vfs.URI {
	t.Helper()
	uri, err := vfs.ParseURI(raw)
	if err != nil {
		t.Fatal(err)
	}
	return uri
}

func pathName(value string) string {
	parts := strings.Split(strings.TrimSuffix(value, "/"), "/")
	return parts[len(parts)-1]
}

func stringInt(value int) string {
	return fmt.Sprintf("%d", value)
}
