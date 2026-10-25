package vfshooks

import (
	"MyServer/internal/vfs/v2/adapters/hookapi"
	"context"
	"errors"
	"net/http"
	"time"
)

const RefreshCookieName = "refresh_token"

type transportState struct {
	refreshToken string
	setToken     string
	clear        bool
}

type transportStateKey struct{}

type HTTPBridge struct {
	RefreshTTL time.Duration
	Secure     bool
	CookieName string
	CookiePath string
	SameSite   http.SameSite
}

func (b HTTPBridge) Prepare(r *http.Request, invocation hookapi.Invocation) (context.Context, error) {
	state := &transportState{}
	if invocation.HookKey == HookRefresh {
		cookie, err := r.Cookie(b.cookieName())
		if err != nil && !errors.Is(err, http.ErrNoCookie) {
			return nil, err
		}
		if err == nil {
			state.refreshToken = cookie.Value
		}
	}
	return context.WithValue(r.Context(), transportStateKey{}, state), nil
}

func (b HTTPBridge) Complete(w http.ResponseWriter, ctx context.Context) {
	state, _ := ctx.Value(transportStateKey{}).(*transportState)
	if state == nil || (!state.clear && state.setToken == "") {
		return
	}
	maxAge := int(b.RefreshTTL.Seconds())
	value := state.setToken
	if state.clear {
		maxAge = -1
		value = ""
	}
	http.SetCookie(w, &http.Cookie{
		Name: b.cookieName(), Value: value, Path: b.cookiePath(),
		HttpOnly: true, Secure: b.Secure, SameSite: b.sameSite(), MaxAge: maxAge,
	})
}
func (b HTTPBridge) cookiePath() string {
	if b.CookiePath != "" {
		return b.CookiePath
	}
	return "/api/v2/vfs/hooks/"
}

func (b HTTPBridge) cookieName() string {
	if b.CookieName == "" {
		return RefreshCookieName
	}
	return b.CookieName
}

func (b HTTPBridge) sameSite() http.SameSite {
	if b.SameSite == 0 {
		return http.SameSiteLaxMode
	}
	return b.SameSite
}

func refreshCredential(ctx context.Context) (string, bool) {
	state, _ := ctx.Value(transportStateKey{}).(*transportState)
	return value(state, func(s *transportState) string { return s.refreshToken })
}

func setRefreshCredential(ctx context.Context, token string) {
	if state, _ := ctx.Value(transportStateKey{}).(*transportState); state != nil {
		state.setToken = token
		state.clear = false
	}
}

func clearRefreshCredential(ctx context.Context) {
	if state, _ := ctx.Value(transportStateKey{}).(*transportState); state != nil {
		state.clear = true
		state.setToken = ""
	}
}

func value(state *transportState, get func(*transportState) string) (string, bool) {
	if state == nil {
		return "", false
	}
	result := get(state)
	return result, result != ""
}

var _ hookapi.TransportBridge = HTTPBridge{}
