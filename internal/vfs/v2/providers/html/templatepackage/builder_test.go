package templatepackage

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestDefaultSPABuildsReviewedFrontendAllowlist(t *testing.T) {
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("locate test source")
	}
	repo := filepath.Dir(file)
	for {
		if _, err := os.Stat(filepath.Join(repo, "go.mod")); err == nil {
			break
		}
		parent := filepath.Dir(repo)
		if parent == repo {
			t.Fatal("repository root not found")
		}
		repo = parent
	}
	input, err := BuildDirectory(filepath.Join(repo, "data", "HTML", "frontend"), DefaultSPA("1", "site-acme"))
	if err != nil {
		t.Fatal(err)
	}
	wantPaths := []string{"index.html", "site-context.json", "css/style.css", "css/admin.css", "css/page.css", "js/app.js", "js/admin.js", "js/page.js", "js/router.js", "js/site-context.js", "js/vfsv2.js", "vendor/markdown-it.min.js", "img/favicon.png", "img/icons.svg"}
	if len(input.Files) != len(wantPaths) {
		t.Fatalf("files = %d, want %d", len(input.Files), len(wantPaths))
	}
	for index, want := range wantPaths {
		if input.Files[index].Path != want {
			t.Fatalf("file %d path = %q, want %q", index, input.Files[index].Path, want)
		}
	}
	index := string(input.Files[0].Data)
	if strings.Contains(index, `href="/img/favicon.png"`) || !strings.Contains(index, `/_static/img/favicon.png`) {
		t.Fatalf("index does not use the public static namespace: %s", index)
	}
	if !strings.Contains(index, `/_static/js/router.js`) {
		t.Fatal("index does not load the route bootstrap")
	}
	if got := string(input.Files[1].Data); got != `{"scope":"site-acme"}` {
		t.Fatalf("site context = %q", got)
	}
	admin := string(input.Files[6].Data)
	if !strings.Contains(admin, `window.VFSv2.control`) || !strings.Contains(admin, `"set-visibility"`) {
		t.Fatal("admin client does not use the VFS control contract")
	}
	page := string(input.Files[7].Data)
	if strings.Contains(page, `html-page-bootstrap`) || strings.Contains(page, `/api/v2/vfs/hooks/get-page/run`) || !strings.Contains(page, `resolveBundleRoot`) || !strings.Contains(page, `info.json`) {
		t.Fatal("page runtime does not resolve bundle roots through Page/Block metadata")
	}
	for _, file := range input.Files {
		if strings.Contains(file.Path, "generate") || strings.Contains(file.Path, ".zip") || strings.Contains(file.Path, "Копия") {
			t.Fatalf("unsafe source entered package: %q", file.Path)
		}
	}
}

func TestBuildDirectoryRejectsTraversalSymlinksAndReviewedTextDrift(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("original"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("index.html", filepath.Join(root, "linked.html")); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		spec Spec
	}{
		{"source traversal", Spec{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []File{{SourcePath: "../index.html", TargetPath: "index.html"}}}},
		{"target traversal", Spec{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []File{{SourcePath: "index.html", TargetPath: "../index.html"}}}},
		{"symlink", Spec{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []File{{SourcePath: "linked.html", TargetPath: "index.html"}}}},
		{"reviewed text drift", Spec{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []File{{SourcePath: "index.html", TargetPath: "index.html", Replace: []Replacement{{Old: "missing", New: "new"}}}}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := BuildDirectory(root, test.spec); err == nil {
				t.Fatal("BuildDirectory accepted unsafe package")
			}
		})
	}
}
