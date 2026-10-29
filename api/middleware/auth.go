package middleware

import (
	"github.com/akyaiy/veido/internal/auth"
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

const GuestSessionCookie = "guest_session"

// AuthMiddleware authenticates requests when credentials are present and sets
// the user ID in the context. Requests without JWT credentials continue as
// guests, so route-level ACL can decide whether anonymous access is allowed.
func AuthMiddleware(authService *auth.Auth) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			isWebDAV := strings.HasPrefix(r.URL.Path, "/webdav")
			var uid int
			var sessionID string

			if isWebDAV {
				user, err := authService.AuthenticateBasicRequest(r)
				if err != nil || user.ID == 0 {
					w.Header().Set("WWW-Authenticate", `Basic realm="WebDAV"`)
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}
				uid = int(user.ID)
			} else {
				if r.Header.Get("Authorization") == "" {
					guestID := guestSessionID(r)
					if cookie, err := r.Cookie(GuestSessionCookie); err != nil || cookie.Value != guestID {
						http.SetCookie(w, &http.Cookie{
							Name: GuestSessionCookie, Value: guestID, Path: "/", HttpOnly: true,
							SameSite: http.SameSiteLaxMode, MaxAge: int((30 * 24 * time.Hour).Seconds()),
						})
					}
					ctx := vfs.ContextWithActor(r.Context(), vfs.Actor{Kind: vfs.ActorGuest, ID: guestID})
					next.ServeHTTP(w, r.WithContext(ctx))
					return
				}

				claims, err := authService.AuthenticateRequest(r)
				if err != nil {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}

				userID, err := claims.GetSubject()
				if err != nil {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}

				uid, err = strconv.Atoi(userID)
				if err != nil {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}
				sessionID = claims.SessionID
			}

			ctx := context.WithValue(r.Context(), auth.CONTEXT_USER_ID_KEY, uid)
			if !isWebDAV {
				ctx = auth.ContextWithPrincipal(ctx, auth.Principal{UserID: int64(uid), SessionID: sessionID})
			}
			ctx = vfs.ContextWithActor(ctx, vfs.Actor{Kind: vfs.ActorUser, ID: strconv.Itoa(uid)})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func guestSessionID(r *http.Request) string {
	if cookie, err := r.Cookie(GuestSessionCookie); err == nil {
		if parsed, parseErr := uuid.Parse(cookie.Value); parseErr == nil && parsed.Version() == 4 {
			return parsed.String()
		}
	}
	return uuid.NewString()
}
