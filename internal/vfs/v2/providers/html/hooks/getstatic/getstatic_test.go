package getstatic

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
	"io"
	"strings"
	"sync"
	"testing"
)

type staticCall struct {
	op    string
	actor vfs.Actor
	uri   vfs.URI
}

type staticFrontend struct {
	mu          sync.Mutex
	versions    []*vfs.Node
	versionsErr error
	manifest    []byte
	manifestErr error
	asset       []byte
	assetErr    error
	calls       []staticCall
}

func (f *staticFrontend) record(op string, actor vfs.Actor, uri vfs.URI) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, staticCall{op: op, actor: actor, uri: uri})
}
func (f *staticFrontend) snapshot() []staticCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]staticCall(nil), f.calls...)
}
func (f *staticFrontend) Stat(_ context.Context, actor vfs.Actor, uri vfs.URI) (*vfs.Node, error) {
	f.record("stat", actor, uri)
	return nil, vfs.ErrUnsupported
}
func (f *staticFrontend) OpenFile(ctx context.Context, actor vfs.Actor, uri vfs.URI, _ int) (vfs.File, error) {
	f.record("open", actor, uri)
	data := f.asset
	name := "asset"
	if strings.HasSuffix(uri.Path(), "/manifest.json") {
		if f.manifestErr != nil {
			return nil, f.manifestErr
		}
		data = f.manifest
		name = "manifest.json"
	} else if f.assetErr != nil {
		return nil, f.assetErr
	}
	return sdk.ReadFile(ctx, sdk.FileNode(name, int64(len(data))), io.NopCloser(bytes.NewReader(data))), nil
}
func (f *staticFrontend) ReadDir(_ context.Context, actor vfs.Actor, uri vfs.URI) ([]*vfs.Node, error) {
	f.record("read_dir", actor, uri)
	if f.versionsErr != nil {
		return nil, f.versionsErr
	}
	if f.versions == nil {
		return []*vfs.Node{{Name: "1", Kind: "application_template", IsDir: true}}, nil
	}
	return f.versions, nil
}
func (f *staticFrontend) Mkdir(context.Context, vfs.Actor, vfs.URI) (*vfs.Node, error) {
	return nil, vfs.ErrUnsupported
}
func (f *staticFrontend) Move(context.Context, vfs.Actor, vfs.URI, vfs.URI) error {
	return vfs.ErrUnsupported
}
func (f *staticFrontend) Delete(context.Context, vfs.Actor, vfs.URI) error {
	return vfs.ErrUnsupported
}
func (f *staticFrontend) Control(context.Context, vfs.Actor, vfs.URI, string, []byte) ([]byte, error) {
	return nil, vfs.ErrUnsupported
}

func TestGetStaticResolvesOnlyManifestAssetWithOriginalActor(t *testing.T) {
	index := []byte("<html>hello</html>")
	manifest := testManifest(t, []manifestAsset{
		testAsset("index.html", "text/html; charset=utf-8", index),
		testAsset("js/app.js", "application/javascript; charset=utf-8", []byte("console.log('hello')")),
	})
	frontend := &staticFrontend{manifest: manifest, asset: index}
	runtime := testRuntime(t, frontend)
	actor := vfs.Actor{Kind: vfs.ActorGuest}
	result, err := runtime.Run(context.Background(), actor, HookKey, staticInput(t, "index.html"), hooks.RunOptions{IdempotencyKey: "root-1"})
	if err != nil {
		t.Fatal(err)
	}
	var output Output
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	digest := digestFor(index)
	if !bytes.Equal(output.Content, index) || output.ContentType != "text/html; charset=utf-8" || output.Digest != digest || output.Size != int64(len(index)) || output.CacheControl != "no-cache" || !output.Entrypoint || output.ETag != `"sha256-`+digest+`"` || output.TemplateKey != "default-spa" || output.Version != "1" {
		t.Fatalf("get-static output = %+v", output)
	}
	calls := frontend.snapshot()
	if len(calls) != 3 || calls[0].op != "read_dir" || calls[0].uri != mustURI(t, "html@site[site-acme]:///templates/default-spa") || calls[1].op != "open" || calls[1].uri != mustURI(t, "html@site[site-acme]:///templates/default-spa/1/manifest.json") || calls[2].op != "open" || calls[2].uri != mustURI(t, "html@site[site-acme]:///templates/default-spa/1/files/index.html") {
		t.Fatalf("VFS calls = %+v", calls)
	}
	for _, call := range calls {
		if call.actor != actor {
			t.Fatalf("VFS actor = %+v, want %+v", call.actor, actor)
		}
	}
	if _, err := runtime.Run(context.Background(), actor, HookKey, staticInput(t, "index.html"), hooks.RunOptions{IdempotencyKey: "root-1"}); err != nil {
		t.Fatal(err)
	}
	if len(frontend.snapshot()) != 3 {
		t.Fatal("idempotent get-static repeated VFS operations")
	}
}

