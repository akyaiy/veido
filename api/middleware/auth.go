package middleware

import (
	"MyServer/internal/auth"
	"context"
	"net/http"
	"strconv"
)

// AuthMiddleware authenticates the request and sets the user ID in the context.
// Wrapper uses [auth.Auth] service to authenticate the request,
// and sets the user ID by key [vfs.CONTEXT_USER_ID_KEY] in the context if the request is authenticated.
func AuthMiddleware(next http.Handler, authService *auth.Auth) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := authService.AuthenticateRequest(r)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		
		userIdString := claims.Subject
		userId, err := strconv.ParseInt(userIdString, 10, 64)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		
		ctx := r.Context()
		ctx = context.WithValue(ctx, auth.CONTEXT_USER_ID_KEY, userId)
		
		r = r.WithContext(ctx)
		next.ServeHTTP(w, r)
	})
}