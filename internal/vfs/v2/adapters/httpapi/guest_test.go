package httpapi

import (
	"MyServer/internal/vfs/v2"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthenticatedOnlyHidesGenericVFSFromGuest(t *testing.T) {
	next := AuthenticatedOnly(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }))
	guest := httptest.NewRecorder()
	next.ServeHTTP(guest, httptest.NewRequest(http.MethodGet, "/api/v2/vfs/read", nil).WithContext(v2.ContextWithActor(t.Context(), v2.Actor{Kind: v2.ActorGuest, ID: "guest"})))
	if guest.Code != http.StatusNotFound {
		t.Fatalf("guest status = %d, want 404", guest.Code)
	}
	user := httptest.NewRecorder()
	next.ServeHTTP(user, httptest.NewRequest(http.MethodGet, "/api/v2/vfs/read", nil).WithContext(v2.ContextWithActor(t.Context(), v2.Actor{Kind: v2.ActorUser, ID: "1"})))
	if user.Code != http.StatusNoContent {
		t.Fatalf("user status = %d, want 204", user.Code)
	}
}
