package httpapi

import (
	"MyServer/internal/vfs/v2"
	"net/http"
)

// AuthenticatedOnly hides the generic VFS transport from guest actors.
func AuthenticatedOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		actor, ok := v2.ActorFromContext(r.Context())
		if !ok || actor.Kind != v2.ActorUser || actor.ID == "" {
			http.NotFound(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}
