package main

import (
	"MyServer/internal/database/schema"
	"MyServer/internal/sqliteDB"
	vfs "MyServer/internal/vfs/v2"
	htmlprovider "MyServer/internal/vfs/v2/providers/html"
	"MyServer/internal/vfs/v2/providers/html/hooks/getstatic"
	localprovider "MyServer/internal/vfs/v2/providers/local"
	"MyServer/pkg/vfs/hooks"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestDemoSeedsHTMLPageAndApplicationTemplateIdempotently(t *testing.T) {
	db := openDemoDatabase(t)
	defer db.Close()
	if err := seedConnections(db); err != nil {
		t.Fatal(err)
	}
	hookRegistry := hooks.NewRegistry(hooks.DefaultEngines())
	frontend, err := newDemoVFS(db, filepath.Join(t.TempDir(), "content"), hookRegistry)
	if err != nil {
		t.Fatal(err)
	}
	if err := seedDemoContent(context.Background(), frontend); err != nil {
		t.Fatal(err)
	}
	if err := seedDemoContent(context.Background(), frontend); err != nil {
		t.Fatalf("second content seed: %v", err)
	}
	if err := seedHTMLPage(context.Background(), frontend); err != nil {
		t.Fatal(err)
	}
	if err := seedApplicationTemplate(context.Background(), frontend, frontendSourceDir(t)); err != nil {
		t.Fatal(err)
	}
	if err := seedHTMLPage(context.Background(), frontend); err != nil {
		t.Fatalf("second seed: %v", err)
	}
	if err := seedApplicationTemplate(context.Background(), frontend, frontendSourceDir(t)); err != nil {
		t.Fatalf("second template seed: %v", err)
	}

	var connections int
	if err := db.QueryRow(`SELECT COUNT(*) FROM vfs_provider_connections WHERE scope_key = ? AND provider = 'html'`, demoScope).Scan(&connections); err != nil {
		t.Fatal(err)
	}
	var pages int
	if err := db.QueryRow(`SELECT COUNT(*) FROM html_pages`).Scan(&pages); err != nil {
		t.Fatal(err)
	}
	if connections != 1 || pages != 2 {
		t.Fatalf("HTML connections=%d pages=%d, want 1/2", connections, pages)
	}
	var templates int
	if err := db.QueryRow(`SELECT COUNT(*) FROM html_template_packages`).Scan(&templates); err != nil {
		t.Fatal(err)
	}
	if templates != 1 {
		t.Fatalf("application templates=%d, want 1", templates)
	}
	admin := readDemoDocument(t, frontend, "/templates/default-spa/7/files/js/admin.js")
	if !strings.Contains(admin, `window.VFSv2.control`) || !strings.Contains(admin, `"set-visibility"`) {
		t.Fatal("seeded application template does not contain the site administration client")
	}

	page := readDemoPage(t, frontend)
	if page.PageKey != "home" || page.Title != "Главная" || page.BundleRootURI != fixtureURI("/content/home") {
		t.Fatalf("seeded page = %+v", page)
	}

	hookRuntime, err := newDemoHookRuntime(frontend, hookRegistry)
	if err != nil {
		t.Fatal(err)
	}
	result, err := hookRuntime.RunResource(context.Background(), demoActor, mustURI(htmlURI("/")), getstatic.HookKey, json.RawMessage(`{"path":"index.html"}`), hooks.RunOptions{IdempotencyKey: "demo-index"})
	if err != nil {
		t.Fatal(err)
	}
	var descriptor getstatic.Output
	if err := json.Unmarshal(result.Output, &descriptor); err != nil {
		t.Fatal(err)
	}
	if descriptor.ContentType != "text/html; charset=utf-8" || descriptor.CacheControl != "no-cache" || !descriptor.Entrypoint || descriptor.Version != "7" {
		t.Fatalf("get-static descriptor = %+v", descriptor)
	}
	if !strings.Contains(string(descriptor.Content), "/_static/js/router.js") {
		t.Fatal("get-static did not return the routed application entrypoint content")
	}
}

func readDemoDocument(t *testing.T, frontend vfs.VFSFrontend, resourcePath string) string {
	t.Helper()
	file, err := frontend.OpenFile(context.Background(), demoActor, mustURI(htmlURI(resourcePath)), os.O_RDONLY)
	if err != nil {
		t.Fatal(err)
	}
	data, readErr := io.ReadAll(file)
	if err := errors.Join(readErr, file.Close()); err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func frontendSourceDir(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate test source")
	}
	return filepath.Join(filepath.Dir(file), "..", "..", "data", "HTML", "frontend")
}

func TestDemoHandlerServesUIAssetsAndVFSAPI(t *testing.T) {
	db := openDemoDatabase(t)
	defer db.Close()
	if err := seedConnections(db); err != nil {
		t.Fatal(err)
	}
	hookRegistry := hooks.NewRegistry(hooks.DefaultEngines())
	frontend, err := newDemoVFS(db, filepath.Join(t.TempDir(), "content"), hookRegistry)
	if err != nil {
		t.Fatal(err)
	}
	if err := seedDemoContent(context.Background(), frontend); err != nil {
		t.Fatal(err)
	}
	if err := seedHTMLPage(context.Background(), frontend); err != nil {
		t.Fatal(err)
	}
	if err := seedApplicationTemplate(context.Background(), frontend, frontendSourceDir(t)); err != nil {
		t.Fatal(err)
	}
	hookRuntime, err := newDemoHookRuntime(frontend, hookRegistry)
	if err != nil {
		t.Fatal(err)
	}
	handler, err := newDemoHandler(frontend, hookRuntime)
	if err != nil {
		t.Fatal(err)
	}

	for _, test := range []struct {
		path        string
		contentType string
		contains    string
	}{
		{"/", "text/html", "JWT SPA project"},
		{"/demo", "text/html", "JWT SPA project"},
		{"/_static/css/style.css", "text/css", "body"},
		{"/_static/css/admin.css", "text/css", ".admin-shell"},
		{"/_static/js/router.js", "javascript", `const root = route === "/"`},
		{"/_static/js/admin.js", "javascript", `window.VFSv2.control`},
		{"/_static/js/page.js", "javascript", `html-page-bootstrap`},
		{"/api/v2/vfs/read?uri=" + url.QueryEscape(htmlURI("/pages/home/info.json")), "application/octet-stream", `"page_key": "home"`},
		{"/api/v2/vfs/read?uri=" + url.QueryEscape(fixtureURI("/content/home/content.md")), "application/octet-stream", `<section class="welcome">`},
		{"/api/v2/vfs/read?uri=" + url.QueryEscape(fixtureURI("/content/home/style.css")), "application/octet-stream", "border-left"},
		{"/api/v2/vfs/read?uri=" + url.QueryEscape(fixtureURI("/content/home/script.js")), "application/octet-stream", "data-ready"},
		{"/api/v2/vfs/read?uri=" + url.QueryEscape(fixtureURI("/content/demo/content.md")), "application/octet-stream", "Управление сайтом"},
	} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, test.path, nil))
		if response.Code != http.StatusOK || !strings.Contains(response.Header().Get("Content-Type"), test.contentType) || !strings.Contains(response.Body.String(), test.contains) {
			t.Errorf("GET %s: status=%d content-type=%q body=%q", test.path, response.Code, response.Header().Get("Content-Type"), response.Body.String())
		}
	}
	draftPage := httptest.NewRecorder()
	handler.ServeHTTP(draftPage, httptest.NewRequest(http.MethodGet, "/home", nil))
	if draftPage.Code != http.StatusNotFound || !strings.Contains(draftPage.Body.String(), `"code":"page_not_found"`) {
		t.Fatalf("GET draft /home: status=%d body=%q", draftPage.Code, draftPage.Body.String())
	}

	hookRequest := httptest.NewRequest(http.MethodPost, "/api/v2/vfs/hooks/get-static/run", strings.NewReader(`{"resource_uri":"`+htmlURI("/")+`","input":{"path":"index.html"}}`))
	hookRequest.Header.Set("Idempotency-Key", "http-index")
	hookResponse := httptest.NewRecorder()
	handler.ServeHTTP(hookResponse, hookRequest)
	if hookResponse.Code != http.StatusOK || !strings.Contains(hookResponse.Body.String(), `"hook":"get-static"`) || !strings.Contains(hookResponse.Body.String(), `"content":"`) {
		t.Fatalf("POST hook: status=%d body=%q", hookResponse.Code, hookResponse.Body.String())
	}
	pageHookRequest := httptest.NewRequest(http.MethodPost, "/api/v2/vfs/hooks/get-page/run", strings.NewReader(`{"resource_uri":"`+htmlURI("/")+`","input":{"path":"/demo"}}`))
	pageHookResponse := httptest.NewRecorder()
	handler.ServeHTTP(pageHookResponse, pageHookRequest)
	if pageHookResponse.Code != http.StatusOK || !strings.Contains(pageHookResponse.Body.String(), `"hook":"get-page"`) || !strings.Contains(pageHookResponse.Body.String(), `"found":true`) || !strings.Contains(pageHookResponse.Body.String(), `"page_key":"demo"`) {
		t.Fatalf("POST page hook: status=%d body=%q", pageHookResponse.Code, pageHookResponse.Body.String())
	}
	missingPageHookRequest := httptest.NewRequest(http.MethodPost, "/api/v2/vfs/hooks/get-page/run", strings.NewReader(`{"resource_uri":"`+htmlURI("/")+`","input":{"path":"/missing"}}`))
	missingPageHookResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingPageHookResponse, missingPageHookRequest)
	if missingPageHookResponse.Code != http.StatusOK || !strings.Contains(missingPageHookResponse.Body.String(), `"status":"completed"`) || !strings.Contains(missingPageHookResponse.Body.String(), `"route":"/missing"`) || !strings.Contains(missingPageHookResponse.Body.String(), `"found":false`) || !strings.Contains(missingPageHookResponse.Body.String(), `"code":"not_found"`) || strings.Contains(missingPageHookResponse.Body.String(), `"content"`) {
		t.Fatalf("POST missing page hook: status=%d body=%q", missingPageHookResponse.Code, missingPageHookResponse.Body.String())
	}

	missing := httptest.NewRecorder()
	handler.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/unknown-page", nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("GET unknown page: status=%d body=%q", missing.Code, missing.Body.String())
	}

	controlPath := "/api/v2/vfs/control?uri=" + url.QueryEscape(htmlURI("/pages/home")) + "&command=update"
	request := httptest.NewRequest(http.MethodPost, controlPath, strings.NewReader(`{"expected_page_revision":1,"title":"Из веб-интерфейса"}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"page_revision": 2`) {
		t.Fatalf("POST update: status=%d body=%q", response.Code, response.Body.String())
	}
	if page := readDemoPage(t, frontend); page.Title != "Из веб-интерфейса" || page.Revision != 2 {
		t.Fatalf("page after HTTP update = %+v", page)
	}

	root := fixtureURI("/content/about")
	request = httptest.NewRequest(http.MethodPost, "/api/v2/vfs/directory?uri="+url.QueryEscape(root), nil)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated {
		t.Fatalf("POST directory: status=%d body=%q", response.Code, response.Body.String())
	}
	for name, body := range map[string]string{
		"content.md": "# About",
		"style.css":  "body { color: green; }",
		"script.js":  "document.body.dataset.about = 'true';",
	} {
		request = httptest.NewRequest(http.MethodPost, "/api/v2/vfs/file?uri="+url.QueryEscape(root+"/"+name), strings.NewReader(body))
		response = httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusCreated {
			t.Fatalf("POST %s: status=%d body=%q", name, response.Code, response.Body.String())
		}
	}
	createPath := "/api/v2/vfs/control?uri=" + url.QueryEscape(htmlURI("/pages")) + "&command=create"
	request = httptest.NewRequest(http.MethodPost, createPath, strings.NewReader(`{
		"expected_tree_revision":3,
		"position":{"last":true},
		"page_key":"about",
		"slug":"about",
		"title":"About",
		"status":"draft",
		"bundle_root_uri":"`+root+`",
		"visible_to":["user:html-demo"]
	}`))
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"page_id"`) {
		t.Fatalf("POST create page: status=%d body=%q", response.Code, response.Body.String())
	}

	contentURI := root + "/content.md"
	request = httptest.NewRequest(http.MethodPut, "/api/v2/vfs/file?uri="+url.QueryEscape(contentURI), strings.NewReader("# Updated About"))
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("PUT content: status=%d body=%q", response.Code, response.Body.String())
	}
	request = httptest.NewRequest(http.MethodGet, "/api/v2/vfs/read?uri="+url.QueryEscape(contentURI), nil)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || response.Body.String() != "# Updated About" {
		t.Fatalf("GET updated content: status=%d body=%q", response.Code, response.Body.String())
	}
}

func openDemoDatabase(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sqliteDB.InitDB(filepath.Join(t.TempDir(), "demo.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	if err := schema.Migrate(context.Background(), db, localprovider.MigrationGroup(), htmlprovider.MigrationGroup()); err != nil {
		_ = db.Close()
		t.Fatal(err)
	}
	return db
}

func readDemoPage(t *testing.T, frontend vfs.VFSFrontend) htmlprovider.PageDocument {
	t.Helper()
	file, err := frontend.OpenFile(context.Background(), demoActor, mustURI(htmlURI("/pages/home/info.json")), os.O_RDONLY)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(file)
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		t.Fatal(err)
	}
	var page htmlprovider.PageDocument
	if err := json.Unmarshal(data, &page); err != nil {
		t.Fatal(err)
	}
	return page
}
