package app

import (
	authmiddleware "github.com/akyaiy/veido/api/middleware"
	"github.com/akyaiy/veido/internal/auth"
	"github.com/akyaiy/veido/internal/database/schema"
	usersprovider "github.com/akyaiy/veido/internal/vfs/v2/providers/users"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	_ "github.com/mattn/go-sqlite3"
)

func TestV2GuestAndUserUseSharedSystemScope(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	if err := schema.Migrate(context.Background(), db, usersprovider.MigrationGroup()); err != nil {
		t.Fatal(err)
	}
	authService, err := auth.NewAuth(db, auth.Config{
		Secret: []byte("0123456789abcdef0123456789abcdef"), Issuer: "test", Audience: "test",
		AccessTTL: time.Minute, RefreshTTL: time.Hour,
	})
	if err != nil {
		t.Fatal(err)
	}
	runtime, err := newV2Runtime(db, authService)
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	router.Use(authmiddleware.AuthMiddleware(authService))
	router.Route("/api/v2/vfs", runtime.Register)

	guest := httptest.NewRecorder()
	router.ServeHTTP(guest, httptest.NewRequest(http.MethodGet, "/api/v2/vfs/read?uri="+url.QueryEscape("users@account[system]:///actor.json"), nil))
	if guest.Code != http.StatusOK || !strings.Contains(guest.Body.String(), `"kind": "guest"`) {
		t.Fatalf("guest actor response: status=%d body=%q", guest.Code, guest.Body.String())
	}
	guestCookies := guest.Result().Cookies()

	// Auth hooks are global commands; their inputs do not carry a target URI.
	registerBody := []byte(`{"input":{"username":"alice","password":"correct horse battery staple"}}`)
	loginRequest := httptest.NewRequest(http.MethodPost, "/api/v2/vfs/hooks/auth.register/run", bytes.NewReader(registerBody))
	for _, cookie := range guestCookies {
		loginRequest.AddCookie(cookie)
	}
	login := httptest.NewRecorder()
	router.ServeHTTP(login, loginRequest)
	if login.Code != http.StatusOK {
		t.Fatalf("login response: status=%d body=%q", login.Code, login.Body.String())
	}
	var envelope struct {
		Output struct {
			AccessToken string `json:"access_token"`
			ScopeKey    string `json:"scope_key"`
		} `json:"output"`
	}
	if err := json.Unmarshal(login.Body.Bytes(), &envelope); err != nil || envelope.Output.AccessToken == "" || envelope.Output.ScopeKey == "" {
		t.Fatalf("decode register response: err=%v body=%q", err, login.Body.String())
	}
	refreshFound := false
	for _, cookie := range login.Result().Cookies() {
		if cookie.Name == "refresh_token" && cookie.HttpOnly && cookie.Value != "" {
			refreshFound = true
		}
	}
	if !refreshFound {
		t.Fatalf("login did not set HttpOnly refresh cookie: %+v", login.Result().Cookies())
	}

	userRequest := httptest.NewRequest(http.MethodGet, "/api/v2/vfs/read?uri="+url.QueryEscape("users@account[system]:///actor.json"), nil)
	userRequest.Header.Set("Authorization", "Bearer "+envelope.Output.AccessToken)
	user := httptest.NewRecorder()
	router.ServeHTTP(user, userRequest)
	if user.Code != http.StatusOK || !strings.Contains(user.Body.String(), `"kind": "user"`) {
		t.Fatalf("user actor response: status=%d body=%q", user.Code, user.Body.String())
	}

	defaultScopeRequest := httptest.NewRequest(http.MethodGet, "/api/v2/vfs/read?uri="+url.QueryEscape("scopes@scopes[system]:///me/default_scope.json"), nil)
	defaultScopeRequest.Header.Set("Authorization", "Bearer "+envelope.Output.AccessToken)
	defaultScope := httptest.NewRecorder()
	router.ServeHTTP(defaultScope, defaultScopeRequest)
	if defaultScope.Code != http.StatusOK || !strings.Contains(defaultScope.Body.String(), envelope.Output.ScopeKey) {
		t.Fatalf("default scope response: status=%d body=%q", defaultScope.Code, defaultScope.Body.String())
	}

	profileRequest := httptest.NewRequest(http.MethodGet, "/api/v2/vfs/read?uri="+url.QueryEscape("users@account[system]:///me/profile.json"), nil)
	profileRequest.Header.Set("Authorization", "Bearer "+envelope.Output.AccessToken)
	profile := httptest.NewRecorder()
	router.ServeHTTP(profile, profileRequest)
	if profile.Code != http.StatusOK {
		t.Fatalf("profile response: status=%d body=%q", profile.Code, profile.Body.String())
	}
}
