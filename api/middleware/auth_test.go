package middleware

import (
	"github.com/akyaiy/veido/internal/vfs/v2"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
)

func TestAuthMiddlewareCreatesStableGuestActor(t *testing.T) {
	var actor v2.Actor
	handler := AuthMiddleware(nil)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		var ok bool
		actor, ok = v2.ActorFromContext(r.Context())
		if !ok {
			t.Fatal("guest actor missing from request context")
		}
	}))

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/api/v2/vfs/stat", nil))
	if actor.Kind != v2.ActorGuest || actor.ID == "" {
		t.Fatalf("actor = %+v, want session guest", actor)
	}
	cookies := first.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != GuestSessionCookie || cookies[0].HttpOnly == false {
		t.Fatalf("cookies = %+v, want HttpOnly %s", cookies, GuestSessionCookie)
	}
	if _, err := uuid.Parse(cookies[0].Value); err != nil {
		t.Fatalf("guest cookie is not UUID: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/v2/vfs/stat", nil)
	request.AddCookie(cookies[0])
	second := httptest.NewRecorder()
	handler.ServeHTTP(second, request)
	if actor.ID != cookies[0].Value {
		t.Fatalf("actor ID = %q, want cookie %q", actor.ID, cookies[0].Value)
	}
	if got := second.Result().Cookies(); len(got) != 0 {
		t.Fatalf("stable guest unexpectedly reset cookie: %+v", got)
	}
}

func TestAuthMiddlewareReplacesInvalidGuestCookie(t *testing.T) {
	handler := AuthMiddleware(nil)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		actor, ok := v2.ActorFromContext(r.Context())
		if !ok || actor.Kind != v2.ActorGuest || actor.ID == "invalid" {
			t.Fatalf("actor = %+v, ok = %v", actor, ok)
		}
	}))
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.AddCookie(&http.Cookie{Name: GuestSessionCookie, Value: "invalid"})
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if got := recorder.Result().Cookies(); len(got) != 1 || got[0].Value == "invalid" {
		t.Fatalf("replacement cookie = %+v", got)
	}
}
