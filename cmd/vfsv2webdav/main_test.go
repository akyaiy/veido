package main

import (
	"github.com/akyaiy/veido/internal/common"
	"github.com/akyaiy/veido/internal/database/schema"
	"github.com/akyaiy/veido/internal/sqliteDB"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	httpapi "github.com/akyaiy/veido/internal/vfs/v2/adapters/httpapi"
	webdavadapter "github.com/akyaiy/veido/internal/vfs/v2/adapters/webdav"
	"github.com/akyaiy/veido/internal/vfs/v2/providers/local"
	sharedprovider "github.com/akyaiy/veido/internal/vfs/v2/providers/shared"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestNewVFSRegistersSharedProvider(t *testing.T) {
	db, err := sqliteDB.InitDB(filepath.Join(t.TempDir(), "vfs.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := schema.Migrate(context.Background(), db, local.MigrationGroup(), sharedprovider.MigrationGroup()); err != nil {
		t.Fatal(err)
	}

	if _, err := db.Exec(`
		INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key)
		VALUES ('alice', 'personal', 'user:1');
		INSERT INTO vfs_provider_connections
			(scope_key, provider, connection_key, display_name, config_json, status, ready)
		VALUES ('alice', 'shared', 'me', 'me', '{}', 'active', 1);
	`); err != nil {
		t.Fatalf("seed shared connection: %v", err)
	}

	frontend, err := newVFS(db)
	if err != nil {
		t.Fatalf("newVFS: %v", err)
	}
	uri, err := common.CastURI("shared@me[alice]:///")
	if err != nil {
		t.Fatalf("shared URI: %v", err)
	}
	node, err := frontend.Stat(context.Background(), vfs.Actor{Kind: vfs.ActorUser, ID: "1"}, uri)
	if err != nil {
		t.Fatalf("Stat shared root: %v", err)
	}
	if !node.IsDir {
		t.Fatalf("shared root = %#v, want directory", node)
	}
}

func TestHTTPRequestActor(t *testing.T) {
	want := vfs.Actor{Kind: vfs.ActorUser, ID: "42"}
	request := httptest.NewRequest(http.MethodGet, "/api/v2/vfs/stat", nil)
	request = request.WithContext(vfs.ContextWithActor(request.Context(), want))
	got, err := httpRequestActor(request)
	if err != nil || got != want {
		t.Fatalf("httpRequestActor() = (%+v, %v), want (%+v, nil)", got, err, want)
	}

	request = request.WithContext(context.Background())
	if _, err := httpRequestActor(request); !errors.Is(err, httpapi.ErrUnauthenticated) {
		t.Fatalf("httpRequestActor() error = %v, want unauthenticated", err)
	}
}

func TestWebDAVStatusHintRewritesMKCOLMethodNotAllowed(t *testing.T) {
	handler := webdavStatusHint(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		webdavadapter.MarkProtocolStatus(r.Context(), http.StatusForbidden)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}))

	req := httptest.NewRequest("MKCOL", "/webdav/scopes/my!", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusForbidden)
	}
}

func TestWebDAVStatusHintRewritesPUTMethodNotAllowed(t *testing.T) {
	handler := webdavStatusHint(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		webdavadapter.MarkProtocolStatus(r.Context(), http.StatusBadRequest)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}))

	req := httptest.NewRequest("PUT", "/webdav/.system/scopes@scopes/me/default_scope.json", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestWebDAVStatusHintLeavesOtherMethodsAlone(t *testing.T) {
	handler := webdavStatusHint(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		webdavadapter.MarkProtocolStatus(r.Context(), http.StatusForbidden)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}))

	req := httptest.NewRequest("GET", "/webdav/scopes/my!", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusMethodNotAllowed)
	}
}

func TestWebDAVStatusHintLeavesUnhintedMethodNotAllowedAlone(t *testing.T) {
	handler := webdavStatusHint(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}))

	req := httptest.NewRequest("MKCOL", "/webdav/scopes/my!", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusMethodNotAllowed)
	}
}