func TestGetStaticRejectsMissingTraversalAndACLDenial(t *testing.T) {
	index := []byte("<html>hello</html>")
	manifest := testManifest(t, []manifestAsset{testAsset("index.html", "text/html", index)})
	actor := vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}

	t.Run("missing is not entrypoint fallback", func(t *testing.T) {
		frontend := &staticFrontend{manifest: manifest, asset: index}
		_, err := testRuntime(t, frontend).Run(context.Background(), actor, HookKey, staticInput(t, "js/missing.js"), hooks.RunOptions{})
		assertRunCause(t, err, "not_found", "resolve-template-asset")
		if calls := frontend.snapshot(); len(calls) != 2 || calls[0].op != "read_dir" || calls[1].op != "open" {
			t.Fatalf("missing asset calls = %+v", calls)
		}
	})

	t.Run("traversal", func(t *testing.T) {
		frontend := &staticFrontend{manifest: manifest, asset: index}
		_, err := testRuntime(t, frontend).Run(context.Background(), actor, HookKey, staticInput(t, "../secret"), hooks.RunOptions{})
		assertRunCause(t, err, "invalid_argument", "")
		if len(frontend.snapshot()) != 0 {
			t.Fatal("traversal reached VFS")
		}
	})

	t.Run("ACL denial", func(t *testing.T) {
		frontend := &staticFrontend{manifest: manifest, manifestErr: vfs.ErrPermissionDenied, asset: index}
		_, err := testRuntime(t, frontend).Run(context.Background(), actor, HookKey, staticInput(t, "index.html"), hooks.RunOptions{})
		assertRunCause(t, err, "permission_denied", "read-template-manifest")
	})

	t.Run("asset ACL denial", func(t *testing.T) {
		frontend := &staticFrontend{manifest: manifest, assetErr: vfs.ErrPermissionDenied}
		_, err := testRuntime(t, frontend).Run(context.Background(), actor, HookKey, staticInput(t, "index.html"), hooks.RunOptions{})
		assertRunCause(t, err, "permission_denied", "read-template-asset")
	})
}

func TestGetStaticRejectsManifestIdentityAndUnknownFields(t *testing.T) {
	index := []byte("<html>hello</html>")
	manifest := testManifest(t, []manifestAsset{testAsset("index.html", "text/html", index)})
	manifest = bytes.Replace(manifest, []byte(`"version": "1"`), []byte(`"version": "2"`), 1)
	frontend := &staticFrontend{manifest: manifest, asset: index}
	_, err := testRuntime(t, frontend).Run(context.Background(), vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}, HookKey, staticInput(t, "index.html"), hooks.RunOptions{})
	assertRunCause(t, err, "failed_precondition", "validate-template-manifest")
}

func TestGetStaticRejectsAssetContentThatDoesNotMatchManifest(t *testing.T) {
	expected := []byte("expected")
	manifest := testManifest(t, []manifestAsset{testAsset("index.html", "text/html", expected)})
	frontend := &staticFrontend{manifest: manifest, asset: []byte("tampered")}
	_, err := testRuntime(t, frontend).Run(context.Background(), vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}, HookKey, staticInput(t, "index.html"), hooks.RunOptions{})
	assertRunCause(t, err, "failed_precondition", "verify-template-asset")
}

func TestGetStaticUsesLastInstalledTemplateVersion(t *testing.T) {
	index := []byte("<html>latest</html>")
	manifest := bytes.Replace(testManifest(t, []manifestAsset{testAsset("index.html", "text/html", index)}), []byte(`"version": "1"`), []byte(`"version": "2"`), 1)
	frontend := &staticFrontend{
		versions: []*vfs.Node{
			{Name: "9", Kind: "application_template", IsDir: true},
			{Name: "2", Kind: "application_template", IsDir: true},
		},
		manifest: manifest,
		asset:    index,
	}
	result, err := testRuntime(t, frontend).Run(context.Background(), vfs.Actor{Kind: vfs.ActorGuest}, HookKey, staticInput(t, "index.html"), hooks.RunOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var output Output
	if err := json.Unmarshal(result.Output, &output); err != nil {
		t.Fatal(err)
	}
	if output.Version != "2" {
		t.Fatalf("template version = %q, want last installed version 2", output.Version)
	}
	calls := frontend.snapshot()
	if len(calls) != 3 || !strings.Contains(string(calls[1].uri), "/default-spa/2/manifest.json") || !strings.Contains(string(calls[2].uri), "/default-spa/2/files/index.html") {
		t.Fatalf("VFS calls = %+v", calls)
	}
}

func testRuntime(t *testing.T, frontend vfs.Frontend) hooks.Runtime {
	t.Helper()
	registry := hooks.NewRegistry(hooks.DefaultEngines())
	if err := Register(registry); err != nil {
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

func staticInput(t *testing.T, assetPath string) json.RawMessage {
	t.Helper()
	data, err := json.Marshal(Input{SiteURI: mustURI(t, "html@site[site-acme]:///"), TemplateKey: "default-spa", Path: assetPath})
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func testManifest(t *testing.T, assets []manifestAsset) []byte {
	t.Helper()
	data, err := json.MarshalIndent(templateManifest{SchemaVersion: 1, TemplateKey: "default-spa", Version: "1", Entrypoint: "index.html", PackageDigest: strings.Repeat("c", 64), Assets: assets}, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func testAsset(path, contentType string, data []byte) manifestAsset {
	return manifestAsset{Path: path, ContentType: contentType, Digest: digestFor(data), Size: int64(len(data))}
}

func digestFor(data []byte) string {
	digest := sha256.Sum256(data)
	return hex.EncodeToString(digest[:])
}

func assertRunCause(t *testing.T, err error, cause, step string) {
	t.Helper()
	var runErr *hooks.RunError
	if !errors.As(err, &runErr) || runErr.Cause != cause || (step != "" && runErr.FailedStep != step) {
		t.Fatalf("run error = %#v, %v; want cause=%q step=%q", runErr, err, cause, step)
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
