package html

import (
	vfs "MyServer/internal/vfs/v2"
	"context"
	"encoding/json"
	"errors"
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestApplicationTemplateInstallAndVFSProjection(t *testing.T) {
	frontend, store, _ := newProviderTestVFS(t)
	controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{providerTestActor.String()}})

	input := InstallTemplateInput{
		TemplateKey: "default-spa",
		Version:     "1",
		Entrypoint:  "index.html",
		Files: []InstallTemplateAsset{
			{Path: "js/app.js", Data: []byte("export default 'app';\n")},
			{Path: "index.html", Data: []byte("<!doctype html><script src=\"js/app.js\"></script>\n")},
			{Path: "img/icon.svg", Data: []byte("<svg xmlns=\"http://www.w3.org/2000/svg\"/>\n")},
		},
	}
	installed := controlResult[InstalledTemplateDocument](t, frontend, "/templates", "install", input)
	if installed.TemplateKey != "default-spa" || installed.Version != "1" || installed.Entrypoint != "index.html" || len(installed.PackageDigest) != 64 || len(installed.ManifestDigest) != 64 {
		t.Fatalf("installed template = %+v", installed)
	}
	wantManifestURI := string(htmlTestURI(t, "/templates/default-spa/1/manifest.json"))
	if installed.Manifest != wantManifestURI {
		t.Fatalf("manifest URI = %q, want %q", installed.Manifest, wantManifestURI)
	}
	if !reflect.DeepEqual(installed.Assets, []string{"img/icon.svg", "index.html", "js/app.js"}) {
		t.Fatalf("installed assets = %v", installed.Assets)
	}

	root, err := frontend.ReadDir(context.Background(), providerTestActor, htmlTestURI(t, "/templates"))
	if err != nil || len(root) != 1 || root[0].Name != "default-spa" || !root[0].IsDir {
		t.Fatalf("template root = %+v, %v", root, err)
	}
	files, err := frontend.ReadDir(context.Background(), providerTestActor, htmlTestURI(t, "/templates/default-spa/1/files"))
	if err != nil || nodeNames(files) != "img,index.html,js" {
		t.Fatalf("template files = %+v, %v", files, err)
	}
	js, err := frontend.ReadDir(context.Background(), providerTestActor, htmlTestURI(t, "/templates/default-spa/1/files/js"))
	if err != nil || nodeNames(js) != "app.js" {
		t.Fatalf("template js = %+v, %v", js, err)
	}
	if got := string(readDocumentForActor(t, frontend, providerTestActor, "/templates/default-spa/1/files/js/app.js")); got != "export default 'app';\n" {
		t.Fatalf("app.js = %q", got)
	}

	manifestBytes := readDocumentForActor(t, frontend, providerTestActor, "/templates/default-spa/1/manifest.json")
	var manifest TemplateManifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.PackageDigest != installed.PackageDigest || len(manifest.Assets) != 3 || manifest.Assets[0].Path != "img/icon.svg" || manifest.Assets[1].Path != "index.html" {
		t.Fatalf("manifest = %+v", manifest)
	}
	if manifest.Assets[1].ContentType != "text/html; charset=utf-8" || manifest.Assets[2].ContentType != "application/javascript; charset=utf-8" {
		t.Fatalf("manifest MIME types = %+v", manifest.Assets)
	}

	if _, err := frontend.OpenFile(context.Background(), providerTestActor, htmlTestURI(t, "/templates/default-spa/1/files/js/app.js"), os.O_WRONLY|os.O_TRUNC); !vfs.IsKind(err, vfs.KindUnsupported) {
		t.Fatalf("template write error = %v, want unsupported", err)
	}
	if _, err := frontend.Stat(context.Background(), providerTestActor, htmlTestURI(t, "/templates/default-spa/1/files/js/missing.js")); !vfs.IsKind(err, vfs.KindNotFound) {
		t.Fatalf("missing asset error = %v, want not found", err)
	}
	if _, err := control(t, frontend, "/templates", "install", input); !vfs.IsKind(err, vfs.KindAlreadyExists) {
		t.Fatalf("duplicate version error = %v, want already exists", err)
	}

	site, err := store.SiteByConnection(context.Background(), 101)
	if err != nil {
		t.Fatal(err)
	}
	stored, err := store.TemplateByKeyVersion(context.Background(), site.ID, "default-spa", "1")
	if err != nil || stored.ManifestDigest != installed.ManifestDigest {
		t.Fatalf("stored template = %+v, %v", stored, err)
	}
}

