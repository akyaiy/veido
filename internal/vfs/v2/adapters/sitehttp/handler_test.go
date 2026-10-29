package sitehttp

import (
	"github.com/akyaiy/veido/internal/vfs/v2/providers/html/hooks/getstatic"
	"github.com/akyaiy/veido/pkg/vfs"
	"github.com/akyaiy/veido/pkg/vfs/hooks"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

type runtimeCall struct {
	actor vfs.Actor
	uri   vfs.URI
	hook  string
	path  string
}

type fakeRuntime struct {
	calls        []runtimeCall
	staticOutput getstatic.Output
	err          error
}

func (f *fakeRuntime) Run(_ context.Context, actor vfs.Actor, hook string, input json.RawMessage, _ hooks.RunOptions) (hooks.Result, error) {
	var decoded getstatic.Input
	if err := json.Unmarshal(input, &decoded); err != nil {
		return hooks.Result{}, err
	}
	f.calls = append(f.calls, runtimeCall{actor: actor, uri: decoded.SiteURI, hook: hook, path: decoded.Path})
	if f.err != nil {
		return hooks.Result{}, f.err
	}
	data, err := json.Marshal(f.staticOutput)
	return hooks.Result{Hook: hook, Version: 1, Status: "completed", Output: data}, err
}

var errorsUnsupported = &hooks.RunError{Code: "unsupported", Cause: "unsupported", Message: "unsupported"}

func TestSiteRoutesServeOnlyEntrypointAndVersionedStatic(t *testing.T) {
	siteURI, err := vfs.ParseURI("html@site[acme]:///")
	if err != nil {
		t.Fatal(err)
	}
	runtime := &fakeRuntime{staticOutput: getstatic.Output{Content: []byte("<html>site</html>"), ContentType: "text/html; charset=utf-8", Size: 17, ETag: `"sha256-a"`, CacheControl: "no-cache", Entrypoint: true}}
	handler, err := NewHandler(runtime, func(*http.Request) (vfs.Actor, error) {
		return vfs.Actor{Kind: vfs.ActorUser, ID: "alice"}, nil
	}, Config{SiteURI: siteURI, Entrypoint: "index.html"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	RegisterRoutes(router, handler)

	root := httptest.NewRecorder()
	router.ServeHTTP(root, httptest.NewRequest(http.MethodGet, "/", nil))
	if root.Code != http.StatusOK || root.Body.String() != "<html>site</html>" || root.Header().Get("Content-Type") != "text/html; charset=utf-8" || root.Header().Get("ETag") != `"sha256-a"` {
		t.Fatalf("root response: status=%d headers=%v body=%q", root.Code, root.Header(), root.Body.String())
	}
	if len(runtime.calls) != 1 || runtime.calls[0].uri != siteURI || runtime.calls[0].hook != getstatic.HookKey || runtime.calls[0].path != "index.html" {
		t.Fatalf("root hook calls = %+v", runtime.calls)
	}

	runtime.staticOutput = getstatic.Output{Content: []byte("console.log(1)"), ContentType: "application/javascript; charset=utf-8", Size: 14, ETag: `"sha256-b"`, CacheControl: "no-cache"}
	asset := httptest.NewRecorder()
	router.ServeHTTP(asset, httptest.NewRequest(http.MethodGet, "/_static/js/app.js", nil))
	if asset.Code != http.StatusOK || asset.Body.String() != "console.log(1)" || asset.Header().Get("Cache-Control") != "no-cache" || runtime.calls[1].path != "js/app.js" {
		t.Fatalf("asset response: status=%d headers=%v body=%q calls=%+v", asset.Code, asset.Header(), asset.Body.String(), runtime.calls)
	}
	runtime.staticOutput = getstatic.Output{Content: []byte(`{"scope":"acme"}`), ContentType: "application/json; charset=utf-8", Size: 16, ETag: `"sha256-context"`, CacheControl: "no-cache"}
	contextAsset := httptest.NewRecorder()
	router.ServeHTTP(contextAsset, httptest.NewRequest(http.MethodGet, "/_static/site-context.json", nil))
	if contextAsset.Code != http.StatusOK || contextAsset.Body.String() != `{"scope":"acme"}` || runtime.calls[2].path != "site-context.json" {
		t.Fatalf("static site context: status=%d body=%q calls=%+v", contextAsset.Code, contextAsset.Body.String(), runtime.calls)
	}

	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/_static", nil))
	if missing.Code != http.StatusNotFound || len(runtime.calls) != 3 {
		t.Fatalf("empty static path: status=%d calls=%+v", missing.Code, runtime.calls)
	}
	runtime.staticOutput = getstatic.Output{Content: []byte("<html>shell</html>"), ContentType: "text/html; charset=utf-8", Size: 18, ETag: `"sha256-shell"`, CacheControl: "no-cache", Entrypoint: true}
	page := httptest.NewRecorder()
	router.ServeHTTP(page, httptest.NewRequest(http.MethodGet, "/docs/install", nil))
	if page.Code != http.StatusOK || page.Body.String() != "<html>shell</html>" || len(runtime.calls) != 4 || runtime.calls[3].hook != getstatic.HookKey || runtime.calls[3].path != "index.html" {
		t.Fatalf("browser route response: status=%d body=%q calls=%+v", page.Code, page.Body.String(), runtime.calls)
	}
	unknown := httptest.NewRecorder()
	router.ServeHTTP(unknown, httptest.NewRequest(http.MethodGet, "/unknown/page", nil))
	if unknown.Code != http.StatusOK || unknown.Body.String() != "<html>shell</html>" || len(runtime.calls) != 5 || runtime.calls[4].hook != getstatic.HookKey || runtime.calls[4].path != "index.html" {
		t.Fatalf("unknown browser route response: status=%d body=%q calls=%+v", unknown.Code, unknown.Body.String(), runtime.calls)
	}
}
