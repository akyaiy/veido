package vfshooks

import (
	"MyServer/internal/auth"
	"MyServer/internal/database/migrate"
	"MyServer/internal/vfs/v2/adapters/hookapi"
	"MyServer/pkg/vfs"
	"MyServer/pkg/vfs/hooks"
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

const hookTestPassword = "correct horse battery staple"

func newHookTestAuth(t *testing.T) *auth.Auth {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	if err := migrate.Run(context.Background(), db, auth.MigrationGroup()); err != nil {
		t.Fatal(err)
	}
	service, err := auth.NewAuth(db, auth.Config{
		Secret: []byte("0123456789abcdef0123456789abcdef"), Issuer: "test", Audience: "test",
		AccessTTL: time.Minute, RefreshTTL: time.Hour,
	})
	if err != nil {
		t.Fatal(err)
	}
	return service
}

func TestLoginAndRefreshUseOnlyTransportCookie(t *testing.T) {
	service := newHookTestAuth(t)
	if _, err := service.CreateUser(&auth.User{Name: "alice", Password: hookTestPassword, Status: auth.StatusActive}); err != nil {
		t.Fatal(err)
	}
	handlers := &Handlers{auth: service}
	bridge := HTTPBridge{RefreshTTL: service.RefreshTTL()}
	request := httptest.NewRequest(http.MethodPost, "/api/v2/vfs/hooks/auth.login/run", nil)
	ctx, err := bridge.Prepare(request, hookapi.Invocation{HookKey: HookLogin})
	if err != nil {
		t.Fatal(err)
	}
	output, err := handlers.login(ctx, hooks.Execution{Actor: vfs.Actor{Kind: vfs.ActorGuest, ID: "session-1"}}, loginInput{Username: "alice", Password: hookTestPassword})
	if err != nil {
		t.Fatal(err)
	}
	if output.AccessToken == "" {
		t.Fatal("login returned no access token")
	}
	recorder := httptest.NewRecorder()
	bridge.Complete(recorder, ctx)
	cookies := recorder.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != RefreshCookieName || cookies[0].Value == "" || !cookies[0].HttpOnly {
		t.Fatalf("login cookies = %+v", cookies)
	}

	refreshRequest := httptest.NewRequest(http.MethodPost, "/api/v2/vfs/hooks/auth.refresh/run", nil)
	refreshRequest.AddCookie(cookies[0])
	refreshCtx, err := bridge.Prepare(refreshRequest, hookapi.Invocation{HookKey: HookRefresh})
	if err != nil {
		t.Fatal(err)
	}
	refreshed, err := handlers.refresh(refreshCtx, hooks.Execution{Actor: vfs.Actor{Kind: vfs.ActorGuest, ID: "session-1"}}, emptyInput{})
	if err != nil {
		t.Fatal(err)
	}
	if refreshed.AccessToken == "" {
		t.Fatal("refresh returned no access token")
	}
	refreshRecorder := httptest.NewRecorder()
	bridge.Complete(refreshRecorder, refreshCtx)
	rotated := refreshRecorder.Result().Cookies()
	if len(rotated) != 1 || rotated[0].Value == "" || rotated[0].Value == cookies[0].Value {
		t.Fatalf("rotated cookies = %+v", rotated)
	}
}

func TestAuthHookPreACLPolicy(t *testing.T) {
	handlers := &Handlers{auth: newHookTestAuth(t)}
	if _, err := handlers.login(context.Background(), hooks.Execution{Actor: vfs.Actor{Kind: vfs.ActorUser, ID: "1"}}, loginInput{}); err == nil {
		t.Fatal("authenticated actor unexpectedly allowed to call guest login hook")
	}
	if _, err := handlers.revokeSessions(context.Background(), hooks.Execution{Actor: vfs.Actor{Kind: vfs.ActorGuest, ID: "session"}}, emptyInput{}); err == nil {
		t.Fatal("guest unexpectedly allowed to revoke sessions")
	}
}
