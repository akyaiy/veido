package sitehttp

import (
	"MyServer/internal/vfs/v2/providers/html/hooks/getpage"
	"MyServer/internal/vfs/v2/providers/html/hooks/getstatic"
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
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
	pageOutput   getpage.Output
	err          error
}

func (f *fakeRuntime) Run(context.Context, vfs.Actor, string, json.RawMessage, hooks.RunOptions) (hooks.Result, error) {
	return hooks.Result{}, errorsUnsupported
}
func (f *fakeRuntime) RunBinding(context.Context, vfs.Actor, string, json.RawMessage, hooks.RunOptions) (hooks.Result, error) {
	return hooks.Result{}, errorsUnsupported
}
func (f *fakeRuntime) RunResource(_ context.Context, actor vfs.Actor, uri vfs.URI, hook string, input json.RawMessage, _ hooks.RunOptions) (hooks.Result, error) {
	var decoded getstatic.Input
	if err := json.Unmarshal(input, &decoded); err != nil {
		return hooks.Result{}, err
	}
	f.calls = append(f.calls, runtimeCall{actor: actor, uri: uri, hook: hook, path: decoded.Path})
	if f.err != nil {
		return hooks.Result{}, f.err
	}
	output := any(f.staticOutput)
	if hook == getpage.HookKey {
		output = f.pageOutput
	}
	data, err := json.Marshal(output)
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

	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/_static", nil))
	if missing.Code != http.StatusNotFound || len(runtime.calls) != 2 {
		t.Fatalf("empty static path: status=%d calls=%+v", missing.Code, runtime.calls)
	}
	pageHTML := []byte("<html><head></head><body>site</body></html>")
	runtime.pageOutput = getpage.Output{
		Output: getstatic.Output{Content: pageHTML, ContentType: "text/html; charset=utf-8", Size: int64(len(pageHTML)), ETag: `"sha256-a"`, CacheControl: "no-cache", Entrypoint: true},
		Route:  "/docs/install", Found: true, PageKey: "install",
		Bootstrap: getpage.Bootstrap{Route: "/docs/install", SiteName: "Acme", PageKey: "install", PageTitle: "Install", BundleRootURI: "demo@files[acme]:///content/install"},
	}
	page := httptest.NewRecorder()
	router.ServeHTTP(page, httptest.NewRequest(http.MethodGet, "/docs/install", nil))
	if page.Code != http.StatusOK || !strings.Contains(page.Body.String(), `id="html-page-bootstrap"`) || !strings.Contains(page.Body.String(), `"bundle_root_uri":"demo@files[acme]:///content/install"`) || len(runtime.calls) != 3 || runtime.calls[2].hook != getpage.HookKey || runtime.calls[2].path != "/docs/install" {
		t.Fatalf("page response: status=%d body=%q calls=%+v", page.Code, page.Body.String(), runtime.calls)
	}
	digest := sha256.Sum256(page.Body.Bytes())
	if page.Header().Get("ETag") != `"sha256-`+hex.EncodeToString(digest[:])+`"` || page.Header().Get("Content-Length") != strconv.Itoa(page.Body.Len()) {
		t.Fatalf("adapted page validators: headers=%v", page.Header())
	}

	runtime.pageOutput = getpage.Output{Route: "/unknown/page", Found: false, Code: getpage.NotFoundCode}
	unknown := httptest.NewRecorder()
	router.ServeHTTP(unknown, httptest.NewRequest(http.MethodGet, "/unknown/page", nil))
	if unknown.Code != http.StatusNotFound || !strings.Contains(unknown.Body.String(), `"code":"page_not_found"`) || runtime.calls[len(runtime.calls)-1].hook != getpage.HookKey {
		t.Fatalf("unknown browser path status=%d body=%q calls=%+v", unknown.Code, unknown.Body.String(), runtime.calls)
	}

	browserRequest := httptest.NewRequest(http.MethodGet, "/unknown/page", nil)
	browserRequest.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	browser := httptest.NewRecorder()
	router.ServeHTTP(browser, browserRequest)
	if browser.Code != http.StatusNotFound || !strings.Contains(browser.Header().Get("Content-Type"), "text/html") || browser.Header().Get("Vary") != "Accept" || !strings.Contains(browser.Body.String(), "Страница не найдена") || strings.Contains(browser.Body.String(), `"error"`) {
		t.Fatalf("unknown browser navigation: status=%d headers=%v body=%q", browser.Code, browser.Header(), browser.Body.String())
	}
}

func TestAcceptsHTMLRequiresExplicitBrowserRepresentation(t *testing.T) {
	tests := []struct {
		accept string
		want   bool
	}{
		{"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", true},
		{"text/html;q=0.5,application/json;q=0.9", false},
		{"application/json", false},
		{"*/*", false},
		{"", false},
		{"text/html;q=0", false},
	}
	for _, test := range tests {
		if got := acceptsHTML(test.accept); got != test.want {
			t.Errorf("acceptsHTML(%q) = %v, want %v", test.accept, got, test.want)
		}
	}
}

func TestEmbedBootstrapEscapesHTMLAndRebuildsValidator(t *testing.T) {
	input := getstatic.Output{Content: []byte("<html><head></head></html>"), Size: 26, ETag: `"old"`}
	output, err := embedBootstrap(input, getpage.Bootstrap{Route: "/docs", SiteName: "</script><script>alert(1)</script>", PageKey: "docs", PageTitle: "Docs", BundleRootURI: "demo@files[acme]:///content/docs"})
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(output.Content, []byte("</script><script>alert(1)</script>")) || !bytes.Contains(output.Content, []byte(`\u003c/script\u003e`)) {
		t.Fatalf("unsafe embedded bootstrap: %s", output.Content)
	}
	if output.Size != int64(len(output.Content)) || output.ETag == input.ETag || output.Digest == "" {
		t.Fatalf("adapted output = %+v", output)
	}
}