func TestApplicationTemplateRejectsUnsafeOrIncompletePackages(t *testing.T) {
	frontend, _, _ := newProviderTestVFS(t)
	controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{providerTestActor.String()}})

	tests := []struct {
		name  string
		input InstallTemplateInput
	}{
		{"path traversal", InstallTemplateInput{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []InstallTemplateAsset{{Path: "index.html", Data: []byte("ok")}, {Path: "../secret", Data: []byte("no")}}}},
		{"absolute path", InstallTemplateInput{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []InstallTemplateAsset{{Path: "/index.html", Data: []byte("no")}}}},
		{"duplicate normalized path", InstallTemplateInput{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []InstallTemplateAsset{{Path: "index.html", Data: []byte("a")}, {Path: "index.html", Data: []byte("b")}}}},
		{"missing entrypoint", InstallTemplateInput{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []InstallTemplateAsset{{Path: "app.js", Data: []byte("no")}}}},
		{"unsafe key", InstallTemplateInput{TemplateKey: "../app", Version: "1", Entrypoint: "index.html", Files: []InstallTemplateAsset{{Path: "index.html", Data: []byte("no")}}}},
		{"unknown content type", InstallTemplateInput{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []InstallTemplateAsset{{Path: "index.html", Data: []byte("ok")}, {Path: "payload.bin", Data: []byte("no")}}}},
		{"spoofed content type", InstallTemplateInput{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []InstallTemplateAsset{{Path: "index.html", ContentType: "image/png", Data: []byte("no")}}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := control(t, frontend, "/templates", "install", test.input); !vfs.IsKind(err, vfs.KindInvalidArgument) {
				t.Fatalf("install error = %v, want invalid argument", err)
			}
		})
	}

	raw := []byte(`{"template_key":"app","version":"1","entrypoint":"index.html","files":[],"unknown":true}`)
	if _, err := frontend.Control(context.Background(), providerTestActor, htmlTestURI(t, "/templates"), "install", raw); !vfs.IsKind(err, vfs.KindInvalidArgument) {
		t.Fatalf("unknown field error = %v, want invalid argument", err)
	}
}

func TestTemplateVersionsAreListedInInstallationOrder(t *testing.T) {
	frontend, _, _ := newProviderTestVFS(t)
	controlResult[SiteDocument](t, frontend, "/", "initialize", InitializeInput{Name: "Acme", VisibleTo: []string{providerTestActor.String()}})
	for _, version := range []string{"9", "2"} {
		controlResult[InstalledTemplateDocument](t, frontend, "/templates", "install", InstallTemplateInput{
			TemplateKey: "default-spa",
			Version:     version,
			Entrypoint:  "index.html",
			Files:       []InstallTemplateAsset{{Path: "index.html", Data: []byte("version " + version)}},
		})
	}
	versions, err := frontend.ReadDir(context.Background(), providerTestActor, htmlTestURI(t, "/templates/default-spa"))
	if err != nil {
		t.Fatal(err)
	}
	if got := nodeNames(versions); got != "9,2" {
		t.Fatalf("template version order = %q, want installation order 9,2", got)
	}
}

func TestTemplateStoreIsolatesSitesAndDeduplicatesBlobs(t *testing.T) {
	store := openTestStore(t)
	first := createTestSite(t, store, 101, "First")
	second := createTestSite(t, store, 202, "Second")
	service, err := NewTemplateService(store)
	if err != nil {
		t.Fatal(err)
	}
	input := InstallTemplateInput{TemplateKey: "app", Version: "1", Entrypoint: "index.html", Files: []InstallTemplateAsset{{Path: "index.html", Data: []byte("same")}}}
	if _, err := service.Install(context.Background(), first, input); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Install(context.Background(), second, input); err != nil {
		t.Fatal(err)
	}
	if _, err := store.TemplateByKeyVersion(context.Background(), first.ID, "app", "1"); err != nil {
		t.Fatal(err)
	}
	if _, err := store.TemplateByKeyVersion(context.Background(), first.ID, "missing", "1"); !errors.Is(err, ErrTemplateNotFound) {
		t.Fatalf("missing template error = %v", err)
	}
	var blobs int
	if err := store.db.QueryRow(`SELECT COUNT(*) FROM html_template_blobs`).Scan(&blobs); err != nil {
		t.Fatal(err)
	}
	if blobs != 1 {
		t.Fatalf("blob count = %d, want 1", blobs)
	}
}

func nodeNames(nodes []*vfs.Node) string {
	names := make([]string, 0, len(nodes))
	for _, node := range nodes {
		names = append(names, node.Name)
	}
	return strings.Join(names, ",")
}
