package main

import (
	webdavadapter "MyServer/internal/vfs/v2/adapters/webdav"
	"net/http"
	"net/http/httptest"
	"testing"
)

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
