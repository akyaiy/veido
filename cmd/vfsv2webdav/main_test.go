package main

import (
	vfs "MyServer/internal/vfs/v2"
	httpapi "MyServer/internal/vfs/v2/adapters/httpapi"
	webdavadapter "MyServer/internal/vfs/v2/adapters/webdav"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

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
