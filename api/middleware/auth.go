package middleware

import (
	"MyServer/internal/auth"
	"context"
	"net/http"
	"strconv"
	"strings"
)

// AuthMiddleware authenticates requests when credentials are present and sets
// the user ID in the context. Requests without JWT credentials continue as
// guests, so route-level ACL can decide whether anonymous access is allowed.
func AuthMiddleware(authService *auth.Auth) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			isWebDAV := strings.HasPrefix(r.URL.Path, "/webdav")

			var uid int

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
					next.ServeHTTP(w, r)
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
			}

			ctx := context.WithValue(r.Context(), auth.CONTEXT_USER_ID_KEY, uid)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
